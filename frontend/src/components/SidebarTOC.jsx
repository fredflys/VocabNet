import { motion, AnimatePresence } from 'framer-motion'
import { useState, useMemo } from 'react'

export default function SidebarTOC({ chapters, selectedChapter, onSelectChapter, isMaster, isOpen, onClose }) {
  const [search, setSearch] = useState('')

  const filteredChapters = useMemo(() => {
    if (!search) return chapters
    return (chapters || []).filter(ch => 
      (ch.title || '').toLowerCase().includes(search.toLowerCase()) || 
      ch.number.toString() === search
    )
  }, [chapters, search])

  if (isMaster || !chapters || chapters.length === 0) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop Blur Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.2)',
              backdropFilter: 'blur(8px)',
              zIndex: 9000,
              cursor: 'pointer'
            }}
          />

          {/* The Archivist Drawer */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{
              position: 'fixed',
              left: 0,
              top: 0,
              bottom: 0,
              width: '320px',
              background: 'var(--bg-card)',
              borderRight: '1px solid var(--border)',
              padding: '2.5rem 1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '2rem',
              boxShadow: '30px 0 60px rgba(0,0,0,0.1)',
              zIndex: 9001,
              overflow: 'hidden'
            }}
          >
            {/* Grab Handle for Visual Affordance */}
            <div style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '4px',
              height: '40px',
              background: 'var(--border)',
              borderRadius: '2px',
              opacity: 0.5
            }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Archive Scope</h3>
                <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', opacity: 0.5 }}>×</button>
              </div>
              <button
                onClick={() => { onSelectChapter(null); onClose(); }}
                className={`toc-item ${selectedChapter === null ? 'active' : ''}`}
                style={{
                  padding: '1rem',
                  borderRadius: '14px',
                  border: '1px solid',
                  borderColor: selectedChapter === null ? 'var(--primary)' : 'transparent',
                  background: selectedChapter === null ? 'var(--primary)' : 'var(--bg-subtle)',
                  color: selectedChapter === null ? 'white' : 'var(--text)',
                  textAlign: 'left',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  transition: 'all 0.2s',
                  width: '100%',
                  fontSize: '0.95rem'
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>📚</span> Full Archive
              </button>
            </div>

            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>🔍</span>
              <input
                type="text"
                placeholder="Search chapters..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.8rem 1rem 0.8rem 2.5rem',
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-subtle)',
                  fontSize: '0.9rem',
                  outline: 'none',
                  color: 'var(--text)'
                }}
              />
            </div>

            <div className="toc-list" style={{ 
              flex: 1, 
              overflowY: 'auto', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '0.5rem',
              paddingRight: '0.5rem',
              margin: '0 -0.5rem'
            }}>
              {filteredChapters.map((ch) => (
                <button
                  key={ch.number}
                  onClick={() => { onSelectChapter(ch.number); onClose(); }}
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '12px',
                    border: 'none',
                    background: selectedChapter === ch.number ? 'rgba(var(--primary-rgb), 0.1)' : 'transparent',
                    color: selectedChapter === ch.number ? 'var(--primary)' : 'var(--text)',
                    textAlign: 'left',
                    fontSize: '0.9rem',
                    fontWeight: selectedChapter === ch.number ? 800 : 500,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title={ch.title}
                >
                  <span style={{ opacity: 0.5, marginRight: '0.8rem', fontFamily: 'monospace', fontSize: '0.8rem', width: '24px' }}>
                    {ch.number.toString().padStart(2, '0')}
                  </span>
                  {ch.title}
                </button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
