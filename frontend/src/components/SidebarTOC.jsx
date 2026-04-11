import { motion } from 'framer-motion'
import { useState, useMemo } from 'react'

export default function SidebarTOC({ chapters, selectedChapter, onSelectChapter, isMaster }) {
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
    <div className="sidebar-toc" style={{
      width: '280px',
      height: 'calc(100vh - 160px)',
      position: 'sticky',
      top: '120px',
      background: 'var(--bg-card)',
      borderRadius: '24px',
      border: '1px solid var(--border)',
      padding: '1.5rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '1.5rem',
      boxShadow: 'var(--shadow-sm)',
      flexShrink: 0
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <h3 style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Archive Scope</h3>
        <button
          onClick={() => onSelectChapter(null)}
          className={`toc-item ${selectedChapter === null ? 'active' : ''}`}
          style={{
            padding: '0.8rem 1rem',
            borderRadius: '12px',
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
            width: '100%'
          }}
        >
          <span style={{ fontSize: '1.1rem' }}>📚</span> Full Archive
        </button>
      </div>

      <div style={{ position: 'relative' }}>
        <input
          type="text"
          placeholder="Search chapters..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '0.6rem 1rem',
            borderRadius: '10px',
            border: '1px solid var(--border)',
            background: 'var(--bg-subtle)',
            fontSize: '0.85rem',
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
        gap: '0.4rem',
        paddingRight: '0.5rem'
      }}>
        {filteredChapters.map((ch) => (
          <button
            key={ch.number}
            onClick={() => onSelectChapter(ch.number)}
            className={`toc-item ${selectedChapter === ch.number ? 'active' : ''}`}
            style={{
              padding: '0.6rem 0.8rem',
              borderRadius: '10px',
              border: '1px solid',
              borderColor: selectedChapter === ch.number ? 'var(--primary)' : 'transparent',
              background: selectedChapter === ch.number ? 'rgba(var(--primary-rgb), 0.1)' : 'transparent',
              color: selectedChapter === ch.number ? 'var(--primary)' : 'var(--text-muted)',
              textAlign: 'left',
              fontSize: '0.85rem',
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
            <span style={{ opacity: 0.5, marginRight: '0.6rem', fontFamily: 'monospace', fontSize: '0.75rem', width: '20px' }}>
              {ch.number.toString().padStart(2, '0')}
            </span>
            {ch.title}
          </button>
        ))}
      </div>
    </div>
  )
}
