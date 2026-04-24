import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { loadSM2DataLocal, saveSM2DataLocal, fetchSM2DataGlobal, updateSM2DataGlobal, recordSession } from '../../src/utils/studyStore'

describe('studyStore', () => {
  let localStorageMock

  beforeEach(() => {
    localStorageMock = {}
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key) => localStorageMock[key] || null),
      setItem: vi.fn((key, value) => { localStorageMock[key] = value }),
      removeItem: vi.fn((key) => { delete localStorageMock[key] }),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('loadSM2DataLocal', () => {
    it('should return empty object when nothing is stored', () => {
      expect(loadSM2DataLocal()).toEqual({})
    })

    it('should parse stored JSON data', () => {
      localStorageMock['vocabnet_sm2'] = JSON.stringify({ hello: { ease: 2.5 } })
      expect(loadSM2DataLocal()).toEqual({ hello: { ease: 2.5 } })
    })

    it('should return empty object on invalid JSON', () => {
      localStorageMock['vocabnet_sm2'] = 'not-json'
      expect(loadSM2DataLocal()).toEqual({})
    })
  })

  describe('saveSM2DataLocal', () => {
    it('should save data to localStorage', () => {
      const data = { test: { ease: 2.5 } }
      saveSM2DataLocal(data)
      expect(localStorage.setItem).toHaveBeenCalledWith('vocabnet_sm2', JSON.stringify(data))
    })
  })

  describe('fetchSM2DataGlobal', () => {
    it('should fetch from API and save locally on success', async () => {
      const mockData = { hello: { ease: 2.5, status: 'review' } }
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      })

      const result = await fetchSM2DataGlobal()
      expect(result).toEqual(mockData)
      expect(localStorage.setItem).toHaveBeenCalled()
    })

    it('should fall back to local data on API failure', async () => {
      localStorageMock['vocabnet_sm2'] = JSON.stringify({ local: { ease: 2.0 } })
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      const result = await fetchSM2DataGlobal()
      expect(result).toEqual({ local: { ease: 2.0 } })
    })

    it('should fall back to local data on non-ok response', async () => {
      localStorageMock['vocabnet_sm2'] = JSON.stringify({ local: { ease: 2.0 } })
      global.fetch = vi.fn().mockResolvedValue({ ok: false })

      const result = await fetchSM2DataGlobal()
      expect(result).toEqual({ local: { ease: 2.0 } })
    })
  })

  describe('updateSM2DataGlobal', () => {
    it('should merge new data into local storage', async () => {
      localStorageMock['vocabnet_sm2'] = JSON.stringify({ old: { ease: 2.0 } })
      global.fetch = vi.fn().mockResolvedValue({ ok: true })

      const result = await updateSM2DataGlobal({ new_word: { ease: 2.5 } })
      expect(result).toEqual({ old: { ease: 2.0 }, new_word: { ease: 2.5 } })
    })

    it('should sync to backend via POST', async () => {
      localStorageMock['vocabnet_sm2'] = JSON.stringify({})
      global.fetch = vi.fn().mockResolvedValue({ ok: true })

      await updateSM2DataGlobal({ test: { ease: 2.5 } })
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/user/vocab'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test: { ease: 2.5 } }),
        })
      )
    })

    it('should not throw when backend sync fails', async () => {
      localStorageMock['vocabnet_sm2'] = JSON.stringify({})
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await updateSM2DataGlobal({ test: { ease: 2.5 } })
      expect(result).toEqual({ test: { ease: 2.5 } })
      consoleSpy.mockRestore()
    })
  })

  describe('recordSession', () => {
    it('should POST session data to the API', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true })

      await recordSession({ mode: 'flashcard', wordsReviewed: 10, wordsCorrect: 8 })
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/user/session'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'flashcard', wordsReviewed: 10, wordsCorrect: 8 }),
        })
      )
    })

    it('should log error on non-ok response', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 })
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await recordSession({ mode: 'flashcard' })
      expect(consoleSpy).toHaveBeenCalledWith('Session recording failed:', 500)
      consoleSpy.mockRestore()
    })

    it('should not throw on network error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('offline'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(recordSession({ mode: 'flashcard' })).resolves.not.toThrow()
      consoleSpy.mockRestore()
    })
  })
})
