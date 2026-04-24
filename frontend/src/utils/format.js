/**
 * Strips file extensions like .epub, .txt, .pdf from strings.
 */
export function cleanTitle(title) {
  if (!title) return 'Untitled'
  return title.replace(/\.(epub|txt|pdf|mobi)$/i, '').replace(/[_-]/g, ' ')
}
