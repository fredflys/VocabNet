import { useState, useMemo, useCallback, useEffect } from 'react'

const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']



export default function PlacementQuiz({ onComplete, onCancel }) {
  const [loading, setLoading] = useState(true)
  const [questions, setQuestions] = useState([])
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState({}) // { level: { known: N, total: N } }
  const [result, setResult] = useState(null)
  const [quizDone, setQuizDone] = useState(false)

  // Expanded, high-quality diagnostic words categorized by CEFR difficulty
  const diagnosticWords = useMemo(() => ({
    A1: ['apple', 'book', 'house', 'family', 'water', 'car', 'friend', 'school'],
    A2: ['journey', 'arrive', 'careful', 'island', 'popular', 'decide', 'modern', 'crowded'],
    B1: ['achieve', 'contribute', 'enormous', 'frequently', 'obvious', 'maintain', 'opportunity', 'evidence'],
    B2: ['ambiguous', 'comprehensive', 'diminish', 'elaborate', 'reluctant', 'subtle', 'innovation', 'profound'],
    C1: ['alleviate', 'cohesion', 'encompass', 'meticulous', 'pervasive', 'lucrative', 'pragmatic', 'scrutinize'],
    C2: ['abstruse', 'conflate', 'ebullient', 'inscrutable', 'perfunctory', 'obfuscate', 'pulchritude', 'ephemeral']
  }), [])

  // Build random quiz array from core milestone levels instantly
  useMemo(() => {
    const levels = ['B1', 'B2', 'C1', 'C2']
    const qs = []

    for (const level of levels) {
      const words = [...diagnosticWords[level]].sort(() => Math.random() - 0.5).slice(0, 5)
      words.forEach(w => qs.push({ word: w, level }))
    }

    setQuestions(qs.sort(() => Math.random() - 0.5))
    setLoading(false)
  }, [diagnosticWords])

  const handleAnswer = useCallback((known) => {
    const q = questions[index]
    if (!q) return

    const level = q.level
    const entry = answers[level] || { known: 0, total: 0 }
    const newAnswers = {
      ...answers,
      [level]: {
        known: entry.known + (known ? 1 : 0),
        total: entry.total + 1,
      },
    }
    setAnswers(newAnswers)

    if (index + 1 >= questions.length) {
      setQuizDone(true)
    } else {
      setIndex(i => i + 1)
    }
  }, [index, questions, answers])

  useEffect(() => {
    if (!quizDone) return
    let level = 'A2'
    for (const l of ['B1', 'B2', 'C1', 'C2']) {
      const entry = answers[l]
      if (entry && entry.total > 0 && entry.known / entry.total >= 0.6) level = l
      else break
    }
    setResult(level)
  }, [quizDone, answers])

  if (loading) {
    return (
      <div className="quiz-placement">
        <div className="quiz-placement__loading">Loading quiz…</div>
      </div>
    )
  }

  if (result) {
    return (
      <div className="quiz-placement">
        <div className="quiz-placement__result-card">
          <div className="quiz-placement__result-icon">🎯</div>
          <h2>Your Estimated Level</h2>
          <div className="quiz-placement__level-badge">{result}</div>
          <p className="quiz-placement__desc">
            {result === 'A2' && 'Pre-intermediate — You know basic vocabulary but many everyday words are still new.'}
            {result === 'B1' && 'Intermediate — You handle most common vocabulary. Time to tackle B2+ words.'}
            {result === 'B2' && 'Upper-intermediate — Strong vocabulary base. Focus on C-level literary & formal words.'}
            {result === 'C1' && 'Advanced — Excellent vocabulary. Only rare or highly formal words will challenge you.'}
            {result === 'C2' && 'Near-native — Outstanding vocabulary. You may only encounter very specialized terms.'}
          </p>
          <div className="quiz-placement__actions">
            <button className="btn btn--primary" onClick={() => onComplete(result)}>
              Apply Level ({result})
            </button>
            <button className="btn btn--ghost" onClick={onCancel}>
              Keep Current
            </button>
          </div>
        </div>
      </div>
    )
  }

  const q = questions[index]

  return (
    <div className="quiz-placement">
      <div className="quiz-placement__header">
        <h2>📝 Vocabulary Placement Quiz</h2>
        <p>Do you know these words? Be honest — this calibrates your study list.</p>
      </div>

      <div className="quiz-placement__progress-bar">
        <div
          className="quiz-placement__progress-fill"
          style={{ width: `${((index) / questions.length) * 100}%` }}
        />
      </div>
      <div className="quiz-placement__count">
        Question {index + 1} of {questions.length}
      </div>

      <div className="quiz-placement__card">
        <div className="quiz-placement__word">{q.word}</div>
        <div className="quiz-placement__prompt">Do you know what this word means?</div>

        <div className="quiz-placement__buttons">
          <button className="quiz-placement__btn quiz-placement__btn--yes" onClick={() => handleAnswer(true)}>
            ✅ I know it
          </button>
          <button className="quiz-placement__btn quiz-placement__btn--no" onClick={() => handleAnswer(false)}>
            ❌ Don't know
          </button>
        </div>
      </div>

      <button className="btn btn--ghost btn--sm" onClick={onCancel} style={{ marginTop: '1rem' }}>
        Skip quiz
      </button>
    </div>
  )
}
