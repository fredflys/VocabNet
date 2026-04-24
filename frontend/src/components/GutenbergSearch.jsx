import { useState, useCallback } from 'react'
import { API } from '../utils/config'

export default function GutenbergSearch({ onStart, settings }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [fetchingId, setFetchingId] = useState(null)
  const [error, setError] = useState('')

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return
    setSearching(true)
    setError('')
    setResults(null)

    try {
      const res = await fetch(`${API}/api/gutenberg/search?query=${encodeURIComponent(query.trim())}`)
      if (!res.ok) throw new Error('Search failed')
      const data = await res.json()
      setResults(data.results || [])
    } catch (e) {
      setError('Search failed. Please check your connection.')
    } finally {
      setSearching(false)
    }
  }, [query])

  const handleFetch = useCallback(async (book) => {
    setFetchingId(book.id)
    setError('')

    try {
      const body = new FormData()
      body.append('gutenberg_id', book.id)
      body.append('title', book.title)
      body.append('level', settings.level || 'B1')
      body.append('native_language', settings.nativeLanguage || 'Chinese')
      body.append('llm_provider', settings.llmProvider || 'gemini')
      body.append('api_key', settings.apiKey || '')

      const res = await fetch(`${API}/api/gutenberg/fetch`, { method: 'POST', body })
      if (!res.ok) throw new Error('Fetch failed')
      const data = await res.json()
      onStart(data.job_id, book.title)
    } catch (e) {
      setError(`Failed to fetch "${book.title}". Please try again.`)
      setFetchingId(null)
    }
  }, [settings, onStart])

  return (
    <div className="gutenberg">
      <div className="search-input-wrapper" style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <input
          type="text"
          placeholder="Search author or title (e.g. Dickens, Pride and Prejudice)..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-subtle)' }}
        />
        <button
          className="btn--primary"
          onClick={handleSearch}
          disabled={searching || !query.trim()}
        >
          {searching ? '...' : 'Search'}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {results && results.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No volumes found matching your query.</div>
        )}

        {results && results.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {results.map(book => (
              <div key={book.id} style={{ padding: '1rem', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{book.title}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{book.author}</div>
                </div>
                <button
                  className="btn--secondary"
                  onClick={() => handleFetch(book)}
                  disabled={fetchingId === book.id}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                >
                  {fetchingId === book.id ? 'Fetching...' : 'Select'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
