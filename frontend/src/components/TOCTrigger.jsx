import { motion } from 'framer-motion'

export default function TOCTrigger({ onClick, selectedChapter, isMaster }) {
  if (isMaster) return null

  return (
    <motion.div
      initial={{ x: -10 }}
      animate={{ x: 0 }}
      whileHover={{ x: 5 }}
      onClick={onClick}
      style={{
        position: 'fixed',
        left: 0,
        top: '50%',
        transform: 'translateY(-50%)',
        width: '40px',
        height: '160px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderLeft: 'none',
        borderRadius: '0 16px 16px 0',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 1000,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        backdropFilter: 'blur(10px)',
        transition: 'background 0.2s'
      }}
    >
      <div style={{
        writingMode: 'vertical-lr',
        transform: 'rotate(180deg)',
        fontSize: '0.7rem',
        fontWeight: 900,
        letterSpacing: '0.2em',
        color: 'var(--text-muted)',
        textTransform: 'uppercase'
      }}>
        Table of Contents
      </div>
      
      <div style={{
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        background: 'var(--primary)',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.6rem',
        fontWeight: 800,
        boxShadow: '0 2px 8px rgba(var(--primary-rgb), 0.4)'
      }}>
        {selectedChapter === null ? 'ALL' : selectedChapter.toString().padStart(2, '0')}
      </div>
    </motion.div>
  )
}
