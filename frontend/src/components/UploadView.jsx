import { useState, useRef } from 'react'
import GutenbergSearch from './GutenbergSearch'
import { motion, useAnimation } from 'framer-motion'

const CEFR_LEVELS = ['A2', 'B1', 'B2', 'C1']
const ACCEPTED_TYPES = '.txt,.epub'

export default function UploadView({ onProcessing, settings, onBack }) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [file, setFile] = useState(null)
  const [level, setLevel] = useState(settings?.level || 'B1')
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('file')
  const inputRef = useRef()
  const controls = useAnimation()

  function handleFile(f) {
    if (!f) return
    const ext = f.name.split('.').pop()?.toLowerCase()
    if (!['txt', 'epub'].includes(ext)) {
      setError('Please upload a .txt or .epub file.')
      setFile(null)
      return
    }
    setError('')
    setFile(f)
  }

  async function handleSubmit() {
    if (!file) {
      setError('Please upload a book first to begin the analysis.')
      // Trigger Vibration Animation
      controls.start({
        x: [0, -10, 10, -10, 10, 0],
        transition: { duration: 0.4 }
      })
      return
    }
    setIsUploading(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('level', level)
      formData.append('native_language', settings?.nativeLanguage || 'Chinese')
      formData.append('llm_provider', settings?.llmProvider || 'gemini')
      formData.append('api_key', settings?.apiKey || '')

      const res = await fetch('http://localhost:8000/api/upload', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Upload failed')
      const { job_id } = await res.json()
      onProcessing(job_id, file.name)
    } catch (err) {
      setError(err.message)
      setIsUploading(false)
    }
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <header style={{ textAlign: 'center', marginBottom: '4rem' }}>
        <button className="btn--secondary" onClick={onBack} style={{ marginBottom: '2rem' }}>⬅ Back to Library</button>
        <h2 className="serif-title" style={{ fontSize: '4rem' }}>New Archive</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginTop: '1rem' }}>
          Expand your library with public domain classics or your own volumes.
        </p>
      </header>

      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '3rem', boxShadow: 'var(--shadow)' }}>
        <div className="filter-pills" style={{ marginBottom: '3rem', width: 'fit-content', margin: '0 auto 3rem' }}>
          <button className={`filter-pill ${tab === 'file' ? 'filter-pill--active' : ''}`} onClick={() => setTab('file')}>📎 LOCAL FILE</button>
          <button className={`filter-pill ${tab === 'gutenberg' ? 'filter-pill--active' : ''}`} onClick={() => setTab('gutenberg')}>📚 GUTENBERG SEARCH</button>
        </div>

        {tab === 'file' ? (
          <div>
            <div
              onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={e => { e.preventDefault(); setIsDragOver(false); handleFile(e.dataTransfer.files?.[0]) }}
              onClick={() => inputRef.current?.click()}
              style={{ 
                height: '240px', 
                border: `2px dashed ${isDragOver ? 'var(--primary)' : 'var(--border)'}`, 
                borderRadius: 'var(--radius)', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center',
                background: isDragOver ? 'var(--bg-subtle)' : 'transparent',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <input ref={inputRef} type="file" accept={ACCEPTED_TYPES} style={{ display: 'none' }} onChange={e => handleFile(e.target.files?.[0])} />
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{file ? '📑' : '☁️'}</div>
              <div style={{ fontWeight: 700 }}>{file ? file.name : 'Drop your volume here'}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>EPUB or TXT, max 5MB</div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="error-banner" 
                style={{ marginTop: '1.5rem', textAlign: 'center', fontWeight: 600 }}
              >
                ⚠️ {error}
              </motion.div>
            )}

            <motion.button 
              animate={controls}
              className="btn--primary" 
              onClick={handleSubmit} 
              disabled={isUploading}
              style={{ width: '100%', marginTop: '2.5rem', padding: '1.25rem', fontSize: '1.1rem', fontWeight: 800 }}
            >
              {isUploading ? 'CATALOGING...' : 'BEGIN ANALYSIS'}
            </motion.button>
          </div>
        ) : (
          <GutenbergSearch onStart={onProcessing} settings={{ ...settings, level }} />
        )}

        <div style={{ marginTop: '3rem', paddingTop: '3rem', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <span style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.85rem', letterSpacing: '0.05em' }}>TARGET PROFICIENCY</span>
            <span className="badge badge-indigo">{level}</span>
          </div>
          <div className="filter-pills" style={{ width: '100%' }}>
            {CEFR_LEVELS.map(l => (
              <button 
                key={l} 
                className={`filter-pill ${level === l ? 'filter-pill--active' : ''}`} 
                onClick={() => setLevel(l)}
                style={{ flex: 1 }}
              >
                {l}
              </button>
            ))}
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '1rem', textAlign: 'center' }}>
            Words classified at or below this level will be marked as "Known" automatically.
          </p>
        </div>
      </div>
    </div>
  )
}
