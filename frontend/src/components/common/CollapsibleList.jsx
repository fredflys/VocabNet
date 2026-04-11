import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function CollapsibleList({ items, renderItem, initialCount = 3, label = "items" }) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  if (!items || items.length === 0) return null
  
  const displayedItems = isExpanded ? items : items.slice(0, initialCount)
  const remainingCount = items.length - initialCount

  return (
    <div className="collapsible-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
        {displayedItems.map((item, index) => renderItem(item, index))}
        
        {!isExpanded && remainingCount > 0 && (
          <div style={{ 
            position: 'absolute', 
            bottom: 0, 
            left: 0, 
            right: 0, 
            height: '60px', 
            background: 'linear-gradient(to bottom, transparent, var(--bg-card))',
            pointerEvents: 'none'
          }} />
        )}
      </div>

      {remainingCount > 0 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            alignSelf: 'center',
            background: 'none',
            border: 'none',
            color: 'var(--primary)',
            fontWeight: 800,
            fontSize: '0.85rem',
            cursor: 'pointer',
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginTop: '0.5rem'
          }}
        >
          {isExpanded ? (
            <><span>↑</span> Show Less</>
          ) : (
            <><span>↓</span> Show {remainingCount} more {label}</>
          )}
        </button>
      )}
    </div>
  )
}
