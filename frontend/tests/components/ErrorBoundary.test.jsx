import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ErrorBoundary from '../../src/components/common/ErrorBoundary'

// A component that always throws
function ThrowingChild({ shouldThrow = true }) {
  if (shouldThrow) throw new Error('Test error')
  return <div>Child rendered</div>
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // Suppress console.error from React's error boundary logging
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('should render children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>Safe content</div>
      </ErrorBoundary>
    )
    expect(screen.getByText('Safe content')).toBeDefined()
  })

  it('should display error UI when a child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>
    )
    expect(screen.getByText('Registry Failure')).toBeDefined()
    expect(screen.getByText(/Test error/)).toBeDefined()
  })

  it('should display the reset button', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>
    )
    expect(screen.getByText('Return to Main Dashboard')).toBeDefined()
  })

  it('should navigate to / when reset button is clicked', () => {
    // Mock window.location
    const originalLocation = window.location
    delete window.location
    window.location = { href: '' }

    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>
    )

    fireEvent.click(screen.getByText('Return to Main Dashboard'))
    expect(window.location.href).toBe('/')

    window.location = originalLocation
  })
})
