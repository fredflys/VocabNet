/**
 * Modular Export System for VocabNet.
 */

/**
 * Base escape function for CSV compliance.
 */
function escapeCSV(str) {
  if (!str) return '""'
  let cleaned = String(str).replace(/"/g, '""')
  if (cleaned.search(/("|,|\n)/g) >= 0) {
    cleaned = `"${cleaned}"`
  }
  return cleaned
}

/**
 * Common formatter for definitions.
 */
function formatDefinition(entry) {
  let defText = ''
  if (entry.translation) defText += `[${entry.translation}] `
  if (entry.simple_def) defText += entry.simple_def
  else if (entry.definition) defText += entry.definition
  return defText
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const Exporters = {
  /**
   * Export to Anki-friendly CSV.
   */
  anki: (vocab, bookTitle) => {
    const headers = ['Word', 'Definition', 'Example', 'Type', 'Tags']
    const rows = vocab.map(entry => {
      const word = escapeCSV(entry.lemma)

      let defHtml = ''
      if (entry.translation) defHtml += `<b>${escapeHtml(entry.translation)}</b><br>`
      if (entry.simple_def) defHtml += `${escapeHtml(entry.simple_def)}<br>`
      else if (entry.definition) defHtml += `${escapeHtml(entry.definition)}<br>`
      if (entry.memory_tip) defHtml += `<br><i>Tip: ${escapeHtml(entry.memory_tip)}</i>`
      
      return [
        word,
        escapeCSV(defHtml),
        escapeCSV(entry.example ? `"${entry.example}"` : ''),
        escapeCSV(entry.pos || (entry.is_idiom ? 'Phrase' : 'Word')),
        escapeCSV(`VocabNet ${bookTitle.replace(/\s+/g, '_')} ${entry.cefr !== '?' ? entry.cefr : ''}`.trim())
      ].join(',')
    })
    return { content: [headers.join(','), ...rows].join('\n'), extension: 'csv', suffix: 'Anki' }
  },

  /**
   * General purpose CSV export.
   */
  csv: (vocab, bookTitle) => {
    const headers = ['Word', 'Difficulty', 'Appearances', 'Meaning', 'Example Sentence']
    const rows = vocab.map(entry => [
      escapeCSV(entry.lemma),
      escapeCSV(entry.cefr || '?'),
      escapeCSV(entry.count || 0),
      escapeCSV(formatDefinition(entry)),
      escapeCSV(entry.example ? `"${entry.example}"` : '')
    ].join(','))
    return { content: [headers.join(','), ...rows].join('\n'), extension: 'csv', suffix: 'List' }
  },

  /**
   * JSON Export for developers or backups.
   */
  json: (vocab, bookTitle) => {
    return { 
      content: JSON.stringify({ book: bookTitle, exported_at: new Date().toISOString(), vocabulary: vocab }, null, 2), 
      extension: 'json', 
      suffix: 'Archive' 
    }
  }
}

/**
 * Primary entry point for exporting data.
 * @param {string} format - 'anki', 'csv', 'json'
 * @param {Array} vocab - Filtered vocabulary list
 * @param {string} bookTitle - Title of context
 */
export function exportData(format, vocab, bookTitle = 'VocabNet') {
  const exporter = Exporters[format]
  if (!exporter) {
    console.error(`Unknown export format: ${format}`)
    return
  }

  const { content, extension, suffix } = exporter(vocab, bookTitle)
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const cleanName = bookTitle.replace(/[^a-z0-9]/gi, '_')
  
  link.setAttribute('href', url)
  link.setAttribute('download', `${cleanName}_${suffix}.${extension}`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
