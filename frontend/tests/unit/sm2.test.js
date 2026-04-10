import { describe, it, expect } from 'vitest'
import { createSM2State, gradeSM2 } from '../../src/utils/sm2'

describe('SM-2 Algorithm', () => {
  it('should initialize with default state', () => {
    const state = createSM2State()
    expect(state.ease).toBe(2.5)
    expect(state.reps).toBe(0)
    expect(state.interval).toBe(0)
  })

  it('should increase interval when graded "Good" (2)', () => {
    let state = createSM2State()
    state = gradeSM2(state, 2) // First rep
    expect(state.reps).toBe(1)
    expect(state.interval).toBe(1)
    
    state = gradeSM2(state, 2) // Second rep
    expect(state.reps).toBe(2)
    expect(state.interval).toBe(6)
  })

  it('should reset reps when graded "Again" (0)', () => {
    let state = createSM2State()
    state = gradeSM2(state, 2)
    state = gradeSM2(state, 2)
    expect(state.interval).toBe(6)
    
    state = gradeSM2(state, 0)
    expect(state.reps).toBe(0)
    // In current implementation, interval becomes 1 on fail
    expect(state.interval).toBe(1)
  })
})
