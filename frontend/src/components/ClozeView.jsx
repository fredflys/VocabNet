import { useState, useMemo, useCallback, useRef } from 'react'
import { getStudySession, gradeSM2, createSM2State } from '../utils/sm2'
import { recordSession, updateStreak } from '../utils/studyStore'

/**
 * Replace the target lemma in a sentence with a blank.
 */
function blankOut(sentence, lemma) {
  if (!sentence) return { text: '', found: false }
  const regex = new RegExp(`\\b${lemma}\\w*\\b`, 'gi')
  const blanked = sentence.replace(regex, '________')
  return { text: blanked, found: blanked !== sentence }
}

export default function ClozeView({ book, sm2Data, onUpdate, onBack, chapterFilter }) {
  const cards = useMemo(
    () => getStudySession(book?.vocab || [], sm2Data, new Set(), 20, chapterFilter)
            .map(e => ({ ...e, _sentence: e.example || e.llm_example || '' }))
            .filter(e => e._sentence.length > 20),
    [book, sm2Data, chapterFilter]
  )

  const [index, setIndex] = useState(0)
  const [input, setInput] = useState('')
  const [checked, setChecked] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, correct: 0 })
  const recorded = useRef(false)

  const card = cards[index]
  const isFinished = !card

  const blanked = useMemo(() => {
    if (!card) return { text: '', found: false }
    return blankOut(card._sentence, card.lemma)
  }, [card])

  const handleCheck = useCallback(() => {
    if (!card || checked) return
    const correct = input.trim().toLowerCase() === card.lemma.toLowerCase()
    setIsCorrect(correct)
    setChecked(true)
  }, [card, input, checked])

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
    setIsCorrect(false)
    setIndex(i => i + 1)
  }, [card, sm2Data, onUpdate])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !checked) handleCheck()
  }, [checked, handleCheck])

  if (isFinished) {
    if (sessionStats.reviewed > 0 && !recorded.current) {
      recorded.current = true
      recordSession({
        mode: 'cloze',
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
            No words with example sentences are available for fill-in-the-blank. Try Flashcards instead, or process a book with an AI provider to generate examples.
          </p>
          <button className="btn--primary" onClick={onBack}>Back to Dashboard</button>
        </div>
      )
    }

    const pct = Math.round((sessionStats.correct / sessionStats.reviewed) * 100)

    return (
      <div className="study-finish texture-paper" style={{ padding: '4rem', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
        <div className="study-finish__icon" style={{ fontSize: '4rem', marginBottom: '1rem' }}>📝</div>
        <h2 className="study-finish__title serif-title" style={{ fontSize: '3rem', marginBottom: '2rem' }}>Cloze Session Complete!</h2>
        <div className="study-finish__stats" style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '3rem', fontSize: '1.25rem' }}>
          <div><strong>{sessionStats.reviewed}</strong> questions</div>
          <div><strong>{pct}%</strong> correct</div>
        </div>
        <button className="btn--primary" onClick={onBack}>Back to Dashboard</button>
      </div>
    )
  }

  const hintParts = []
  if (card.simple_def || card.translation) hintParts.push(card.simple_def || card.translation)
  if (card.cefr) hintParts.push(card.cefr)
  if (card.pos) hintParts.push(card.pos.toLowerCase())

  return (
    <div className="cloze-view" style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <button className="btn--secondary" onClick={onBack} style={{ alignSelf: 'flex-start', marginBottom: '2rem' }}>⬅ Quit</button>

      <div className="flashcard-progress" style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem', fontWeight: 600, letterSpacing: '0.05em' }}>
        QUESTION {index + 1} OF {cards.length}
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
        <h3 className="cloze-card__label" style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '1.5rem', letterSpacing: '0.05em' }}>FILL IN THE BLANK:</h3>
        <div className="cloze-card__sentence" style={{ fontSize: '1.5rem', lineHeight: 1.6, marginBottom: '2rem', fontStyle: 'italic', color: 'var(--text)' }}>
          "{blanked.text}"
        </div>

        {hintParts.length > 0 && (
          <div className="cloze-card__hint" style={{ background: 'var(--bg-subtle)', padding: '1rem', borderRadius: '8px', fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '2rem' }}>
            <strong>Hint:</strong> {hintParts.join(' · ')}
          </div>
        )}

        {!checked ? (
          <div className="cloze-card__input-row" style={{ display: 'flex', gap: '1rem' }}>
            <input
              type="text"
              className="cloze-card__input"
              placeholder="Type the word…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              style={{ flex: 1, padding: '1rem 1.5rem', fontSize: '1.2rem', borderRadius: '12px', border: '2px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--text)' }}
            />
            <button className="btn--primary" onClick={handleCheck} disabled={!input.trim()} style={{ padding: '1rem 2rem', borderRadius: '12px', fontSize: '1.1rem' }}>
              Check
            </button>
          </div>
        ) : (
          <div className="cloze-card__result" style={{ marginTop: '1rem' }}>
            {isCorrect ? (
              <div className="cloze-card__correct" style={{ padding: '1rem', background: 'var(--feedback-correct-bg)', color: 'var(--feedback-correct)', borderRadius: 'var(--radius)', fontSize: '1.2rem', marginBottom: '2rem', textAlign: 'center' }}>
                ✅ Correct! — <strong>{card.lemma}</strong>
              </div>
            ) : (
              <div className="cloze-card__wrong" style={{ padding: '1rem', background: 'var(--feedback-wrong-bg)', color: 'var(--feedback-wrong)', borderRadius: 'var(--radius)', fontSize: '1.2rem', marginBottom: '2rem', textAlign: 'center' }}>
                ❌ The answer was <strong>{card.lemma}</strong>
                {input.trim() && <div><span style={{ fontSize: '1rem', opacity: 0.8 }}>(you wrote "{input.trim()}")</span></div>}
              </div>
            )}

            <div className="grade-bar" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem', fontWeight: 600, letterSpacing: '0.05em' }}>HOW WELL DID YOU KNOW IT?</span>
              <div className="grade-bar__buttons" style={{ display: 'flex', gap: '1rem', width: '100%', justifyContent: 'center' }}>
                {isCorrect ? (
                  <>
                    <button className="grade-btn" style={{ flex: 1, padding: '1rem', borderRadius: 'var(--radius)', border: '2px solid var(--grade-good)', background: 'var(--bg-card)', color: 'var(--grade-good)', fontWeight: 700, cursor: 'pointer', '--btn-color': 'var(--grade-good)' }} onClick={() => handleGrade(2)}>Good</button>
                    <button className="grade-btn" style={{ flex: 1, padding: '1rem', borderRadius: 'var(--radius)', border: '2px solid var(--grade-easy)', background: 'var(--bg-card)', color: 'var(--grade-easy)', fontWeight: 700, cursor: 'pointer', '--btn-color': 'var(--grade-easy)' }} onClick={() => handleGrade(3)}>Easy</button>
                  </>
                ) : (
                  <>
                    <button className="grade-btn" style={{ flex: 1, padding: '1rem', borderRadius: 'var(--radius)', border: '2px solid var(--grade-again)', background: 'var(--bg-card)', color: 'var(--grade-again)', fontWeight: 700, cursor: 'pointer', '--btn-color': 'var(--grade-again)' }} onClick={() => handleGrade(0)}>Again</button>
                    <button className="grade-btn" style={{ flex: 1, padding: '1rem', borderRadius: 'var(--radius)', border: '2px solid var(--grade-hard)', background: 'var(--bg-card)', color: 'var(--grade-hard)', fontWeight: 700, cursor: 'pointer', '--btn-color': 'var(--grade-hard)' }} onClick={() => handleGrade(1)}>Hard</button>
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
