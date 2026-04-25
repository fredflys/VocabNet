import { useMemo, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { isDueToday } from '../utils/sm2'
import { cleanTitle } from '../utils/format'
import { fadeUp } from '../utils/motion'
import { API } from '../utils/config'

const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

export default function StudyDashboard({
  books, sm2Data, userLevel, onSelectBook, onStartStudy, onStartAssessment, activeBookId
}) {
  const [selectedBookId, setSelectedBookId] = useState(activeBookId || 'none')
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
    if (!book) return { belowLevel: 0, unfamiliarCount: 0, mastered: 0, readiness: 0, dueCount: 0 }

    const userIdx = CEFR.indexOf(userLevel)

    const filteredVocab = selectedChapter === 'All'
      ? book.vocab || []
      : (book.vocab || []).filter(v => v.chapters && v.chapters.includes(Number(selectedChapter)))

    // Partition vocab into at-or-below-level vs above-level (unfamiliar)
    const belowLevel = []
    const unfamiliar = []
    for (const v of filteredVocab) {
      const wordIdx = CEFR.indexOf(v.cefr)
      if (wordIdx >= 0 && wordIdx <= userIdx) {
        belowLevel.push(v)
      } else {
        unfamiliar.push(v)
      }
    }

    // Mastered = above-level words where sm2 status is 'mastered'
    const mastered = unfamiliar.filter(v => {
      const sm2 = sm2Data[v.lemma]
      return sm2 && sm2.status === 'mastered'
    }).length

    // Readiness = (known at-or-below + mastered above) / total vocab
    const readiness = filteredVocab.length > 0
      ? Math.round(((belowLevel.length + mastered) / filteredVocab.length) * 100)
      : 100

    // Due = unfamiliar words due for review
    const dueCount = unfamiliar.filter(v => {
      const sm2 = sm2Data[v.lemma]
      return sm2 && isDueToday(sm2)
    }).length

    return {
      belowLevel: belowLevel.length,
      unfamiliarCount: unfamiliar.length,
      mastered, readiness, dueCount
    }
  }, [book, sm2Data, selectedChapter, userLevel])

  // Check if assessment quiz has been taken for this book
  const quizTaken = useMemo(() => {
    if (!book?.vocab) return false
    const userIdx = CEFR.indexOf(userLevel)
    return book.vocab.some(v => {
      const wordIdx = CEFR.indexOf(v.cefr)
      if (wordIdx >= 0 && wordIdx <= userIdx) return false // skip at-or-below-level
      const sm2 = sm2Data[v.lemma]
      return sm2?.mastery_source === 'assessed'
    })
  }, [book, sm2Data, userLevel])

  // Global vocabulary stats
  const globalMastered = useMemo(() => {
    return Object.values(sm2Data)
      .filter(s => s.status === 'mastered' && s.mastery_source !== 'auto')
      .length
  }, [sm2Data])

  return (
    <div className="study-dashboard">
      <header style={{ marginBottom: '4rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <h2 className="serif-title" style={{ fontSize: '4rem', lineHeight: 1 }}>Study Dashboard</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: '1rem', fontSize: '1.1rem' }}>
              Select a volume from your archive to begin your daily curriculum.
            </p>
            {globalMastered > 0 && (
              <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.95rem' }}>
                Your vocabulary: <strong style={{ color: 'var(--text)' }}>{globalMastered}</strong> words mastered across <strong style={{ color: 'var(--text)' }}>{books.length}</strong> volume{books.length !== 1 ? 's' : ''}
              </p>
            )}
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
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--success)' }}>{stats.mastered}</div>
            </div>
            <div style={{ padding: '2rem', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>AT/BELOW LEVEL</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-muted)' }}>{stats.belowLevel}</div>
            </div>
            <div style={{ padding: '2rem', background: 'var(--primary)', color: 'white', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>Review Due</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 800 }}>{stats.dueCount}</div>
            </div>
          </div>

          <h3 style={{ fontSize: '1.5rem', marginBottom: '2rem' }}>Learning Curricula</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
            {!quizTaken ? (
              <button
                className="btn--primary"
                onClick={() => onStartAssessment(book)}
                style={{ padding: '1.5rem', fontSize: '1.15rem', fontWeight: 800, borderRadius: '16px', background: 'linear-gradient(135deg, var(--accent), var(--primary))' }}
              >
                Take Book Assessment — estimate what you already know
              </button>
            ) : (
              <div style={{ textAlign: 'right', marginBottom: '0.25rem' }}>
                <button
                  onClick={() => onStartAssessment(book, true)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                >
                  Retake Assessment (resets quiz-based mastery)
                </button>
              </div>
            )}
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
