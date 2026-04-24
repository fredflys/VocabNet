import { useMemo } from 'react'

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export default function HighlightedSentence({ sentence, lemma, inflections = [] }) {
  if (!sentence) return null

  const regex = useMemo(() => {
    const forms = Array.from(new Set([
      escapeRegex(lemma.toLowerCase()),
      ...inflections.map(f => escapeRegex(f.toLowerCase()))
    ]))
    return new RegExp(`(\\b(?:${forms.join('|')})\\w*\\b)`, 'gi')
  }, [lemma, inflections])

  const parts = sentence.split(regex)

  return (
    <span>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} style={{
            color: 'var(--primary)',
            background: 'rgba(var(--primary-rgb), 0.12)',
            padding: '0 4px',
            borderRadius: '4px',
            fontWeight: 700
          }}>{part}</strong>
        ) : part
      )}
    </span>
  )
}
