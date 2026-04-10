import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { getStudySession, gradeSM2, createSM2State } from '../utils/sm2'
import { recordSession, updateStreak } from '../utils/studyStore'

const API = 'http://localhost:8000'

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function MultipleChoiceView({ book, sm2Data, onUpdate, onBack, chapterFilter }) {
  const cards = useMemo(
    () => getStudySession(book?.vocab || [], sm2Data, new Set(), 20, chapterFilter)
            .filter(e => e.definition || e.simple_def),
    [book, sm2Data, chapterFilter]
  )

  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState(null)
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, correct: 0 })
  const [options, setOptions] = useState([])
  const [loadingOptions, setLoadingOptions] = useState(false)
  const recorded = useRef(false)

  const card = cards[index]
  const isFinished = !card

  useEffect(() => {
    if (!card || isFinished) return

    async function fetchOptions() {
      setLoadingOptions(true)
      try {
        const resp = await fetch(`${API}/api/user/distractors?pos=${encodeURIComponent(card.pos || 'NOUN')}&exclude=${encodeURIComponent(card.lemma)}&count=3`)
        const distractors = await resp.json()
        
        let finalDistractors = distractors
        if (finalDistractors.length < 3) {
          const localPool = (book?.vocab || []).filter(e => e.lemma !== card.lemma && (e.definition || e.simple_def))
          const additional = localPool.sort(() => Math.random() - 0.5).slice(0, 3 - finalDistractors.length)
          finalDistractors = [...finalDistractors, ...additional.map(e => ({ lemma: e.lemma, definition: e.simple_def || e.definition }))]
        }

        const all = [
          { lemma: card.lemma, definition: card.simple_def || card.definition },
          ...finalDistractors
        ]
        setOptions(shuffle(all))
      } catch (err) {
        console.error('Failed to fetch distractors', err)
        const localDistractors = (book?.vocab || [])
          .filter(e => e.lemma !== card.lemma && (e.definition || e.simple_def))
          .sort(() => Math.random() - 0.5)
          .slice(0, 3)
        const all = [card, ...localDistractors].map(e => ({ lemma: e.lemma, definition: e.simple_def || e.definition }))
        setOptions(shuffle(all))
      } finally {
        setLoadingOptions(false)
      }
    }

    fetchOptions()
  }, [card, isFinished, book])

  const isCorrect = selected !== null ? options[selected]?.lemma === card?.lemma : null

  const handleSelect = useCallback((idx) => {
    if (selected !== null || loadingOptions) return 
    setSelected(idx)
  }, [selected, loadingOptions])

  const handleNext = useCallback(() => {
    if (!card) return
    const grade = isCorrect ? 2 : 0
    const current = sm2Data[card.lemma] || createSM2State()
    const updated = gradeSM2(current, grade)
    onUpdate(card.lemma, updated)

    setSessionStats(prev => ({
      reviewed: prev.reviewed + 1,
      correct: isCorrect ? prev.correct + 1 : prev.correct,
    }))

    setSelected(null)
    setIndex(i => i + 1)
  }, [card, isCorrect, sm2Data, onUpdate])

  if (isFinished) {
    if (sessionStats.reviewed > 0 && !recorded.current) {
      recorded.current = true
      recordSession({
        mode: 'multiple-choice',
        wordsReviewed: sessionStats.reviewed,
        wordsCorrect: sessionStats.correct,
      })
      updateStreak()
    }

    const pct = sessionStats.reviewed > 0
      ? Math.round((sessionStats.correct / sessionStats.reviewed) * 100)
      : 0

    return (
      <div className="study-finish texture-paper" style={{ padding: '4rem', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
        <div className="study-finish__icon" style={{ fontSize: '4rem', marginBottom: '1rem' }}>🔤</div>
        <h2 className="study-finish__title serif-title" style={{ fontSize: '3rem', marginBottom: '2rem' }}>Quiz Complete!</h2>
        <div className="study-finish__stats" style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '3rem', fontSize: '1.25rem' }}>
          <div><strong>{sessionStats.reviewed}</strong> questions</div>
          <div><strong>{pct}%</strong> correct</div>
        </div>
        <button className="btn--primary" onClick={onBack}>Back to Dashboard</button>
      </div>
    )
  }

  return (
    <div className="quiz-view" style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <button className="btn--secondary" onClick={onBack} style={{ alignSelf: 'flex-start', marginBottom: '2rem' }}>⬅ Quit</button>

      <div className="flashcard-progress" style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem', fontWeight: 600, letterSpacing: '0.05em' }}>
        QUESTION {index + 1} OF {cards.length}
      </div>

      <div className="quiz-card" style={{
        width: '100%',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow)',
        display: 'flex',
        flexDirection: 'column',
        padding: '3rem 2rem',
      }}>
        <h3 className="quiz-card__prompt" style={{ fontSize: '1.5rem', lineHeight: 1.5, marginBottom: '1rem', textAlign: 'center', color: 'var(--text)' }}>
          What does <strong style={{ color: 'var(--primary)', fontSize: '1.8rem' }}>"{card.lemma}"</strong> mean?
        </h3>
        {card.cefr && (
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <span className="quiz-card__meta badge badge-indigo">{card.cefr} · {card.pos?.toLowerCase()}</span>
          </div>
        )}

        <div className="quiz-card__options" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {loadingOptions ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Generating challenges...</div>
          ) : options.map((opt, i) => {
            let bg = 'var(--bg-subtle)'
            let border = '1px solid var(--border)'
            let color = 'var(--text)'
            let opacity = 1
            
            if (selected !== null) {
              if (opt.lemma === card.lemma) {
                bg = 'rgba(34, 197, 94, 0.1)'
                border = '1px solid #22c55e'
                color = '#16a34a'
              } else if (i === selected) {
                bg = 'rgba(239, 68, 68, 0.1)'
                border = '1px solid #ef4444'
                color = '#dc2626'
              } else {
                opacity = 0.5
              }
            }
            
            return (
              <button
                key={i}
                className="quiz-option"
                disabled={selected !== null}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '1.25rem',
                  background: bg,
                  border: border,
                  color: color,
                  opacity: opacity,
                  borderRadius: '12px',
                  cursor: selected !== null ? 'default' : 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'left'
                }}
                onClick={() => handleSelect(i)}
                onMouseEnter={e => { if (selected === null) e.currentTarget.style.border = '1px solid var(--primary)' }}
                onMouseLeave={e => { if (selected === null) e.currentTarget.style.border = '1px solid var(--border)' }}
              >
                <span className="quiz-option__letter" style={{ fontWeight: 800, background: 'rgba(0,0,0,0.05)', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}>
                  {'ABCD'[i]}
                </span>
                <span className="quiz-option__text" style={{ fontSize: '1.1rem', lineHeight: 1.4 }}>{opt.definition}</span>
              </button>
            )
          })}
        </div>

        {selected !== null && (
          <div className="quiz-card__feedback" style={{ marginTop: '2.5rem', textAlign: 'center' }}>
            {isCorrect
              ? <div className="quiz-card__correct" style={{ fontSize: '1.2rem', color: '#16a34a', fontWeight: 700, marginBottom: '1.5rem' }}>✅ Correct!</div>
              : <div className="quiz-card__wrong" style={{ fontSize: '1.2rem', color: '#dc2626', fontWeight: 700, marginBottom: '1.5rem' }}>❌ The answer was "{card.simple_def || card.definition}"</div>
            }
            <button className="btn--primary" onClick={handleNext} style={{ width: '100%', padding: '1rem', borderRadius: '12px', fontSize: '1.1rem' }}>
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
