import { useState, useEffect, useMemo, useContext } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AppContext } from '../App'
import CollapsibleList from './common/CollapsibleList'

const API = 'http://localhost:8000'

/**
 * High-performance highlighter using optimized Regex for multiple word forms.
 */
function HighlightedSentence({ sentence, lemma, inflections = [] }) {
  if (!sentence) return null
  
  // Combine lemma and inflections into a single capture group
  // Standardize inflections to include the lemma itself
  const forms = Array.from(new Set([lemma.toLowerCase(), ...inflections.map(f => f.toLowerCase())]))
  const pattern = `(\\b(?:${forms.join('|')})\\w*\\b)`
  const regex = new RegExp(pattern, 'gi')
  
  const parts = sentence.split(regex)
  
  return (
    <span>
      {parts.map((part, i) => 
        regex.test(part) ? (
          <strong key={i} style={{ 
            color: 'var(--primary)', 
            background: 'rgba(var(--primary-rgb), 0.12)', 
            padding: '0 4px', 
            borderRadius: '4px',
            fontWeight: 700
          }}>{part}</strong>
        ) : part
      )}
    </span>
  )
}

export default function WordDetailModal({ entry, onClose, onSpeak, onSelectBook }) {
  const { setIsLoading } = useContext(AppContext)
  const [crossContexts, setCrossContexts] = useState([])
  const [loadingCross, setLoadingCross] = useState(false)
  const [dictData, setDictData] = useState(null)
  const [loadingDict, setLoadingDict] = useState(false)

  const isMasterView = entry.book_id === 'master'

  useEffect(() => {
    if (!entry) return
    
    const loadData = async () => {
      setIsLoading(true)
      setLoadingCross(true)
      setLoadingDict(true)
      
      try {
        // Task 1 Refinement: Exclude current book on the server side
        // Safety: ensure book_id is valid string and not 'undefined'
        const bId = (entry && entry.book_id && entry.book_id !== 'undefined') ? entry.book_id : null
        const excludeParam = (bId && !isMasterView) ? `?exclude_book_id=${bId}` : ''
        
        const [ctxResp, dictResp] = await Promise.all([
          fetch(`${API}/api/contexts/${encodeURIComponent(entry.lemma)}${excludeParam}`),
          fetch(`${API}/api/dictionary/${encodeURIComponent(entry.lemma)}`)
        ])
        
        const ctxData = await ctxResp.json()
        const dData = await dictResp.json()
        
        setCrossContexts(ctxData.results || [])
        setDictData(dData)
      } catch (err) {
        console.error('Failed to load modal data', err)
      } finally {
        setLoadingCross(false)
        setLoadingDict(false)
        setIsLoading(false)
      }
    }
    
    loadData()
  }, [entry, setIsLoading, isMasterView])

  if (!entry) return null
  
  const bookExamples = (entry.examples || (entry.example ? [entry.example] : [])).slice(0, 20)
  const inflections = dictData?.inflections || entry.inflections || []

  return (
    <div className="modal-overlay" onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <motion.div 
        className="modal"
        initial={{ opacity: 0, scale: 0.95, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 30 }}
        onClick={e => e.stopPropagation()}
        style={{ 
          maxWidth: '1100px', 
          width: '95%', 
          height: 'min(900px, 90vh)',
          padding: 0, // We handle padding in tiers
          borderRadius: '28px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 40px 100px rgba(0,0,0,0.25)'
        }}
      >
        {/* Tier 1: Fixed Header */}
        <header style={{ 
          padding: '2.5rem 3.5rem', 
          borderBottom: '1px solid var(--border)', 
          background: 'var(--bg-card)',
          zIndex: 10,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <h2 className="serif-title" style={{ fontSize: '3.5rem', margin: 0, lineHeight: 1 }}>{entry.lemma}</h2>
              <button 
                className="btn--secondary" 
                onClick={() => onSpeak(entry.lemma)} 
                style={{ width: '54px', height: '54px', borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', fontSize: '1.5rem' }}
              >🔊</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1.25rem' }}>
              {entry.cefr && <span className="badge badge-indigo" style={{ fontSize: '0.9rem' }}>{entry.cefr}</span>}
              <span className="badge" style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                {entry.pos?.toLowerCase() || dictData?.pos?.toLowerCase()}
              </span>
              {(entry.phonetics || dictData?.phonetics) && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                  {entry.phonetics || dictData?.phonetics}
                </span>
              )}
            </div>
          </div>
          <button 
            onClick={onClose}
            style={{ background: 'var(--bg-subtle)', border: 'none', width: '44px', height: '44px', borderRadius: '50%', cursor: 'pointer', fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}
          >×</button>
        </header>

        {/* Tier 2: Dual-Pane Scrolling Body */}
        <div style={{ 
          flex: 1, 
          display: 'grid', 
          gridTemplateColumns: '1fr 1.2fr', 
          overflow: 'hidden' // Important: body itself doesn't scroll, columns do
        }}>
          {/* Left Column: Linguistic Insights */}
          <div style={{ 
            padding: '3rem 3.5rem', 
            overflowY: 'auto', 
            borderRight: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '3.5rem',
            background: 'rgba(var(--primary-rgb), 0.01)'
          }}>
            <section>
              <h4 style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 900, letterSpacing: '0.15em', marginBottom: '1.5rem' }}>Study Context</h4>
              <div style={{ background: 'var(--bg-subtle)', padding: '2rem', borderRadius: '20px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                {(entry.translation || dictData?.definition) && (
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '1rem', lineHeight: 1.2 }}>
                    {entry.translation || dictData?.definition}
                  </div>
                )}
                {entry.simple_def && (
                  <p style={{ fontSize: '1.1rem', lineHeight: 1.6, margin: 0, opacity: 0.9 }}>{entry.simple_def}</p>
                )}
                {entry.memory_tip && (
                  <div style={{ marginTop: '1.5rem', padding: '1rem 1.25rem', background: 'rgba(245, 158, 11, 0.08)', borderRadius: '12px', color: 'var(--accent)', fontWeight: 700, fontSize: '0.9rem', display: 'flex', gap: '0.75rem' }}>
                    <span>💡</span> {entry.memory_tip}
                  </div>
                )}
              </div>
            </section>

            <section>
              <h4 style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 900, letterSpacing: '0.15em', marginBottom: '1.5rem' }}>Lexical Forms</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                {inflections.length > 0 ? inflections.map(f => (
                  <span key={f} style={{ padding: '0.4rem 0.8rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600 }}>{f}</span>
                )) : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Standard form only</span>}
              </div>
            </section>

            <section>
              <h4 style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 900, letterSpacing: '0.15em', marginBottom: '1.5rem' }}>Full Dictionary</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {loadingDict ? (
                  <div className="shimmer" style={{ height: '100px', borderRadius: '16px' }} />
                ) : !dictData || !dictData.all_meanings || dictData.all_meanings.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', background: 'var(--bg-subtle)', borderRadius: '16px', border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>No extended dictionary data found.</div>
                ) : (
                  dictData.all_meanings.map((m, i) => (
                    <div key={i}>
                      <div style={{ fontWeight: 900, fontSize: '0.7rem', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }} />
                        {m.partOfSpeech}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {m.definitions.map((d, j) => (
                          <div key={j} style={{ fontSize: '1.05rem', lineHeight: 1.5, color: 'var(--text)' }}>
                            {d.definition}
                            {d.example && (
                              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.5rem', paddingLeft: '1rem', borderLeft: '2px solid var(--border)' }}>
                                "<HighlightedSentence sentence={d.example} lemma={entry.lemma} inflections={inflections} />"
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          {/* Right Column: Archive Instances */}
          <div style={{ 
            padding: '3rem 3.5rem', 
            overflowY: 'auto', 
            display: 'flex',
            flexDirection: 'column',
            gap: '3.5rem'
          }}>
            <section>
              <h4 style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 900, letterSpacing: '0.15em', marginBottom: '1.5rem' }}>Instances in this Volume</h4>
              <CollapsibleList 
                items={bookExamples}
                label="occurrences"
                renderItem={(ex, i) => (
                  <div key={i} style={{ 
                    padding: '1.5rem', 
                    background: 'var(--bg-card)', 
                    borderRadius: '16px', 
                    border: '1px solid var(--border)', 
                    fontSize: '1.05rem', 
                    fontStyle: 'italic', 
                    lineHeight: 1.6, 
                    borderLeft: '4px solid var(--primary)', 
                    boxShadow: 'var(--shadow-sm)' 
                  }}>
                    "<HighlightedSentence sentence={ex} lemma={entry.lemma} inflections={inflections} />"
                  </div>
                )}
              />
            </section>

            <section style={{ borderTop: '1px solid var(--border)', paddingTop: '3rem' }}>
              <h4 style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 900, letterSpacing: '0.15em', marginBottom: '1.5rem' }}>
                {isMasterView ? 'Global Archive Appearances' : 'Appearances in Other Volumes'}
              </h4>
              
              {loadingCross ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="shimmer" style={{ height: '80px', borderRadius: '12px' }} />
                  <div className="shimmer" style={{ height: '80px', borderRadius: '12px' }} />
                </div>
              ) : crossContexts.length === 0 ? (
                <div style={{ padding: '3rem 2rem', textAlign: 'center', background: 'var(--bg-subtle)', borderRadius: '20px', border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📚</div>
                  Unique to this volume.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                  {crossContexts.map((res, i) => (
                    <div key={i}>
                      <button 
                        onClick={() => { onClose(); onSelectBook(res.book_id) }}
                        style={{ background: 'rgba(var(--primary-rgb), 0.05)', border: '1px solid rgba(var(--primary-rgb), 0.1)', padding: '0.5rem 1rem', borderRadius: '10px', textAlign: 'left', cursor: 'pointer', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                      >
                        <span style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          From: {res.title}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>↗</span>
                      </button>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {res.examples.slice(0, 3).map((ex, j) => (
                          <div key={j} style={{ padding: '1.25rem', background: 'var(--bg-subtle)', borderRadius: '14px', fontSize: '0.95rem', fontStyle: 'italic', color: 'var(--text)', border: '1px solid var(--border)' }}>
                            "<HighlightedSentence sentence={ex} lemma={entry.lemma} inflections={inflections} />"
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

        {/* Tier 3: Fixed Footer */}
        <footer style={{ 
          padding: '1.5rem 3.5rem', 
          borderTop: '1px solid var(--border)', 
          background: 'var(--bg-card)',
          display: 'flex',
          justifyContent: 'center',
          zIndex: 10
        }}>
          <button 
            className="btn--primary" 
            onClick={onClose}
            style={{ width: '100%', padding: '1.25rem', fontSize: '1.1rem', fontWeight: 800, borderRadius: '16px' }}
          >
            Return to Ledger
          </button>
        </footer>
      </motion.div>
    </div>
  )
}
