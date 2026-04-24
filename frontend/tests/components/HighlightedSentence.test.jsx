import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import HighlightedSentence from '../../src/components/common/HighlightedSentence'

describe('HighlightedSentence', () => {
  it('should return null for empty sentence', () => {
    const { container } = render(<HighlightedSentence sentence="" lemma="test" />)
    expect(container.innerHTML).toBe('')
  })

  it('should return null for null sentence', () => {
    const { container } = render(<HighlightedSentence sentence={null} lemma="test" />)
    expect(container.innerHTML).toBe('')
  })

  it('should highlight the lemma in the sentence', () => {
    render(<HighlightedSentence sentence="I like to run every day" lemma="run" />)
    const highlighted = screen.getByText('run')
    expect(highlighted.tagName).toBe('STRONG')
  })

  it('should highlight inflected forms', () => {
    render(
      <HighlightedSentence
        sentence="She was running while they ran"
        lemma="run"
        inflections={['running', 'ran']}
      />
    )
    const running = screen.getByText('running')
    const ran = screen.getByText('ran')
    expect(running.tagName).toBe('STRONG')
    expect(ran.tagName).toBe('STRONG')
  })

  it('should be case-insensitive', () => {
    render(<HighlightedSentence sentence="Running is fun" lemma="running" />)
    const highlighted = screen.getByText('Running')
    expect(highlighted.tagName).toBe('STRONG')
  })

  it('should not crash with regex special characters in lemma', () => {
    // This tests the regex escape fix
    const { container } = render(
      <HighlightedSentence sentence="I learned about C++ today" lemma="C++" />
    )
    expect(container.innerHTML).toContain('C++')
  })

  it('should handle hyphenated words without crash', () => {
    const { container } = render(
      <HighlightedSentence sentence="She is self-aware" lemma="self-aware" />
    )
    expect(container.innerHTML).toContain('self')
  })

  it('should highlight all occurrences, not skip alternating ones', () => {
    // This tests the regex.test() stateful bug fix
    // With the old code using regex.test() + 'g' flag, every other match would be skipped
    render(
      <HighlightedSentence
        sentence="run and run and run again"
        lemma="run"
      />
    )
    const highlights = screen.getAllByText('run')
    expect(highlights.length).toBe(3)
    highlights.forEach(el => {
      expect(el.tagName).toBe('STRONG')
    })
  })

  it('should render plain text when lemma is not found', () => {
    const { container } = render(
      <HighlightedSentence sentence="Hello world" lemma="xyz" />
    )
    expect(container.textContent).toBe('Hello world')
    expect(container.querySelectorAll('strong').length).toBe(0)
  })
})
