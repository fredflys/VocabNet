/**
 * Persistence layer for study data.
 * Migrated from localStorage-only to Backend API with localStorage fallback.
 */
const API = 'http://localhost:8000'
const SM2_KEY = 'vocabnet_sm2'

// ── SM-2 state ──────────────────────────────────────────────────────────────

export function loadSM2DataLocal() {
  try {
    return JSON.parse(localStorage.getItem(SM2_KEY) || '{}')
  } catch {
    return {}
  }
}

export function saveSM2DataLocal(data) {
  localStorage.setItem(SM2_KEY, JSON.stringify(data))
}

export async function fetchSM2DataGlobal() {
  try {
    const res = await fetch(`${API}/api/user/vocab`)
    if (res.ok) {
      const data = await res.json()
      saveSM2DataLocal(data)
      return data
    }
  } catch (e) {
    console.error('Failed to sync global vocab from backend. Using local cache.')
  }
  return loadSM2DataLocal()
}

export async function updateSM2DataGlobal(data) {
  const localData = loadSM2DataLocal()
  // Merge new data into local
  Object.assign(localData, data)
  saveSM2DataLocal(localData)
  
  // Async sync to backend
  try {
    await fetch(`${API}/api/user/vocab`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
  } catch (e) {
    console.error('Failed to sync word to backend', e)
  }
  
  return localData
}

// ── Session history ─────────────────────────────────────────────────────────

export function recordSession(session) {
  fetch(`${API}/api/user/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(session)
  }).catch(e => console.error('Failed to record session on backend', e))
}

// ── Streak ──────────────────────────────────────────────────────────────────

export async function fetchUserStats() {
  try {
    const res = await fetch(`${API}/api/user/stats`)
    if (res.ok) {
      const data = await res.json()
      return data.stats
    }
  } catch (e) {
    console.error('Failed to fetch user stats from backend')
  }
  return { streak_count: 0, last_study_date: null }
}

// Stub for local component compatibility
export function updateStreak() {
  // Now handled by the backend's /api/user/session automatically.
}
