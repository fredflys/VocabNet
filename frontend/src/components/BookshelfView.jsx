import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const API = 'http://localhost:8000'

/**
 * Strips file extensions like .epub, .txt, .pdf from strings.
 */
function cleanTitle(title) {
  if (!title) return 'Untitled'
  return title.replace(/\.(epub|txt|pdf|mobi)$/i, '').replace(/[_-]/g, ' ')
}

function BookCard({ book, index, onSelect, onDeleted }) {
  const [isConfirming, setIsConfirming] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const cardColor = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b'][index % 5]

  const handleDelete = async (e) => {
    e.stopPropagation()
    if (!isConfirming) {
      setIsConfirming(true)
      return
    }
    
    try {
      const resp = await fetch(`${API}/api/library/${book.id}`, { method: 'DELETE' })
      if (resp.ok) onDeleted(book.id)
    } catch (err) {
      console.error(err)
      setIsConfirming(false)
    }
  }

  return (
    <motion.div 
      className="book-item"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false)
        setIsConfirming(false)
      }}
      onClick={() => !isConfirming && onSelect(book)}
      style={{ cursor: 'pointer', position: 'relative' }}
    >
      {/* Main Book Cover */}
      <div 
        className="book-cover" 
        style={{ 
          height: '300px',
          borderRadius: 'var(--radius)',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          color: 'white',
          position: 'relative',
          zIndex: 1,
          boxShadow: isConfirming ? '0 0 0 4px #ef4444, var(--shadow)' : 'var(--shadow)',
          background: `linear-gradient(135deg, ${cardColor}, #00000066)`,
          transition: 'all 0.3s ease',
          filter: isConfirming ? 'grayscale(0.5) brightness(0.6)' : 'none',
          overflow: 'hidden'
        }}
      >
        {/* Binding Detail */}
        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '12px', background: 'linear-gradient(to right, rgba(0,0,0,0.2), transparent)', pointerEvents: 'none' }} />

        {/* Skeuomorphic Close Button - Integrated into Cover */}
        <motion.div
          className="delete-btn-skeuo"
          initial={{ opacity: 0, scale: 0.5, x: 10, y: -10 }}
          animate={{ 
            opacity: isHovered ? 1 : 0, 
            scale: isHovered ? (isConfirming ? 1 : 0.9) : 0.5,
            x: isHovered ? 0 : 10,
            y: isHovered ? 0 : -10,
            width: isConfirming ? '120px' : '32px',
            borderRadius: isConfirming ? '8px' : '50%'
          }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleDelete}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            height: '32px',
            backgroundColor: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 10,
            color: 'white',
            fontWeight: 900,
            fontSize: '0.9rem',
            // Skeuomorphism: Deep shadows and highlights
            border: '1px solid #991b1b',
            boxShadow: '0 4px 10px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.3)',
            backgroundImage: 'linear-gradient(to bottom, #f87171, #ef4444)',
            overflow: 'hidden'
          }}
        >
          <AnimatePresence mode="wait">
            {isConfirming ? (
              <motion.span
                key="confirm"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                style={{ fontSize: '0.65rem', letterSpacing: '0.05em' }}
              >
                CONFIRM?
              </motion.span>
            ) : (
              <motion.span
                key="close"
                initial={{ opacity: 0, rotate: -90 }}
                animate={{ opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, rotate: 90 }}
              >
                ×
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>

        <div className="book-title-overlay" style={{ fontSize: '1.25rem', fontWeight: 800, lineHeight: 1.2, textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
          {cleanTitle(book.title)}
        </div>
        
        <div style={{ marginTop: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', opacity: 0.9 }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em' }}>
              {book.total_words?.toLocaleString()} TOTAL WORDS
            </div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em' }}>
              {book.unique_lemmas?.toLocaleString()} UNIQUE WORDS
            </div>
          </div>
          

        </div>
      </div>
      
      <div style={{ marginTop: '1rem', padding: '0 0.5rem' }}>
        <h4 style={{ fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 700 }}>{cleanTitle(book.title)}</h4>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          Added {new Date(book.added_date).toLocaleDateString()}
        </div>
      </div>
    </motion.div>
  )
}

export default function BookshelfView({ books, onSelect, onUpload, onDeleted, onViewMasterLedger }) {
  return (
    <div className="bookshelf-view">
      <div style={{ marginBottom: '4rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="serif-title">Your library</h2>
          <button 
            className="btn--secondary" 
            onClick={onViewMasterLedger}
            style={{ background: 'white', padding: '0.8rem 1.5rem', borderRadius: '12px', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
          >
            <span>📖</span> Master Ledger
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginTop: '1rem' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
            {books.length} volumes collected in your archive.
          </p>
        </div>
      </div>

      {books.length === 0 ? (
        <div style={{ padding: '8rem 2rem', textAlign: 'center', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-lg)', border: '2px dashed var(--border)' }}>
          <div style={{ fontSize: '4rem', marginBottom: '2rem' }}>🌿</div>
          <h3 style={{ fontSize: '1.5rem' }}>No volumes found</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Begin your journey by uploading an EPUB or text file.</p>
          <button className="btn--primary" onClick={onUpload}>Start Collection</button>
        </div>
      ) : (
        <div className="library-shelf-container">
          <div className="shelf-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '2rem' }}>
            {books.map((book, index) => (
              <BookCard 
                key={book.id}
                book={book}
                index={index}
                onSelect={onSelect}
                onDeleted={onDeleted}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
