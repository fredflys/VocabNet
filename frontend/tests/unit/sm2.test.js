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
  // Vocab spanning multiple CEFR levels
  const vocab = [
    { lemma: 'apple', count: 5, chapters: [1], cefr: 'B1' },
    { lemma: 'banana', count: 3, chapters: [1, 2], cefr: 'B2' },
    { lemma: 'cherry', count: 7, chapters: [2], cefr: 'B2' },
    { lemma: 'date', count: 2, chapters: [3], cefr: 'C1' },
    { lemma: 'elder', count: 1, chapters: [3], cefr: 'C2' },
  ]

  it('should return only above-level words when no SM2 data exists', () => {
    // B1 user: B1 is at-level (skipped), B2/C1/C2 are above-level
    const session = getStudySession(vocab, {}, 'B1', 20)
    expect(session.length).toBe(4)
    expect(session.map(e => e.lemma)).not.toContain('apple')
  })

  it('should exclude at-or-below-level words', () => {
    // For a C1 user: A1-C1 are at-or-below level, only C2 is above
    const session = getStudySession(vocab, {}, 'C1', 20)
    expect(session.length).toBe(1)
    expect(session[0].lemma).toBe('elder')
  })

  it('should respect maxCards limit', () => {
    const session = getStudySession(vocab, {}, 'B1', 2)
    expect(session.length).toBe(2)
  })

  it('should filter by chapter', () => {
    const session = getStudySession(vocab, {}, 'B1', 20, 2)
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
    const session = getStudySession(vocab, sm2Data, 'B1', 20)
    // cherry should be first (due), then new words
    expect(session[0].lemma).toBe('cherry')
  })

  it('should not include mastered words that are not due', () => {
    const sm2Data = {
      banana: { status: 'mastered', nextReview: '2099-01-01', ease: 2.5, interval: 30, reps: 5 },
    }
    const session = getStudySession(vocab, sm2Data, 'B1', 20)
    expect(session.map(e => e.lemma)).not.toContain('banana')
  })
})

describe('calcReadiness', () => {
  // Vocab above B1 level — unfamiliar for a B1 user
  const vocab = [
    { lemma: 'apple', cefr: 'B2' },
    { lemma: 'banana', cefr: 'B2' },
    { lemma: 'cherry', cefr: 'C1' },
    { lemma: 'date', cefr: 'C1' },
  ]

  it('should return 100 for empty vocab', () => {
    expect(calcReadiness([], {}, 'B1')).toBe(100)
  })

  it('should return 0 when no words are studied', () => {
    expect(calcReadiness(vocab, {}, 'B1')).toBe(0)
  })

  it('should return 100 when all words are mastered', () => {
    const sm2Data = {
      apple: { status: 'mastered' },
      banana: { status: 'mastered' },
      cherry: { status: 'mastered' },
      date: { status: 'mastered' },
    }
    expect(calcReadiness(vocab, sm2Data, 'B1')).toBe(100)
  })

  it('should exclude at-or-below-level words from calculation', () => {
    // For a C1 user, B2 and C1 are at-or-below level — all skipped → 100%
    expect(calcReadiness(vocab, {}, 'C1')).toBe(100)
  })

  it('should count only mastered as contributing to readiness', () => {
    const sm2Data = {
      apple: { status: 'mastered' },  // counts
      banana: { status: 'review' },   // does not count
      cherry: { status: 'learning' }, // does not count
      // date: no data               // does not count
    }
    // 1 mastered / 4 unfamiliar = 25%
    expect(calcReadiness(vocab, sm2Data, 'B1')).toBe(25)
  })
})
