import { useMemo, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const SAMPLE_PER_LEVEL = 8

/**
 * Stratified word sampling: group unfamiliar words by CEFR level,
 * sample up to SAMPLE_PER_LEVEL per group, prioritize high-frequency words.
 */
function sampleQuizWords(vocab, sm2Data, userLevel) {
  const userIdx = CEFR.indexOf(userLevel)

  // Collect above-level words (CEFR > user level)
  const unfamiliar = vocab.filter(v => {
    const wordIdx = CEFR.indexOf(v.cefr)
    return wordIdx > userIdx
  })

  // Group by CEFR level
  const groups = {}
  for (const v of unfamiliar) {
    const level = v.cefr || 'unknown'
    if (!groups[level]) groups[level] = []
    groups[level].push(v)
  }

  // Sample from each level, prioritizing high frequency (lower rank = more frequent)
  const sampled = []
  for (const level of CEFR.slice(userIdx + 1)) {
    const group = groups[level] || []
    // Sort by frequency rank (ascending = most frequent first)
    const sorted = [...group].sort((a, b) => (a.rank || 9999) - (b.rank || 9999))
    sampled.push(...sorted.slice(0, SAMPLE_PER_LEVEL))
  }

  // Include unknown CEFR words too (up to a few)
  if (groups['unknown']) {
    const sorted = [...groups['unknown']].sort((a, b) => (a.rank || 9999) - (b.rank || 9999))
    sampled.push(...sorted.slice(0, 4))
  }

  return sampled
}

export default function BookAssessmentQuiz({ book, sm2Data, userLevel, onComplete, onCancel }) {
  const [phase, setPhase] = useState('intro') // intro | quiz | results
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState({}) // { lemma: 'known' | 'unknown' }

  const quizWords = useMemo(
    () => sampleQuizWords(book?.vocab || [], sm2Data, userLevel),
    [book, sm2Data, userLevel]
  )

  const card = quizWords[index]
  const total = quizWords.length

  const handleAnswer = useCallback((answer) => {
    if (!card) return
    setAnswers(prev => ({ ...prev, [card.lemma]: answer }))
    if (index + 1 < total) {
      setIndex(i => i + 1)
    } else {
      setPhase('results')
    }
  }, [card, index, total])

  // Compute results
  const results = useMemo(() => {
    const known = []
    const unknown = []
    for (const [lemma, answer] of Object.entries(answers)) {
      if (answer === 'known') known.push(lemma)
      else unknown.push(lemma)
    }

    // Per-level stats for extrapolation
    const userIdx = CEFR.indexOf(userLevel)
    const allUnfamiliar = (book?.vocab || []).filter(v => {
      const wordIdx = CEFR.indexOf(v.cefr)
      return wordIdx > userIdx
    })

    const levelStats = {}
    for (const level of CEFR.slice(userIdx + 1)) {
      const totalAtLevel = allUnfamiliar.filter(v => v.cefr === level).length
      const testedAtLevel = quizWords.filter(v => v.cefr === level).length
      const knownAtLevel = quizWords.filter(v => v.cefr === level && answers[v.lemma] === 'known').length
      const ratio = testedAtLevel > 0 ? knownAtLevel / testedAtLevel : 0
      levelStats[level] = { totalAtLevel, testedAtLevel, knownAtLevel, ratio }
    }

    // Estimated readiness via extrapolation
    let estimatedKnown = 0
    let totalUnfamiliar = 0
    for (const level of Object.keys(levelStats)) {
      const s = levelStats[level]
      estimatedKnown += Math.round(s.ratio * s.totalAtLevel)
      totalUnfamiliar += s.totalAtLevel
    }
    const estimatedReadiness = totalUnfamiliar > 0
      ? Math.round((estimatedKnown / totalUnfamiliar) * 100)
      : 100

    return { known, unknown, estimatedReadiness, levelStats }
  }, [answers, book, quizWords, userLevel])

  const handleFinish = useCallback(() => {
    onComplete({ known: results.known, unknown: results.unknown })
  }, [onComplete, results])

  // Intro screen
  if (phase === 'intro') {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '4rem 2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>📋</div>
        <h2 className="serif-title" style={{ fontSize: '2.5rem', marginBottom: '1.5rem' }}>Book Assessment</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.15rem', lineHeight: 1.6, marginBottom: '0.5rem' }}>
          This quiz samples words from <strong style={{ color: 'var(--text)' }}>{book?.title || 'this book'}</strong> to estimate what you already know.
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', marginBottom: '3rem' }}>
          ~{total} words &middot; Takes about {Math.max(1, Math.round(total * 0.08))} minute{Math.round(total * 0.08) !== 1 ? 's' : ''}
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button className="btn--primary" onClick={() => setPhase('quiz')} style={{ padding: '1.25rem 3rem', fontSize: '1.15rem', fontWeight: 700, borderRadius: '14px' }}>
            Start Assessment
          </button>
          <button className="btn--secondary" onClick={onCancel} style={{ padding: '1.25rem 2rem', fontSize: '1rem', fontWeight: 600, borderRadius: '14px' }}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  // Results screen
  if (phase === 'results') {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '4rem 2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>🎯</div>
        <h2 className="serif-title" style={{ fontSize: '2.5rem', marginBottom: '1.5rem' }}>Assessment Complete</h2>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '3rem', marginBottom: '2.5rem' }}>
          <div>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--success)' }}>{results.known.length}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Known</div>
          </div>
          <div>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-muted)' }}>{results.unknown.length}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>New</div>
          </div>
          <div>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--primary)' }}>{results.estimatedReadiness}%</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Est. Readiness</div>
          </div>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '2.5rem', lineHeight: 1.6 }}>
          You knew {results.known.length} out of {total} tested words.
          Based on this, your estimated readiness for this book is <strong>{results.estimatedReadiness}%</strong>.
        </p>
        <button className="btn--primary" onClick={handleFinish} style={{ padding: '1.25rem 3rem', fontSize: '1.15rem', fontWeight: 700, borderRadius: '14px' }}>
          Save Results & Return
        </button>
      </div>
    )
  }

  // Quiz card
  const progress = total > 0 ? ((index) / total) * 100 : 0
  const primaryDef = card?.simple_def || card?.translation || ''

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem' }}>
      <button className="btn--secondary" onClick={onCancel} style={{ marginBottom: '2rem' }}>
        ⬅ Quit Assessment
      </button>

      {/* Progress bar */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.5rem' }}>
          <span>WORD {index + 1} OF {total}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div style={{ height: '6px', background: 'var(--bg-subtle)', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: 'var(--primary)', borderRadius: '3px', transition: 'width 0.3s ease' }} />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={card?.lemma}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.2 }}
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow)',
            padding: '3rem 2rem',
            textAlign: 'center',
          }}
        >
          <h2 className="serif-title" style={{ fontSize: '3rem', marginBottom: '1rem' }}>{card?.lemma}</h2>

          {card?.cefr && (
            <div style={{ marginBottom: '1.5rem' }}>
              <span className="badge badge-indigo">{card.cefr}{card.pos ? ` · ${card.pos.toLowerCase()}` : ''}</span>
            </div>
          )}

          {primaryDef && (
            <div style={{ fontSize: '1.15rem', color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: 1.5 }}>
              {primaryDef}
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button
              onClick={() => handleAnswer('known')}
              style={{
                flex: 1, maxWidth: '200px', padding: '1.25rem', borderRadius: '14px',
                border: '2px solid var(--success)', background: 'var(--bg-card)',
                color: 'var(--success)', fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer',
              }}
            >
              I Know This
            </button>
            <button
              onClick={() => handleAnswer('unknown')}
              style={{
                flex: 1, maxWidth: '200px', padding: '1.25rem', borderRadius: '14px',
                border: '2px solid var(--text-muted)', background: 'var(--bg-card)',
                color: 'var(--text-muted)', fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer',
              }}
            >
              New To Me
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
