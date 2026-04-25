/**
 * Persistence layer for study data.
 * Migrated from localStorage-only to Backend API with localStorage fallback.
 */
import { API } from './config'
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

export async function recordSession(session) {
  try {
    const res = await fetch(`${API}/api/user/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session)
    })
    if (!res.ok) console.error('Session recording failed:', res.status)
  } catch (e) {
    console.error('Failed to record session on backend', e)
  }
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
    console.error('Failed to fetch user stats from backend', e)
  }
  return { streak_count: 0, last_study_date: null }
}

// Stub for local component compatibility
export function updateStreak() {
  // Now handled by the backend's /api/user/session automatically.
}

// ── Profile ────────────────────────────────────────────────────────────────

export async function fetchProfile() {
  try {
    const res = await fetch(`${API}/api/user/profile`)
    if (res.ok) return await res.json()
  } catch (e) {
    console.error('Failed to fetch profile', e)
  }
  return { cefr_level: 'B1' }
}

export async function updateProfile(data) {
  try {
    const res = await fetch(`${API}/api/user/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (res.ok) return await res.json()
  } catch (e) {
    console.error('Failed to update profile', e)
  }
  return null
}

export async function triggerAutoMaster() {
  try {
    const res = await fetch(`${API}/api/user/auto-master`, { method: 'POST' })
    if (res.ok) return await res.json()
  } catch (e) {
    console.error('Failed to trigger auto-master', e)
  }
  return { auto_mastered_count: 0 }
}
