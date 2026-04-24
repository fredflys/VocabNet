import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createSM2State, gradeSM2, isDueToday, getStudySession, calcReadiness } from '../../src/utils/sm2'

describe('SM-2 Algorithm', () => {
  it('should initialize with default state', () => {
    const state = createSM2State()
    expect(state.ease).toBe(2.5)
    expect(state.reps).toBe(0)
    expect(state.interval).toBe(0)
    expect(state.status).toBe('new')
    expect(state.nextReview).toBeNull()
    expect(state.lastReview).toBeNull()
  })

  it('should increase interval when graded "Good" (2)', () => {
    let state = createSM2State()
    state = gradeSM2(state, 2) // First rep
    expect(state.reps).toBe(1)
    expect(state.interval).toBe(1)

    state = gradeSM2(state, 2) // Second rep
    expect(state.reps).toBe(2)
    expect(state.interval).toBe(6)
  })

  it('should reset reps when graded "Again" (0)', () => {
    let state = createSM2State()
    state = gradeSM2(state, 2)
    state = gradeSM2(state, 2)
    expect(state.interval).toBe(6)

    state = gradeSM2(state, 0)
    expect(state.reps).toBe(0)
    expect(state.interval).toBe(1)
    expect(state.status).toBe('learning')
  })

  it('should handle grade "Hard" (1) as incorrect', () => {
    let state = createSM2State()
    state = gradeSM2(state, 2)
    state = gradeSM2(state, 2)
    expect(state.reps).toBe(2)

    state = gradeSM2(state, 1)
    expect(state.reps).toBe(0)
    expect(state.interval).toBe(1)
    expect(state.status).toBe('learning')
  })

  it('should handle grade "Easy" (3) with higher ease', () => {
    let state = createSM2State()
    state = gradeSM2(state, 3)
    expect(state.reps).toBe(1)
    expect(state.interval).toBe(1)
    // Easy should increase ease
    expect(state.ease).toBeGreaterThan(2.5)
  })

  it('should set status to mastered when interval >= 21', () => {
    let state = createSM2State()
    // Repeatedly grade "Good" until mastered
    for (let i = 0; i < 10; i++) {
      state = gradeSM2(state, 2)
    }
    expect(state.interval).toBeGreaterThanOrEqual(21)
    expect(state.status).toBe('mastered')
  })

  it('should set lastReview to today', () => {
    const today = new Date().toISOString().slice(0, 10)
    const state = gradeSM2(createSM2State(), 2)
    expect(state.lastReview).toBe(today)
  })

  it('should set nextReview in the future', () => {
    const today = new Date().toISOString().slice(0, 10)
    const state = gradeSM2(createSM2State(), 2)
    expect(state.nextReview).toBeDefined()
    expect(state.nextReview >= today).toBe(true)
  })
})

describe('isDueToday', () => {
  it('should return false for new words', () => {
    expect(isDueToday(createSM2State())).toBe(false)
  })

  it('should return false for null state', () => {
    expect(isDueToday(null)).toBe(false)
  })

  it('should return false for undefined state', () => {
    expect(isDueToday(undefined)).toBe(false)
  })

  it('should return true when nextReview is today', () => {
    const today = new Date().toISOString().slice(0, 10)
    expect(isDueToday({ status: 'review', nextReview: today })).toBe(true)
  })

  it('should return true when nextReview is in the past', () => {
    expect(isDueToday({ status: 'review', nextReview: '2020-01-01' })).toBe(true)
  })

  it('should return false when nextReview is in the future', () => {
    expect(isDueToday({ status: 'review', nextReview: '2099-01-01' })).toBe(false)
  })

  it('should return false when nextReview is null', () => {
    expect(isDueToday({ status: 'learning', nextReview: null })).toBe(false)
  })
})

describe('getStudySession', () => {
  const vocab = [
    { lemma: 'apple', count: 5, chapters: [1] },
    { lemma: 'banana', count: 3, chapters: [1, 2] },
    { lemma: 'cherry', count: 7, chapters: [2] },
    { lemma: 'date', count: 2, chapters: [3] },
  ]

  it('should return new words when no SM2 data exists', () => {
    const session = getStudySession(vocab, {}, new Set(), 20)
    expect(session.length).toBe(4)
  })

  it('should exclude known words', () => {
    const known = new Set(['apple', 'banana'])
    const session = getStudySession(vocab, {}, known, 20)
    expect(session.length).toBe(2)
    expect(session.map(e => e.lemma)).not.toContain('apple')
    expect(session.map(e => e.lemma)).not.toContain('banana')
  })

  it('should respect maxCards limit', () => {
    const session = getStudySession(vocab, {}, new Set(), 2)
    expect(session.length).toBe(2)
  })

  it('should filter by chapter', () => {
    const session = getStudySession(vocab, {}, new Set(), 20, 2)
    const lemmas = session.map(e => e.lemma)
    expect(lemmas).toContain('banana')
    expect(lemmas).toContain('cherry')
    expect(lemmas).not.toContain('date')
  })

  it('should prioritize due words over new words', () => {
    const today = new Date().toISOString().slice(0, 10)
    const sm2Data = {
      cherry: { status: 'review', nextReview: today, ease: 2.5, interval: 1, reps: 1 },
    }
    const session = getStudySession(vocab, sm2Data, new Set(), 20)
    // cherry should be first (due), then new words
    expect(session[0].lemma).toBe('cherry')
  })

  it('should not include mastered words that are not due', () => {
    const sm2Data = {
      apple: { status: 'mastered', nextReview: '2099-01-01', ease: 2.5, interval: 30, reps: 5 },
    }
    const session = getStudySession(vocab, sm2Data, new Set(), 20)
    expect(session.map(e => e.lemma)).not.toContain('apple')
  })
})

describe('calcReadiness', () => {
  const vocab = [
    { lemma: 'apple' },
    { lemma: 'banana' },
    { lemma: 'cherry' },
    { lemma: 'date' },
  ]

  it('should return 100 for empty vocab', () => {
    expect(calcReadiness([], {}, new Set())).toBe(100)
  })

  it('should return 0 when no words are studied', () => {
    expect(calcReadiness(vocab, {}, new Set())).toBe(0)
  })

  it('should return 100 when all words are mastered', () => {
    const sm2Data = {
      apple: { status: 'mastered' },
      banana: { status: 'mastered' },
      cherry: { status: 'mastered' },
      date: { status: 'mastered' },
    }
    expect(calcReadiness(vocab, sm2Data, new Set())).toBe(100)
  })

  it('should return 100 when all words are known', () => {
    const known = new Set(['apple', 'banana', 'cherry', 'date'])
    expect(calcReadiness(vocab, {}, known)).toBe(100)
  })

  it('should give partial credit for review/learning status', () => {
    const sm2Data = {
      apple: { status: 'mastered' },  // 1.0
      banana: { status: 'review' },   // 0.5
      cherry: { status: 'learning' }, // 0.25
      // date: no data               // 0
    }
    // (1 + 0.5 + 0.25 + 0) / 4 = 0.4375 => 44%
    expect(calcReadiness(vocab, sm2Data, new Set())).toBe(44)
  })
})
