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

/**
 * Get words for a study session, prioritized correctly.
 * @param {Array} vocab - full vocab array from pipeline
 * @param {object} sm2Data - { [lemma]: SM2State }
 * @param {Set} knownWords - words marked as known
 * @param {number} maxCards - max cards per session
 * @param {number|null} chapterFilter - if set, only include words from this chapter
 * @returns {Array} selected vocab entries for this session
 */
export function getStudySession(vocab, sm2Data, knownWords, maxCards = 20, chapterFilter = null) {
  const due = []
  const newWords = []

  for (const entry of vocab) {
    if (knownWords.has(entry.lemma)) continue

    const sm2 = sm2Data[entry.lemma]
    // Skip auto-mastered words — they don't need study
    if (sm2?.mastery_source === 'auto') continue

    // Chapter filter: skip words not in the selected chapter
    if (chapterFilter != null && chapterFilter > 0) {
      const chapters = entry.chapters || []
      if (chapters.length > 0 && !chapters.includes(chapterFilter)) continue
    }

    if (!sm2 || sm2.status === 'new') {
      newWords.push(entry)
    } else if (sm2.status === 'mastered') {
      // Only include mastered if due
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
 * @returns {number} 0-100
 */
export function calcReadiness(vocab, sm2Data, knownWords) {
  if (vocab.length === 0) return 100
  let score = 0
  let total = 0

  for (const entry of vocab) {
    const sm2 = sm2Data[entry.lemma]
    // Exclude auto-mastered words from readiness calculation entirely
    if (sm2?.mastery_source === 'auto') continue

    total += 1

    if (knownWords.has(entry.lemma)) {
      score += 1
      continue
    }
    if (!sm2) continue
    if (sm2.status === 'mastered') score += 1
    else if (sm2.status === 'review') score += 0.5
    else if (sm2.status === 'learning') score += 0.25
  }

  if (total === 0) return 100
  return Math.round((score / total) * 100)
}
