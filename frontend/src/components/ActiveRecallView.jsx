import { useState, useMemo, useCallback, useRef, useContext } from 'react'
import { getStudySession, gradeSM2, createSM2State } from '../utils/sm2'
import { recordSession, updateStreak } from '../utils/studyStore'
import { AppContext } from '../App'

export default function ActiveRecallView({ book, sm2Data, onUpdate, onBack, chapterFilter }) {
  const { settings } = useContext(AppContext)

  const cards = useMemo(
    () => getStudySession(book?.vocab || [], sm2Data, settings.cefrLevel || 'B1', 20, chapterFilter)
            .filter(e => e.simple_def || e.translation),
    [book, sm2Data, chapterFilter, settings.cefrLevel]
  )

  const [index, setIndex] = useState(0)
  const [input, setInput] = useState('')
  const [checked, setChecked] = useState(false)
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, correct: 0 })
  const recorded = useRef(false)

  const card = cards[index]
  const isFinished = !card

  const isCorrect = useMemo(() => {
    if (!checked || !card) return false
    return input.trim().toLowerCase() === card.lemma.toLowerCase()
  }, [checked, card, input])

  const handleCheck = useCallback(() => {
    if (!card || checked) return
    setChecked(true)
  }, [card, checked])

  const handleGrade = useCallback((grade) => {
    if (!card) return
    const current = sm2Data[card.lemma] || createSM2State()
    const updated = gradeSM2(current, grade)
    onUpdate(card.lemma, updated)

    setSessionStats(prev => ({
      reviewed: prev.reviewed + 1,
      correct: grade >= 2 ? prev.correct + 1 : prev.correct,
    }))

    setInput('')
    setChecked(false)
    setIndex(i => i + 1)
  }, [card, sm2Data, onUpdate])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !checked) handleCheck()
  }, [checked, handleCheck])

  if (isFinished) {
    if (sessionStats.reviewed > 0 && !recorded.current) {
      recorded.current = true
      recordSession({
        mode: 'active-recall',
        wordsReviewed: sessionStats.reviewed,
        wordsCorrect: sessionStats.correct,
      })
      updateStreak()
    }

    if (sessionStats.reviewed === 0) {
      return (
        <div className="study-finish texture-paper" style={{ padding: '4rem', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📭</div>
          <h2 className="serif-title" style={{ fontSize: '2.5rem', marginBottom: '1.5rem' }}>No Cards Available</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: '2.5rem', lineHeight: 1.6 }}>
            No words with definitions are available for active recall. Try Flashcards instead, or process a book with an AI provider to generate definitions.
          </p>
          <button className="btn--primary" onClick={onBack}>Back to Dashboard</button>
        </div>
      )
    }

    const pct = Math.round((sessionStats.correct / sessionStats.reviewed) * 100)

    return (
      <div className="study-finish texture-paper" style={{ padding: '4rem', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
        <div className="study-finish__icon" style={{ fontSize: '4rem', marginBottom: '1rem' }}>🖊️</div>
        <h2 className="study-finish__title serif-title" style={{ fontSize: '3rem', marginBottom: '2rem' }}>Active Recall Complete!</h2>
        <div className="study-finish__stats" style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '3rem', fontSize: '1.25rem' }}>
          <div><strong>{sessionStats.reviewed}</strong> words</div>
          <div><strong>{pct}%</strong> correct</div>
        </div>
        <button className="btn--primary" onClick={onBack}>Back to Dashboard</button>
      </div>
    )
  }

  const definition = card.simple_def || card.translation || ''

  return (
    <div className="cloze-view" style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <button className="btn--secondary" onClick={onBack} style={{ alignSelf: 'flex-start', marginBottom: '2rem' }}>⬅ Quit</button>

      <div className="flashcard-progress" style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem', fontWeight: 600, letterSpacing: '0.05em' }}>
        WORD {index + 1} OF {cards.length}
      </div>

      <div className="cloze-card" style={{
        width: '100%',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow)',
        display: 'flex',
        flexDirection: 'column',
        padding: '3rem 2rem',
      }}>
        <h3 className="cloze-card__label" style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '1.5rem', letterSpacing: '0.05em', textAlign: 'center' }}>WHAT WORD MATCHES THIS DEFINITION?</h3>
        
        <div className="recall-def" style={{ fontSize: '1.5rem', lineHeight: 1.6, marginBottom: '2rem', textAlign: 'center', fontStyle: 'italic', color: 'var(--text)' }}>
          "{definition}"
        </div>

        {card.cefr && (
          <div className="cloze-card__hint" style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <span className="badge badge-indigo">
              {card.cefr} · {card.pos?.toLowerCase()}
              {card.first_chapter ? ` · Ch.${card.first_chapter}` : ''}
            </span>
          </div>
        )}

        {card.memory_tip && (
          <div className="flashcard__tip" style={{ background: 'var(--bg-subtle)', padding: '1rem', borderRadius: '8px', fontSize: '0.9rem', color: 'var(--accent)', fontWeight: 600, marginBottom: '2rem', textAlign: 'center' }}>
            💡 {card.memory_tip}
          </div>
        )}

        {!checked ? (
          <div className="cloze-card__input-row" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
            <input
              type="text"
              className="cloze-card__input"
              placeholder="Type the word…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              style={{ width: '100%', padding: '1.25rem', fontSize: '1.5rem', borderRadius: '12px', border: '2px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--text)', textAlign: 'center' }}
            />
            <button className="btn--primary" onClick={handleCheck} disabled={!input.trim()} style={{ width: '100%', padding: '1.25rem', borderRadius: '12px', fontSize: '1.1rem' }}>
              Check Answer
            </button>
          </div>
        ) : (
          <div className="cloze-card__result" style={{ marginTop: '1rem' }}>
            {isCorrect ? (
              <div className="cloze-card__correct" style={{ padding: '1.5rem', background: 'rgba(34, 197, 94, 0.1)', color: '#16a34a', borderRadius: '12px', fontSize: '1.5rem', marginBottom: '2rem', textAlign: 'center' }}>
                ✅ Correct! — <strong>{card.lemma}</strong>
              </div>
            ) : (
              <div className="cloze-card__wrong" style={{ padding: '1.5rem', background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', borderRadius: '12px', fontSize: '1.5rem', marginBottom: '2rem', textAlign: 'center' }}>
                ❌ The word was <strong>{card.lemma}</strong>
                {input.trim() && <div><span style={{ fontSize: '1rem', opacity: 0.8 }}>(you wrote "{input.trim()}")</span></div>}
              </div>
            )}

            {card.translation && (
              <div className="flashcard__translation" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)', textAlign: 'center', marginBottom: '2rem' }}>
                Translation: {card.translation}
              </div>
            )}

            <div className="grade-bar" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem', fontWeight: 600, letterSpacing: '0.05em' }}>HOW WELL DID YOU KNOW IT?</span>
              <div className="grade-bar__buttons" style={{ display: 'flex', gap: '1rem', width: '100%', justifyContent: 'center' }}>
                {isCorrect ? (
                  <>
                    <button className="grade-btn" style={{ flex: 1, padding: '1rem', borderRadius: '12px', border: '2px solid #6366f1', background: 'var(--bg-card)', color: '#6366f1', fontWeight: 700, cursor: 'pointer' }} onClick={() => handleGrade(2)}>Good</button>
                    <button className="grade-btn" style={{ flex: 1, padding: '1rem', borderRadius: '12px', border: '2px solid #22c55e', background: 'var(--bg-card)', color: '#22c55e', fontWeight: 700, cursor: 'pointer' }} onClick={() => handleGrade(3)}>Easy</button>
                  </>
                ) : (
                  <>
                    <button className="grade-btn" style={{ flex: 1, padding: '1rem', borderRadius: '12px', border: '2px solid #ef4444', background: 'var(--bg-card)', color: '#ef4444', fontWeight: 700, cursor: 'pointer' }} onClick={() => handleGrade(0)}>Again</button>
                    <button className="grade-btn" style={{ flex: 1, padding: '1rem', borderRadius: '12px', border: '2px solid #f59e0b', background: 'var(--bg-card)', color: '#f59e0b', fontWeight: 700, cursor: 'pointer' }} onClick={() => handleGrade(1)}>Hard</button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
