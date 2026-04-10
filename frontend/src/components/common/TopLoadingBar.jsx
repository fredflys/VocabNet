import { motion } from 'framer-motion'

export default function TopLoadingBar({ isLoading }) {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '4px', zIndex: 9999, pointerEvents: 'none', overflow: 'hidden' }}>
      {isLoading && (
        <motion.div
          initial={{ x: '-100%' }}
          animate={{ x: '100%' }}
          transition={{
            repeat: Infinity,
            duration: 1.5,
            ease: "easeInOut"
          }}
          style={{
            width: '100%',
            height: '100%',
            background: 'linear-gradient(90deg, transparent, var(--primary), transparent)',
            boxShadow: '0 0 10px var(--primary)'
          }}
        />
      )}
    </div>
  )
}
