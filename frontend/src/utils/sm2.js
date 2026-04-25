/**
 * SM-2 Spaced Repetition Algorithm
 * Same algorithm as Anki. Pure functions — no side effects.
 */

/**
 * Create a fresh SM-2 state for a new word.
 */
export function createSM2State() {
  return {
    ease: 2.5,
    interval: 0,
    reps: 0,
    status: 'new',        // new | learning | review | mastered
    nextReview: null,      // ISO date string
    lastReview: null,
    mastery_source: 'study',
  }
}

/**
 * Grade a word and return the updated SM-2 state.
 * @param {object} state - current SM-2 state
 * @param {number} grade - 0=Again, 1=Hard, 2=Good, 3=Easy
 * @returns {object} new SM-2 state (immutable)
 */
export function gradeSM2(state, grade) {
  const today = new Date().toISOString().slice(0, 10)
  let { ease, interval, reps } = state

  if (grade < 2) {
    // Incorrect — reset
    reps = 0
    interval = 1
  } else {
    // Correct
    if (reps === 0) {
      interval = 1
    } else if (reps === 1) {
      interval = 6
    } else {
      interval = Math.round(interval * ease)
    }

    // Adjust ease factor
    ease = Math.max(1.3, ease + (0.1 - (3 - grade) * (0.08 + (3 - grade) * 0.02)))
    reps += 1
  }

  // Determine status
  let status
  if (grade < 2) {
    status = 'learning'
  } else if (interval >= 21) {
    status = 'mastered'
  } else {
    status = 'review'
  }

  // Calculate next review date
  const next = new Date()
  next.setDate(next.getDate() + interval)
  const nextReview = next.toISOString().slice(0, 10)

  return {
    ease: Math.round(ease * 100) / 100,
    interval,
    reps,
    status,
    nextReview,
    lastReview: today,
  }
}

/**
 * Check if a word is due for review today.
 */
export function isDueToday(sm2State) {
  if (!sm2State || sm2State.status === 'new') return false
  if (!sm2State.nextReview) return false
  const today = new Date().toISOString().slice(0, 10)
  return sm2State.nextReview <= today
}

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

/**
 * Get words for a study session, prioritized correctly.
 * Skips at-or-below-level words (CEFR <= userLevel) and already-mastered words (unless due).
 * @param {Array} vocab - full vocab array from pipeline
 * @param {object} sm2Data - { [lemma]: SM2State }
 * @param {string} userLevel - user's CEFR level (e.g. 'B1')
 * @param {number} maxCards - max cards per session
 * @param {number|null} chapterFilter - if set, only include words from this chapter
 * @returns {Array} selected vocab entries for this session
 */
export function getStudySession(vocab, sm2Data, userLevel = 'B1', maxCards = 20, chapterFilter = null) {
  const userIdx = CEFR_LEVELS.indexOf(userLevel)
  const due = []
  const newWords = []

  for (const entry of vocab) {
    // Skip at-or-below-level words
    const wordIdx = CEFR_LEVELS.indexOf(entry.cefr)
    if (wordIdx >= 0 && wordIdx <= userIdx) continue

    const sm2 = sm2Data[entry.lemma]

    // Chapter filter: skip words not in the selected chapter
    if (chapterFilter != null && chapterFilter > 0) {
      const chapters = entry.chapters || []
      if (chapters.length > 0 && !chapters.includes(chapterFilter)) continue
    }

    if (!sm2 || sm2.status === 'new') {
      newWords.push(entry)
    } else if (sm2.status === 'mastered') {
      // Only include mastered if due for review
      if (isDueToday(sm2)) due.push(entry)
    } else if (isDueToday(sm2)) {
      due.push(entry)
    }
  }

  // Due words first (most urgent), then new words (by book frequency — already sorted)
  const session = [...due, ...newWords]
  return session.slice(0, maxCards)
}

/**
 * Calculate readiness score.
 * Readiness = mastered unfamiliar / total unfamiliar.
 * At-or-below-level words (CEFR <= userLevel) are treated as known.
 * @param {Array} vocab - vocab entries with .cefr and .lemma
 * @param {object} sm2Data - { [lemma]: SM2State }
 * @param {string} userLevel - user's CEFR level (e.g. 'B1')
 * @returns {number} 0-100
 */
export function calcReadiness(vocab, sm2Data, userLevel = 'B1') {
  const userIdx = CEFR_LEVELS.indexOf(userLevel)
  let unfamiliarCount = 0
  let masteredCount = 0

  for (const entry of vocab) {
    const wordIdx = CEFR_LEVELS.indexOf(entry.cefr)
    if (wordIdx >= 0 && wordIdx <= userIdx) continue // skip at-or-below-level

    unfamiliarCount++
    const sm2 = sm2Data[entry.lemma]
    if (sm2?.status === 'mastered') masteredCount++
  }

  if (unfamiliarCount === 0) return 100
  return Math.round((masteredCount / unfamiliarCount) * 100)
}
