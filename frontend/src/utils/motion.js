/**
 * Shared framer-motion animation presets for consistent UI behavior.
 */

// Standard content entry — cards, sections, lists
export const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 8 },
}

// Modal / overlay entry
export const scaleIn = {
  initial: { opacity: 0, scale: 0.96, y: 12 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.96, y: 12 },
}

// Shared spring transition for modals
export const modalTransition = {
  type: 'spring',
  stiffness: 400,
  damping: 30,
}

// Stagger children by index
export const staggerDelay = (index, base = 0.04) => ({
  delay: index * base,
})

// Button press feedback
export const tapShrink = {
  whileTap: { scale: 0.97 },
}
