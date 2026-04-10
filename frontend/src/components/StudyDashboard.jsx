import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { calcReadiness, isDueToday } from '../utils/sm2'

function cleanTitle(title) {
  if (!title) return 'Untitled'
  return title.replace(/\.(epub|txt|pdf|mobi)$/i, '').replace(/[_-]/g, ' ')
}

export default function StudyDashboard({ 
  books, sm2Data, onSelectBook
}) {
  const [selectedBookId, setSelectedBookId] = useState('none')
  const [selectedChapter, setSelectedChapter] = useState('All')

  const book = useMemo(() => {
    return books.find(b => b.id === selectedBookId) || null
  }, [books, selectedBookId])

  const stats = useMemo(() => {
    if (!book) return { totalWords: 0, totalIdioms: 0, knownWords: 0, learningWords: 0, readiness: 0, dueCount: 0 }
    
    const totalWords = book.total_words || 0
    const totalIdioms = book.idiom_count || 0
    
    const filteredVocab = selectedChapter === 'All' 
      ? book.vocab || [] 
      : (book.vocab || []).filter(v => v.chapters && v.chapters.includes(Number(selectedChapter)))

    const sm2Values = filteredVocab.map(v => sm2Data[v.lemma] || {})
    const knownWords = sm2Values.filter(w => w.status === 'mastered' || w.reps >= 4).length
    const learningWords = sm2Values.filter(w => w.status === 'learning' || (w.reps > 0 && w.reps < 4)).length
    
    const readiness = calcReadiness(filteredVocab, sm2Data, new Set())
    
    const bookLemmas = new Set(filteredVocab.map(v => v.lemma))
    const dueCount = Object.entries(sm2Data || {})
      .filter(([lemma, state]) => bookLemmas.has(lemma) && isDueToday(state))
      .length

    return { totalWords, totalIdioms, knownWords, learningWords, readiness, dueCount }
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

      {book ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem', marginBottom: '5rem' }}>
            <div style={{ padding: '2.5rem', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '1rem' }}>READINESS</div>
              <div style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--primary)' }}>{stats.readiness}%</div>
            </div>
            <div style={{ padding: '2.5rem', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '1rem' }}>MASTERED</div>
              <div style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--success)' }}>{stats.knownWords}</div>
            </div>
            <div style={{ padding: '2.5rem', background: 'var(--primary)', color: 'white', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '1.25rem' }}>Review Due</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 800 }}>{stats.dueCount}</div>
            </div>
          </div>

          <h3 style={{ fontSize: '1.5rem', marginBottom: '2rem' }}>Learning Curricula</h3>
          <div className="card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
            <button className="btn--primary" onClick={() => onSelectBook(book)} style={{ gridColumn: '1 / -1', padding: '1.5rem', fontSize: '1.2rem' }}>
              📖 Open Vocabulary Ledger
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
