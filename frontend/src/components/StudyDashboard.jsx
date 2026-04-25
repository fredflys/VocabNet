import { useMemo, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { calcReadiness, isDueToday } from '../utils/sm2'
import { cleanTitle } from '../utils/format'
import { fadeUp } from '../utils/motion'
import { API } from '../utils/config'

export default function StudyDashboard({
  books, sm2Data, onSelectBook, onStartStudy
}) {
  const [selectedBookId, setSelectedBookId] = useState('none')
  const [selectedChapter, setSelectedChapter] = useState('All')
  const [fullBook, setFullBook] = useState(null)
  const [bookLoading, setBookLoading] = useState(false)

  // Fetch full book data (with vocab) when dropdown selection changes
  useEffect(() => {
    if (selectedBookId === 'none') {
      setFullBook(null)
      return
    }
    let cancelled = false
    setBookLoading(true)
    fetch(`${API}/api/library/${selectedBookId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (!cancelled) setFullBook(data) })
      .catch(() => { if (!cancelled) setFullBook(null) })
      .finally(() => { if (!cancelled) setBookLoading(false) })
    return () => { cancelled = true }
  }, [selectedBookId])

  const book = fullBook

  const stats = useMemo(() => {
    if (!book) return { totalWords: 0, totalIdioms: 0, studyMastered: 0, autoMastered: 0, learningWords: 0, readiness: 0, dueCount: 0 }

    const totalWords = book.total_words || 0
    const totalIdioms = book.idiom_count || 0

    const filteredVocab = selectedChapter === 'All'
      ? book.vocab || []
      : (book.vocab || []).filter(v => v.chapters && v.chapters.includes(Number(selectedChapter)))

    let studyMastered = 0
    let autoMastered = 0
    let learningWords = 0

    for (const v of filteredVocab) {
      const sm2 = sm2Data[v.lemma]
      if (!sm2) continue
      if (sm2.mastery_source === 'auto') {
        autoMastered++
      } else if (sm2.status === 'mastered' || sm2.reps >= 4) {
        studyMastered++
      } else if (sm2.status === 'learning' || (sm2.reps > 0 && sm2.reps < 4)) {
        learningWords++
      }
    }

    const readiness = calcReadiness(filteredVocab, sm2Data, new Set())

    const bookLemmas = new Set(filteredVocab.map(v => v.lemma))
    const dueCount = Object.entries(sm2Data || {})
      .filter(([lemma, state]) => bookLemmas.has(lemma) && state.mastery_source !== 'auto' && isDueToday(state))
      .length

    return { totalWords, totalIdioms, studyMastered, autoMastered, learningWords, readiness, dueCount }
  }, [book, sm2Data, selectedChapter])

  return (
    <div className="study-dashboard">
      <header style={{ marginBottom: '4rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <h2 className="serif-title" style={{ fontSize: '4rem', lineHeight: 1 }}>Study Dashboard</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: '1rem', fontSize: '1.1rem' }}>
              Select a volume from your archive to begin your daily curriculum.
            </p>
          </div>
        </div>
      </header>

      <div style={{ marginBottom: '4rem' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '1rem' }}>ACTIVE VOLUME</div>
        <select
          value={selectedBookId}
          onChange={(e) => { setSelectedBookId(e.target.value); setSelectedChapter('All') }}
          style={{ width: '100%', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', fontSize: '1.2rem', fontWeight: 700, cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}
        >
          <option value="none">Select a book to analyze...</option>
          {books.map(b => (
            <option key={b.id} value={b.id}>{cleanTitle(b.title)}</option>
          ))}
        </select>
      </div>

      {bookLoading ? (
        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading book data...
        </div>
      ) : book ? (
        <motion.div {...fadeUp}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.5rem', margin: 0 }}>{cleanTitle(book.title)} Insights</h3>
            {book.chapters && book.chapters.length > 0 && (
              <select
                value={selectedChapter}
                onChange={(e) => setSelectedChapter(e.target.value)}
                style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', fontSize: '1rem', fontWeight: 600, cursor: 'pointer' }}
              >
                <option value="All">All Chapters</option>
                {book.chapters.map(ch => (
                  <option key={ch.number} value={ch.number}>Chapter {ch.number}</option>
                ))}
              </select>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '5rem' }}>
            <div style={{ padding: '2rem', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>READINESS</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--primary)' }}>{stats.readiness}%</div>
            </div>
            <div style={{ padding: '2rem', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>MASTERED</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--success)' }}>{stats.studyMastered}</div>
            </div>
            <div style={{ padding: '2rem', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>BELOW LEVEL</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-muted)' }}>{stats.autoMastered}</div>
            </div>
            <div style={{ padding: '2rem', background: 'var(--primary)', color: 'white', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>Review Due</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 800 }}>{stats.dueCount}</div>
            </div>
          </div>

          <h3 style={{ fontSize: '1.5rem', marginBottom: '2rem' }}>Learning Curricula</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
            <button
              className="btn--primary"
              onClick={() => onStartStudy(book, 'flashcard', selectedChapter)}
              style={{ padding: '1.5rem', fontSize: '1.15rem', fontWeight: 800, borderRadius: '16px' }}
            >
              Start Flashcard Session{stats.dueCount > 0 ? ` (${stats.dueCount} due)` : ''}
            </button>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
              <button
                className="btn--secondary"
                onClick={() => onStartStudy(book, 'mcq', selectedChapter)}
                style={{ padding: '1.25rem', fontSize: '1rem', fontWeight: 700, borderRadius: '14px' }}
              >
                Multiple Choice
              </button>
              <button
                className="btn--secondary"
                onClick={() => onStartStudy(book, 'cloze', selectedChapter)}
                style={{ padding: '1.25rem', fontSize: '1rem', fontWeight: 700, borderRadius: '14px' }}
              >
                Fill-in-the-Blank
              </button>
              <button
                className="btn--secondary"
                onClick={() => onStartStudy(book, 'recall', selectedChapter)}
                style={{ padding: '1.25rem', fontSize: '1rem', fontWeight: 700, borderRadius: '14px' }}
              >
                Active Recall
              </button>
            </div>
            <button
              className="btn--secondary"
              onClick={() => onSelectBook(book)}
              style={{ padding: '1.25rem', fontSize: '1rem', fontWeight: 700, borderRadius: '14px' }}
            >
              Open Vocabulary Ledger
            </button>
          </div>
        </motion.div>
      ) : (
        <div style={{ padding: '6rem 2rem', textAlign: 'center', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-lg)', border: '2px dashed var(--border)', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📚</div>
          <p>Choose a volume above to see your progress and start studying.</p>
        </div>
      )}
    </div>
  )
}
