import { useState, useEffect, useMemo, useContext } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AppContext } from '../App'

const API = 'http://localhost:8000'

/**
 * Safely highlights the target word/phrase in a sentence using regex.
 */
function HighlightedSentence({ sentence, lemma }) {
  if (!sentence) return null
  const regex = new RegExp(`(\\b${lemma}\\w*\\b)`, 'gi')
  const parts = sentence.split(regex)
  return (
    <span>
      {parts.map((part, i) => 
        regex.test(part) ? (
          <strong key={i} style={{ color: 'var(--primary)', background: 'rgba(var(--primary-rgb), 0.1)', padding: '0 2px', borderRadius: '2px' }}>{part}</strong>
        ) : part
      )}
    </span>
  )
}

export default function WordDetailModal({ entry, onClose, onSpeak, onSelectBook }) {
  const { setIsLoading } = useContext(AppContext)
  const [allContexts, setAllContexts] = useState([])
  const [loadingCross, setLoadingCross] = useState(false)
  const [dictData, setDictData] = useState(null)
  const [loadingDict, setLoadingDict] = useState(false)

  useEffect(() => {
    if (!entry) return
    
    const loadData = async () => {
      setIsLoading(true)
      setLoadingCross(true)
      
      try {
        const [ctxResp, dictResp] = await Promise.all([
          fetch(`${API}/api/contexts/${encodeURIComponent(entry.lemma)}`),
          fetch(`${API}/api/dictionary/${encodeURIComponent(entry.lemma)}`)
        ])
        
        const ctxData = await ctxResp.json()
        const dictData = await dictResp.json()
        
        setAllContexts(ctxData.results || [])
        setDictData(dictData)
      } catch (err) {
        console.error('Failed to load modal data', err)
      } finally {
        setLoadingCross(false)
        setIsLoading(false)
      }
    }
    
    loadData()
  }, [entry, setIsLoading])

  const crossContexts = useMemo(() => {
    return allContexts.filter(res => res.book_id !== entry.book_id)
  }, [allContexts, entry.book_id])

  if (!entry) return null
  const bookExamples = (entry.examples || (entry.example ? [entry.example] : [])).slice(0, 10)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div 
        className="modal"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '900px', width: '95%', padding: '3.5rem', borderRadius: 'var(--radius-lg)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem' }}>
          <div>
            <h2 className="serif-title" style={{ fontSize: '4rem', margin: 0, lineHeight: 1 }}>{entry.lemma}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1rem' }}>
              {entry.cefr && <span className="badge badge-indigo">{entry.cefr}</span>}
              <span className="badge" style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>{entry.pos?.toLowerCase() || dictData?.pos?.toLowerCase()}</span>
              {(entry.phonetics || dictData?.phonetics) && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', color: 'var(--text-muted)' }}>
                  {entry.phonetics || dictData?.phonetics}
                </span>
              )}
            </div>
          </div>
          <button className="btn--secondary" onClick={() => onSpeak(entry.lemma)} style={{ fontSize: '2rem', padding: '1rem', borderRadius: '50%', width: '70px', height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🔊</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
            <section>
              <h4 style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.1em', marginBottom: '1.25rem' }}>STUDY DATA</h4>
              <div style={{ background: 'var(--bg-subtle)', padding: '2rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                {entry.translation && (
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '1rem' }}>{entry.translation}</div>
                )}
                {entry.simple_def && (
                  <p style={{ fontSize: '1.1rem', lineHeight: 1.6, margin: 0 }}><strong>Simplified:</strong> {entry.simple_def}</p>
                )}
                {entry.memory_tip && (
                  <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '12px', color: 'var(--accent)', fontWeight: 600, fontSize: '0.95rem' }}>
                    💡 Tip: {entry.memory_tip}
                  </div>
                )}
              </div>
            </section>

            <section>
              <h4 style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.1em', marginBottom: '1.25rem' }}>DICTIONARY DEFINITIONS</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {loadingDict ? (
                  <div className="shimmer" style={{ padding: '2rem', textAlign: 'center', borderRadius: '12px' }}>Consulting archives...</div>
                ) : !dictData || !dictData.all_meanings || dictData.all_meanings.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', background: 'var(--bg-subtle)', borderRadius: '12px', border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
                    No formal dictionary entry found.
                  </div>
                ) : (
                  dictData.all_meanings.map((m, i) => (
                    <div key={i} style={{ borderBottom: i < dictData.all_meanings.length - 1 ? '1px solid var(--border)' : 'none', paddingBottom: '1.5rem' }}>
                      <div style={{ fontWeight: 800, fontSize: '0.75rem', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>{m.partOfSpeech}</div>
                      <ul style={{ margin: 0, paddingLeft: '1.2rem', listStyleType: 'decimal' }}>
                        {m.definitions.map((d, j) => (
                          <li key={j} style={{ marginBottom: '0.75rem', fontSize: '1rem', lineHeight: 1.5 }}>
                            <div>{d.definition}</div>
                            {d.example && (
                              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.25rem' }}>
                                "<HighlightedSentence sentence={d.example} lemma={entry.lemma} />"
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
            <section>
              <h4 style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.1em', marginBottom: '1.25rem' }}>CONTEXT IN THIS VOLUME ({bookExamples.length})</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {bookExamples.map((ex, i) => (
                  <div key={i} style={{ padding: '1.25rem', background: 'var(--bg-subtle)', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '1rem', fontStyle: 'italic', lineHeight: 1.5, borderLeft: '4px solid var(--primary)', boxShadow: 'var(--shadow-sm)' }}>
                    "<HighlightedSentence sentence={ex} lemma={entry.lemma} />"
                  </div>
                ))}
              </div>
            </section>

            <section style={{ borderTop: '1px solid var(--border)', paddingTop: '3rem' }}>
              <h4 style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.1em', marginBottom: '1.25rem' }}>APPEARANCES IN OTHER VOLUMES</h4>
              
              {loadingCross ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Scanning your archives...</div>
              ) : crossContexts.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', background: 'var(--bg-subtle)', borderRadius: '12px', border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
                  No other volumes in your library contain this word.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  {crossContexts.map((res, i) => (
                    <div key={i}>
                      <button 
                        onClick={() => { onClose(); onSelectBook(res.book_id) }}
                        style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', width: '100%' }}
                      >
                        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '0.75rem', letterSpacing: '0.05em', textDecoration: 'underline' }}>
                          FROM: {res.title.toUpperCase()}
                        </div>
                      </button>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {res.examples.map((ex, j) => (
                          <div key={j} style={{ padding: '1rem', background: 'var(--bg-subtle)', borderRadius: '10px', fontSize: '0.9rem', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                            "<HighlightedSentence sentence={ex} lemma={entry.lemma} />"
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>

        <button 
          className="btn--primary" 
          onClick={onClose}
          style={{ width: '100%', marginTop: '4rem', padding: '1.5rem', fontSize: '1.25rem', borderRadius: '16px' }}
        >
          Return to Ledger
        </button>
      </motion.div>
    </div>
  )
}
