import { useState, useEffect, createContext } from 'react'
import BookshelfView from './components/BookshelfView'
import ProcessingView from './components/ProcessingView'
import VocabView from './components/VocabView'
import StudyDashboard from './components/StudyDashboard'
import UploadView from './components/UploadView'
import SettingsModal from './components/SettingsModal'
import PlacementQuiz from './components/PlacementQuiz'
import BookAssessmentQuiz from './components/BookAssessmentQuiz'
import FlashcardView from './components/FlashcardView'
import ClozeView from './components/ClozeView'
import MultipleChoiceView from './components/MultipleChoiceView'
import ActiveRecallView from './components/ActiveRecallView'
import { fetchSM2DataGlobal, updateSM2DataGlobal, fetchProfile, updateProfile, triggerAutoMaster } from './utils/studyStore'
import IntelligenceNebula from './components/IntelligenceNebula'
import TopLoadingBar from './components/common/TopLoadingBar'
import { AnimatePresence } from 'framer-motion'

import { API } from './utils/config'

export const AppContext = createContext()

// Legacy Migration Logic
const LEGACY_SETTINGS_KEY = 'audioprep_settings'
const NEW_SETTINGS_KEY = 'vocabnet_settings'

const STUDY_COMPONENTS = {
  flashcard: FlashcardView,
  cloze: ClozeView,
  mcq: MultipleChoiceView,
  recall: ActiveRecallView,
}

function App() {
  const [view, setView] = useState('dashboard') // dashboard | library | processing | vocab | upload | study | assessment
  const [books, setBooks] = useState([])
  const [selectedBook, setSelectedBook] = useState(null)
  const [sm2Data, setSm2Data] = useState({})
  const [jobId, setJobId] = useState(null)
  const [processingFileName, setProcessingFileName] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [showNebula, setShowNebula] = useState(false)
  const [showPlacement, setShowPlacement] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [studyMode, setStudyMode] = useState(null) // null | 'flashcard' | 'cloze' | 'mcq' | 'recall'
  const [studyChapterFilter, setStudyChapterFilter] = useState(null)
  const [activeBookId, setActiveBookId] = useState(null)

  const [settings, setSettings] = useState(() => {
    // Migration: Check for legacy settings first
    const legacy = localStorage.getItem(LEGACY_SETTINGS_KEY)
    if (legacy) {
      localStorage.setItem(NEW_SETTINGS_KEY, legacy)
      localStorage.removeItem(LEGACY_SETTINGS_KEY)
      return JSON.parse(legacy)
    }
    const saved = localStorage.getItem(NEW_SETTINGS_KEY)
    return saved ? JSON.parse(saved) : { ttsVoice: 'en-US-AriaNeural', autoTTS: true, cefrLevel: 'B1' }
  })

  useEffect(() => {
    const init = async () => {
      setIsLoading(true)
      const [, , profile] = await Promise.all([fetchBooks(), loadSM2(), fetchProfile()])
      if (profile?.cefr_level) {
        setSettings(prev => ({ ...prev, cefrLevel: profile.cefr_level }))
      }
      setIsLoading(false)
    }
    init()
  }, [])

  useEffect(() => {
    localStorage.setItem(NEW_SETTINGS_KEY, JSON.stringify(settings))
  }, [settings])

  const fetchBooks = async () => {
    try {
      const resp = await fetch(`${API}/api/library`)
      if (!resp.ok) throw new Error(`Failed to fetch books: ${resp.status}`)
      const data = await resp.json()
      setBooks(data)
    } catch (err) {
      console.error('Failed to fetch books', err)
    }
  }

  const loadSM2 = async () => {
    const data = await fetchSM2DataGlobal()
    setSm2Data(data)
  }

  const handleUpdateSM2 = async (lemma, newState) => {
    const updated = { ...sm2Data, [lemma]: newState }
    setSm2Data(updated)
    await updateSM2DataGlobal({ [lemma]: newState })
  }

  const handleSaveSettings = async (newSettings) => {
    const cefrChanged = newSettings.cefrLevel !== settings.cefrLevel
    setSettings(newSettings)
    if (cefrChanged && newSettings.cefrLevel) {
      const result = await updateProfile({ cefr_level: newSettings.cefrLevel })
      if (result?.auto_mastered_count > 0) {
        await loadSM2()
      }
    }
  }

  const handlePlacementComplete = async (level) => {
    setShowPlacement(false)
    const newSettings = { ...settings, cefrLevel: level }
    setSettings(newSettings)
    const result = await updateProfile({ cefr_level: level })
    if (result?.auto_mastered_count > 0) {
      await loadSM2()
    }
  }

  const handleBookSelect = async (bookInput, forceNebula = false) => {
    if (bookInput && bookInput.vocab && bookInput.entities) {
      setSelectedBook(bookInput)
      if (forceNebula) {
        setShowNebula(true)
      } else {
        setShowNebula(false)
        setView('vocab')
      }
      return
    }

    setIsLoading(true)
    try {
      const bookId = typeof bookInput === 'string' ? bookInput : bookInput.id
      const resp = await fetch(`${API}/api/library/${bookId}`)
      if (!resp.ok) throw new Error('Failed to load book details')
      const fullBook = await resp.json()
      setSelectedBook(fullBook)

      if (forceNebula) {
        setShowNebula(true)
      } else {
        setShowNebula(false)
        setView('vocab')
      }
    } catch (err) {
      console.error(err)
      alert("Could not load book details. Please try re-processing the book.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleProcessing = (id, fileName) => {
    setJobId(id)
    setProcessingFileName(fileName)
    setView('processing')
  }

  const handleUploadComplete = async (result) => {
    fetchBooks()
    setSelectedBook(result)
    // Trigger auto-mastery for words below user's level
    await triggerAutoMaster()
    await loadSM2()
    setView('vocab')
  }

  const handleStartStudy = async (book, mode, chapter = null) => {
    // Ensure we have full book data with vocab
    if (!book.vocab) {
      setIsLoading(true)
      try {
        const resp = await fetch(`${API}/api/library/${book.id}`)
        if (!resp.ok) throw new Error('Failed to load book')
        const fullBook = await resp.json()
        setSelectedBook(fullBook)
        setActiveBookId(fullBook.id)
      } catch (err) {
        console.error(err)
        setIsLoading(false)
        return
      }
      setIsLoading(false)
    } else {
      setSelectedBook(book)
      setActiveBookId(book.id)
    }
    setStudyMode(mode)
    setStudyChapterFilter(chapter === 'All' ? null : chapter ? Number(chapter) : null)
    setView('study')
  }

  const handleStartAssessment = async (book, isRetake = false) => {
    // Ensure we have full book data with vocab
    let fullBook = book
    if (!book.vocab) {
      setIsLoading(true)
      try {
        const resp = await fetch(`${API}/api/library/${book.id}`)
        if (!resp.ok) throw new Error('Failed to load book')
        fullBook = await resp.json()
      } catch (err) {
        console.error(err)
        setIsLoading(false)
        return
      }
      setIsLoading(false)
    }
    setActiveBookId(fullBook.id || book.id)

    // If retake, reset assessed entries for this book's unfamiliar words
    if (isRetake && fullBook.vocab) {
      const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
      const userIdx = CEFR.indexOf(settings.cefrLevel || 'B1')
      const resets = {}
      for (const v of fullBook.vocab) {
        const wordIdx = CEFR.indexOf(v.cefr)
        if (wordIdx >= 0 && wordIdx <= userIdx) continue
        const sm2 = sm2Data[v.lemma]
        if (sm2?.mastery_source === 'assessed') {
          resets[v.lemma] = { status: 'new', mastery_source: 'study', reps: 0, ease: 2.5, interval: 0, nextReview: null, lastReview: null }
        }
      }
      if (Object.keys(resets).length > 0) {
        const updated = { ...sm2Data, ...resets }
        setSm2Data(updated)
        await updateSM2DataGlobal(resets)
      }
    }

    setSelectedBook(fullBook)
    setView('assessment')
  }

  const handleAssessmentComplete = async (results) => {
    // Batch-update UserVocab for known words
    const updates = {}
    for (const lemma of results.known) {
      updates[lemma] = {
        status: 'mastered',
        mastery_source: 'assessed',
        ease: 2.5,
        interval: 21,
        reps: 4,
        nextReview: null,
        lastReview: new Date().toISOString().slice(0, 10),
      }
    }
    if (Object.keys(updates).length > 0) {
      const updated = { ...sm2Data, ...updates }
      setSm2Data(updated)
      await updateSM2DataGlobal(updates)
    }
    // Reload sm2Data from backend for consistency
    await loadSM2()
    setView('dashboard')
  }

  const StudyComponent = studyMode ? STUDY_COMPONENTS[studyMode] : null

  return (
    <AppContext.Provider value={{ settings, setSettings, setIsLoading }}>
      <div className="app-container">
        <TopLoadingBar isLoading={isLoading} />
        <header className="app-header">
          <div className="logo" onClick={() => setView('dashboard')}>VocabNet</div>

          <nav className="main-nav">
            <button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}>Study</button>
            <button className={view === 'library' ? 'active' : ''} onClick={() => setView('library')}>Library</button>
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <button className={`btn--new-volume ${view === 'upload' ? 'active' : ''}`} onClick={() => setView('upload')}>+ New Volume</button>
            <div className="nav-divider" style={{ height: '30px' }}></div>
            <button className="btn--secondary" onClick={() => setShowSettings(true)} style={{ padding: '0.6rem', borderRadius: '12px' }}>⚙️</button>
          </div>
        </header>

        <main className="app-main">
          {view === 'dashboard' && (
            <StudyDashboard
              books={books}
              sm2Data={sm2Data}
              userLevel={settings.cefrLevel || 'B1'}
              onSelectBook={handleBookSelect}
              onStartStudy={handleStartStudy}
              onStartAssessment={handleStartAssessment}
              activeBookId={activeBookId}
            />
          )}

          {view === 'library' && (
            <BookshelfView
              books={books}
              onSelect={handleBookSelect}
              onUpload={() => setView('upload')}
              onDeleted={(id) => setBooks(books.filter(b => b.id !== id))}
              onViewMasterLedger={() => handleBookSelect({ id: 'master' })}
            />
          )}

          {view === 'upload' && (
            <UploadView
              onProcessing={handleProcessing}
              onBack={() => setView('library')}
              settings={settings}
            />
          )}

          {view === 'processing' && jobId && (
            <ProcessingView
              jobId={jobId}
              fileName={processingFileName}
              onComplete={handleUploadComplete}
              onCancel={() => setView('library')}
            />
          )}

          {view === 'vocab' && selectedBook && (
            <VocabView
              book={selectedBook}
              sm2Data={sm2Data}
              onUpdate={handleUpdateSM2}
              onBack={() => setView('library')}
              onSelectBook={handleBookSelect}
            />
          )}

          {view === 'study' && selectedBook && StudyComponent && (
            <StudyComponent
              book={selectedBook}
              sm2Data={sm2Data}
              onUpdate={handleUpdateSM2}
              onBack={() => { setStudyMode(null); setView('dashboard') }}
              chapterFilter={studyChapterFilter}
            />
          )}

          {view === 'assessment' && selectedBook && (
            <BookAssessmentQuiz
              book={selectedBook}
              sm2Data={sm2Data}
              userLevel={settings.cefrLevel || 'B1'}
              onComplete={handleAssessmentComplete}
              onCancel={() => setView('dashboard')}
            />
          )}

          {showPlacement && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--bg)', overflow: 'auto', padding: '2rem' }}>
              <PlacementQuiz
                onComplete={handlePlacementComplete}
                onCancel={() => setShowPlacement(false)}
              />
            </div>
          )}
        </main>

        <AnimatePresence>
          {showSettings && (
            <SettingsModal
              settings={settings}
              onSave={handleSaveSettings}
              onClose={() => setShowSettings(false)}
              onPlacementQuiz={() => { setShowSettings(false); setShowPlacement(true) }}
            />
          )}
          {showNebula && selectedBook && (
            <IntelligenceNebula
              entities={selectedBook.entities || []}
              bookTitle={selectedBook.title}
              totalChapters={selectedBook.total_chapters}
              initialChapter={selectedBook.initialChapter}
              onClose={() => setShowNebula(false)}
            />
          )}
        </AnimatePresence>
      </div>
    </AppContext.Provider>
  )
}

export default App
