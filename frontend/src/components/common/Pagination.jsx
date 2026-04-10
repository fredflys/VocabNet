import { motion } from 'framer-motion'

export default function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null

  return (
    <div style={{ marginTop: '6rem', display: 'flex', justifyContent: 'center', gap: '2rem', alignItems: 'center' }}>
      <button 
        className="btn--secondary" 
        disabled={currentPage === 1} 
        onClick={() => onPageChange(currentPage - 1)} 
        style={{ padding: '1.25rem 2.5rem', borderRadius: '16px', fontSize: '1.1rem' }}
      >
        ← Previous Page
      </button>
      
      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-muted)' }}>
        <span style={{ color: 'var(--text)' }}>{currentPage}</span> 
        <span style={{ opacity: 0.4, margin: '0 0.5rem' }}>/</span> 
        {totalPages}
      </div>
      
      <button 
        className="btn--secondary" 
        disabled={currentPage === totalPages} 
        onClick={() => onPageChange(currentPage + 1)} 
        style={{ padding: '1.25rem 2.5rem', borderRadius: '16px', fontSize: '1.1rem' }}
      >
        Next Page →
      </button>
    </div>
  )
}
