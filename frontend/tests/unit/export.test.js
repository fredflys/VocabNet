import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// We need to test internal functions, so we import the module and test via exportData
// Since escapeCSV and formatDefinition are not exported, we test them through exportData behavior
// and also test the module by extracting from its side effects.

// Import the full module to test exportData
import { exportData } from '../../src/utils/export'

describe('exportData', () => {
  let createObjectURLMock
  let revokeObjectURLMock
  let clickMock

  beforeEach(() => {
    createObjectURLMock = vi.fn().mockReturnValue('blob:test-url')
    revokeObjectURLMock = vi.fn()
    clickMock = vi.fn()

    global.URL.createObjectURL = createObjectURLMock
    global.URL.revokeObjectURL = revokeObjectURLMock

    vi.spyOn(document, 'createElement').mockReturnValue({
      setAttribute: vi.fn(),
      click: clickMock,
    })
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => {})
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should handle unknown format gracefully', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    exportData('unknown', [], 'Test')
    expect(consoleSpy).toHaveBeenCalledWith('Unknown export format: unknown')
    consoleSpy.mockRestore()
  })

  it('should revoke ObjectURL after download', () => {
    const vocab = [{ lemma: 'test', cefr: 'B1', count: 1 }]
    exportData('csv', vocab, 'TestBook')
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:test-url')
  })

  it('should trigger file download for CSV', () => {
    const vocab = [{ lemma: 'hello', cefr: 'A1', count: 5, simple_def: 'greeting' }]
    exportData('csv', vocab, 'MyBook')
    expect(createObjectURLMock).toHaveBeenCalled()
    expect(clickMock).toHaveBeenCalled()
  })

  it('should trigger file download for Anki', () => {
    const vocab = [{ lemma: 'hello', translation: 'bonjour', simple_def: 'greeting' }]
    exportData('anki', vocab, 'MyBook')
    expect(createObjectURLMock).toHaveBeenCalled()
    expect(clickMock).toHaveBeenCalled()
  })

  it('should escape HTML in Anki export to prevent XSS', () => {
    const vocab = [{
      lemma: 'test',
      translation: '<script>alert("xss")</script>',
      simple_def: 'A "test" & <more>',
      memory_tip: 'Remember <b>this</b>',
    }]

    // Capture the Blob content
    let blobContent = ''
    global.Blob = vi.fn().mockImplementation((parts) => {
      blobContent = parts[0]
      return {}
    })

    exportData('anki', vocab, 'TestBook')

    // Verify HTML entities are escaped
    expect(blobContent).not.toContain('<script>')
    expect(blobContent).toContain('&lt;script&gt;')
    expect(blobContent).toContain('&amp;')
    expect(blobContent).toContain('&lt;more&gt;')
    expect(blobContent).toContain('&lt;b&gt;')
  })

  it('should produce valid JSON export', () => {
    let blobContent = ''
    global.Blob = vi.fn().mockImplementation((parts) => {
      blobContent = parts[0]
      return {}
    })

    const vocab = [{ lemma: 'hello', cefr: 'A1' }]
    exportData('json', vocab, 'TestBook')

    const parsed = JSON.parse(blobContent)
    expect(parsed.book).toBe('TestBook')
    expect(parsed.exported_at).toBeDefined()
    expect(parsed.vocabulary).toHaveLength(1)
    expect(parsed.vocabulary[0].lemma).toBe('hello')
  })

  it('should handle empty strings in CSV', () => {
    let blobContent = ''
    global.Blob = vi.fn().mockImplementation((parts) => {
      blobContent = parts[0]
      return {}
    })

    const vocab = [{ lemma: 'test' }]
    exportData('csv', vocab, 'Test')

    // Should not crash, should produce valid CSV
    expect(blobContent).toContain('test')
    expect(blobContent.split('\n').length).toBeGreaterThan(1) // header + data
  })

  it('should handle entries with commas and quotes in CSV', () => {
    let blobContent = ''
    global.Blob = vi.fn().mockImplementation((parts) => {
      blobContent = parts[0]
      return {}
    })

    const vocab = [{
      lemma: 'test',
      simple_def: 'a "test", really',
      cefr: 'B1',
      count: 1,
    }]
    exportData('csv', vocab, 'Test')

    // The definition contains both quotes and comma, so it should be properly escaped
    expect(blobContent).toContain('""test""')
  })
})
