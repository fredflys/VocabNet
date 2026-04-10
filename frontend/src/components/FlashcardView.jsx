import { useState, useMemo, useCallback, useRef, useContext } from 'react'
import { getStudySession, gradeSM2, createSM2State } from '../utils/sm2'
import { updateWordSM2, recordSession, updateStreak } from '../utils/studyStore'
import { AppContext } from '../App'

const API = 'http://localhost:8000'

function speak(word, voice) {
  const audio = new Audio(`${API}/api/tts?word=${encodeURIComponent(word)}&voice=${encodeURIComponent(voice || 'en-US-AriaNeural')}`)
  audio.play().catch(e => console.error('Audio playback failed', e))
}

const GRADES = [
  { value: 0, label: 'Again', color: '#ef4444', key: '1' },
  { value: 1, label: 'Hard',  color: '#f59e0b', key: '2' },
  { value: 2, label: 'Good',  color: '#6366f1', key: '3' },
  { value: 3, label: 'Easy',  color: '#22c55e', key: '4' },
]

export default function FlashcardView({ book, sm2Data, onUpdate, onBack, chapterFilter }) {
  const { settings } = useContext(AppContext)
  
  const cards = useMemo(
    () => getStudySession(book?.vocab || [], sm2Data, new Set(), 20, chapterFilter),
    [book, sm2Data, chapterFilter]
  )

  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, correct: 0 })
  const recorded = useRef(false)

  const card = cards[index]
  const isFinished = !card

  const handleGrade = useCallback((grade) => {
    if (!card) return
    const current = sm2Data[card.lemma] || createSM2State()
    const updated = gradeSM2(current, grade)
    onUpdate(card.lemma, updated)

    setSessionStats(prev => ({
      reviewed: prev.reviewed + 1,
      correct: grade >= 2 ? prev.correct + 1 : prev.correct,
    }))

    setFlipped(false)
    setIndex(i => i + 1)
  }, [card, sm2Data, onUpdate])

  if (isFinished) {
    if (sessionStats.reviewed > 0 && !recorded.current) {
      recorded.current = true
      recordSession({
        mode: 'flashcard',
        wordsReviewed: sessionStats.reviewed,
        wordsCorrect: sessionStats.correct,
      })
      updateStreak()
    }

    const pct = sessionStats.reviewed > 0
      ? Math.round((sessionStats.correct / sessionStats.reviewed) * 100)
      : 0

    return (
      <div className="study-finish texture-paper" style={{ padding: '4rem', textAlign: 'center' }}>
        <div className="study-finish__icon" style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
        <h2 className="study-finish__title serif-title" style={{ fontSize: '3rem', marginBottom: '2rem' }}>Session Complete!</h2>
        <div className="study-finish__stats" style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '3rem', fontSize: '1.25rem' }}>
          <div><strong>{sessionStats.reviewed}</strong> words reviewed</div>
          <div><strong>{pct}%</strong> correct</div>
        </div>
        <button className="btn--primary" onClick={onBack}>Back to Dashboard</button>
      </div>
    )
  }

  const primaryDef = card.simple_def || card.definition || ''
  const bookEx = card.example || ''

  return (
    <div className="flashcard-view" style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <button className="btn--secondary" onClick={onBack} style={{ alignSelf: 'flex-start', marginBottom: '2rem' }}>⬅ Quit</button>

      <div className="flashcard-progress" style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem', fontWeight: 600, letterSpacing: '0.05em' }}>
        CARD {index + 1} OF {cards.length}
      </div>

      <div
        className={`flashcard ${flipped ? 'flashcard--flipped' : ''}`}
        onClick={() => !flipped && setFlipped(true)}
        style={{
          width: '100%',
          minHeight: '400px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '3rem 2rem',
          cursor: flipped ? 'default' : 'pointer',
          transition: 'all 0.3s',
          position: 'relative'
        }}
      >
        {/* Front */}
        {!flipped ? (
          <div className="flashcard__face flashcard__front" style={{ textAlign: 'center' }}>
            <h2 className="flashcard__word serif-title" style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>{card.lemma}</h2>
            {card.phonetics && (
              <div className="flashcard__phonetics" style={{ color: 'var(--text-muted)', fontSize: '1.2rem', marginBottom: '1rem' }}>{card.phonetics}</div>
            )}
            <button className="tts-btn flashcard__tts" style={{ background: 'var(--bg-subtle)', border: 'none', borderRadius: '50%', width: '50px', height: '50px', fontSize: '1.5rem', cursor: 'pointer', marginBottom: '1.5rem' }} onClick={e => { e.stopPropagation(); speak(card.lemma, settings.ttsVoice) }}>
              🔊
            </button>
            {card.translation && (
              <div className="flashcard__translation" style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '1rem' }}>{card.translation}</div>
            )}
            <div className="flashcard__hint" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', opacity: 0.6, marginTop: '2rem' }}>Tap to reveal</div>
          </div>
        ) : (
        /* Back */
          <div className="flashcard__face flashcard__back" style={{ textAlign: 'center', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <h3 className="flashcard__word-small" style={{ fontSize: '1.5rem', margin: 0 }}>{card.lemma}</h3>
              {card.cefr && <span className="flashcard__cefr badge badge-indigo">{card.cefr} · {card.pos?.toLowerCase()}</span>}
            </div>
            
            <div className="flashcard__def" style={{ fontSize: '1.2rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>{primaryDef || 'No definition available'}</div>
            
            {card.llm_example && (
              <div className="flashcard__example" style={{ fontSize: '1rem', fontStyle: 'italic', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>"{card.llm_example}"</div>
            )}
            
            {bookEx && (
              <div className="flashcard__book-ctx" style={{ background: 'var(--bg-subtle)', padding: '1rem', borderRadius: '8px', fontSize: '0.9rem', marginBottom: '1.5rem', textAlign: 'left', borderLeft: '3px solid var(--primary)' }}>
                📖 "{bookEx.length > 150 ? bookEx.slice(0, 150) + '…' : bookEx}"
              </div>
            )}
            
            {card.memory_tip && (
              <div className="flashcard__tip" style={{ fontSize: '0.85rem', color: 'var(--accent)', fontWeight: 600 }}>💡 {card.memory_tip}</div>
            )}
          </div>
        )}
      </div>

      <div style={{ marginTop: '2rem', width: '100%', height: '80px' }}>
        {flipped ? (
          <div className="grade-bar" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span className="grade-bar__label" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem', fontWeight: 600, letterSpacing: '0.05em' }}>HOW WELL DID YOU KNOW IT?</span>
            <div className="grade-bar__buttons" style={{ display: 'flex', gap: '1rem', width: '100%' }}>
              {GRADES.map(g => (
                <button
                  key={g.value}
                  className="grade-btn"
                  style={{ flex: 1, padding: '1rem', borderRadius: '12px', border: `2px solid ${g.color}`, background: 'var(--bg-card)', color: g.color, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}
                  onClick={() => handleGrade(g.value)}
                  onMouseEnter={e => { e.currentTarget.style.background = g.color; e.currentTarget.style.color = 'white' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.color = g.color }}
                >
                  <span className="grade-btn__label">{g.label}</span>
                  <span className="grade-btn__key" style={{ opacity: 0.5, fontSize: '0.75rem' }}>{g.key}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="grade-bar" style={{ opacity: 0.4, textAlign: 'center', padding: '2rem 0' }}>
            <span className="grade-bar__label" style={{ fontSize: '0.9rem', fontWeight: 600, letterSpacing: '0.05em' }}>FLIP THE CARD TO GRADE IT</span>
          </div>
        )}
      </div>
    </div>
  )
}
