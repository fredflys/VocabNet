import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { API } from '../utils/config'
import { scaleIn, modalTransition } from '../utils/motion'

const LANGUAGES = [
  'Chinese', 'Spanish', 'French', 'Japanese', 'Korean',
  'Arabic', 'Portuguese', 'German', 'Russian', 'Hindi',
  'Vietnamese', 'Thai', 'Indonesian', 'Italian', 'Turkish',
]

const PROVIDERS = [
  { id: 'gemini', label: 'Google Gemini', desc: 'SOTA 2.0 Flash' },
  { id: 'openai', label: 'OpenAI', desc: 'GPT-4o Intelligence' },
]

const CEFR_LEVELS = ['A2', 'B1', 'B2', 'C1']

export default function SettingsModal({ settings, onSave, onClose, onPlacementQuiz }) {
  const [draft, setDraft] = useState({ ...settings })
  const [voices, setVoices] = useState([])
  const [voicesLoading, setVoicesLoading] = useState(false)

  useEffect(() => {
    setVoicesLoading(true)
    fetch(`${API}/api/tts/voices`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setVoices(data)
      })
      .catch(() => {})
      .finally(() => setVoicesLoading(false))
  }, [])

  function handleSave() {
    onSave(draft)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        className="modal"
        {...scaleIn}
        transition={modalTransition}
        onClick={e => e.stopPropagation()}
        style={{ padding: '3.5rem', borderRadius: 'var(--radius-lg)' }}
      >
        <div style={{ marginBottom: '3rem' }}>
          <h2 className="serif-title" style={{ fontSize: '3rem' }}>Settings</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>Configure your study environment and AI access.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          {/* Proficiency Level */}
          <div className="setting-group">
            <label style={{ fontWeight: 700, display: 'block', marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>PROFICIENCY LEVEL</label>
            <div className="filter-pills" style={{ width: '100%' }}>
              {CEFR_LEVELS.map(l => (
                <button
                  key={l}
                  className={`filter-pill ${draft.cefrLevel === l ? 'filter-pill--active' : ''}`}
                  onClick={() => setDraft(d => ({ ...d, cefrLevel: l }))}
                  style={{ flex: 1 }}
                >
                  {l}
                </button>
              ))}
            </div>
            <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Words at or below this level are auto-classified as known.</p>
              {onPlacementQuiz && (
                <button
                  onClick={() => { onClose(); onPlacementQuiz() }}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline', whiteSpace: 'nowrap', marginLeft: '1rem' }}
                >
                  Take Placement Quiz
                </button>
              )}
            </div>
          </div>

          {/* Native Language */}
          <div className="setting-group">
            <label style={{ fontWeight: 700, display: 'block', marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>TARGET LANGUAGE</label>
            <select
              value={draft.nativeLanguage}
              onChange={e => setDraft(d => ({ ...d, nativeLanguage: e.target.value }))}
              style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-subtle)', fontWeight: 600 }}
            >
              {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          {/* Pronunciation Voice */}
          <div className="setting-group">
            <label style={{ fontWeight: 700, display: 'block', marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>TTS VOICE</label>
            {voicesLoading ? (
              <div style={{ padding: '1rem', background: 'var(--bg-subtle)', borderRadius: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Loading available voices...</div>
            ) : (
              <select
                value={draft.ttsVoice || 'en-US-AriaNeural'}
                onChange={e => setDraft(d => ({ ...d, ttsVoice: e.target.value }))}
                style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-subtle)', fontWeight: 600 }}
              >
                {voices.map(v => (
                  <option key={v.name} value={v.name}>
                    {v.short_name} — {v.gender}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* LLM Provider */}
          <div className="setting-group">
            <label style={{ fontWeight: 700, display: 'block', marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>AI INTELLIGENCE</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {PROVIDERS.map(p => (
                <div
                  key={p.id}
                  onClick={() => setDraft(d => ({ ...d, llmProvider: p.id }))}
                  style={{ 
                    cursor: 'pointer',
                    padding: '1.25rem',
                    borderRadius: '16px',
                    border: `2px solid ${draft.llmProvider === p.id ? 'var(--primary)' : 'var(--border)'}`,
                    background: draft.llmProvider === p.id ? 'rgba(var(--primary-rgb), 0.05)' : 'var(--bg-card)',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ fontWeight: 800, color: draft.llmProvider === p.id ? 'var(--primary)' : 'var(--text)' }}>{p.label}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{p.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* API Key */}
          <div className="setting-group">
            <label style={{ fontWeight: 700, display: 'block', marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>PROVIDER API KEY</label>
            <input
              type="password"
              placeholder="Paste secure key here..."
              value={draft.apiKey}
              onChange={e => setDraft(d => ({ ...d, apiKey: e.target.value }))}
              style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-subtle)', fontWeight: 600 }}
            />
          </div>
        </div>

        <div style={{ marginTop: '4rem', display: 'flex', gap: '1rem' }}>
          <button className="btn--secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
          <button className="btn--primary" onClick={handleSave} style={{ flex: 2 }}>Save Configuration</button>
        </div>
      </motion.div>
    </div>
  )
}
