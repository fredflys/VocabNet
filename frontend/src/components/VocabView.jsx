import { useState, useMemo, useCallback, useContext, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AppContext } from '../App'
import WordDetailModal from './WordDetailModal'
import { exportData } from '../utils/export'
import Pagination from './common/Pagination'
import SidebarTOC from './SidebarTOC'
import TOCTrigger from './TOCTrigger'
import HighlightedSentence from './common/HighlightedSentence'
import { API } from '../utils/config'
import { cleanTitle } from '../utils/format'
import { fadeUp } from '../utils/motion'

function EntityCard({ entity }) {
  const labelColors = {
    'Character': { bg: 'var(--entity-character-bg)', text: 'var(--entity-character-text)', border: 'var(--entity-character)' },
    'Location': { bg: 'var(--entity-location-bg)', text: 'var(--entity-location-text)', border: 'var(--entity-location)' },
    'Organization': { bg: 'var(--entity-org-bg)', text: 'var(--entity-org-text)', border: 'var(--entity-org)' },
    'Concept': { bg: 'var(--entity-concept-bg)', text: 'var(--entity-concept-text)', border: 'var(--entity-concept)' }
  }
  const color = labelColors[entity.label] || labelColors['Concept']
  const count = entity.occurrence_count || entity.count || 1

  return (
    <motion.div 
      layout
      className="entity-card"
      style={{ 
        padding: '1.5rem', 
        background: 'var(--bg-card)', 
        borderRadius: 'var(--radius)', 
        border: `1px solid var(--border)`,
        boxShadow: 'var(--shadow-sm)',
        display: 'flex', 
        flexDirection: 'column', 
        gap: '1rem'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ fontSize: '1.25rem', margin: 0 }}>{entity.text}</h4>
        <span className="badge" style={{ background: color.bg, color: color.text, border: `1px solid ${color.border}` }}>
          {entity.label}
        </span>
      </div>
      
      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        First mentioned in <strong>Chapter {entity.first_chapter || 0}</strong> · Appears <strong>{count} times</strong>
      </div>

      {entity.relationships && entity.relationships.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Related To</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {entity.relationships.map((rel, i) => (
              <span key={i} style={{ fontSize: '0.75rem', background: 'var(--bg-subtle)', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border)' }}>
                {rel.target}
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}

function WordCard({ entry, isKnown, onToggle, onDetail }) {
  const isActuallyPhrase = entry.is_idiom || !!entry.idiom_type || (entry.lemma && entry.lemma.includes(' '))
  const mainMeaning = entry.translation || entry.simple_def || entry.definition
  
  return (
    <motion.div 
      layout
      className={`word-card-long ${isKnown ? 'word-card--known' : ''}`}
      style={{ 
        opacity: isKnown ? 0.7 : 1,
        padding: '2.5rem',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow)',
        transition: 'all 0.2s',
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '6px', background: 'var(--primary)', opacity: isKnown ? 0.3 : 1 }}></div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
            <h3 style={{ fontWeight: 800, fontSize: '2.2rem', margin: 0, color: 'var(--text)', letterSpacing: '-0.02em' }}>{entry.lemma}</h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {entry.cefr && entry.cefr !== '?' && <span className="badge badge-indigo" style={{ fontSize: '0.85rem', padding: '0.2rem 0.6rem' }}>{entry.cefr}</span>}
              {isActuallyPhrase ? (
                <span className="badge badge-amber" style={{ fontSize: '0.85rem', padding: '0.2rem 0.6rem' }}>Phrase</span>
              ) : (
                <span className="badge" style={{ fontSize: '0.85rem', padding: '0.2rem 0.6rem', background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>Word</span>
              )}
              <span style={{ fontSize: '0.95rem', color: 'var(--text-muted)', fontWeight: 600, background: 'var(--bg-subtle)', padding: '0.2rem 0.6rem', borderRadius: '6px' }}>{entry.pos?.toLowerCase() || ''}</span>
            </div>
          </div>
          
          <div style={{ marginTop: '1rem' }}>
            {mainMeaning ? (
              <div style={{ fontSize: '1.25rem', color: 'var(--primary)', fontWeight: 700 }}>
                {mainMeaning}
              </div>
            ) : (
              <button 
                onClick={() => onDetail(entry)}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
              >
                🔍 Look up definition...
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            className={isKnown ? 'btn--secondary' : 'btn--primary'} 
            onClick={() => onToggle(entry.lemma, isKnown)}
            style={{ padding: '0.75rem 1.25rem', fontSize: '0.9rem', minWidth: '140px' }}
          >
            {isKnown ? 'Mastered ✓' : 'Mark Known'}
          </button>
          <button 
            className="btn--secondary" 
            onClick={() => onDetail(entry)}
            style={{ padding: '0.75rem 1.25rem', fontSize: '0.9rem' }}
          >
            Full Context & Dictionary →
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '3rem', borderTop: '1px solid var(--border)', paddingTop: '2rem' }}>
        <div>
          <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '1rem', fontWeight: 800 }}>PRIMARY SENSE</h4>
          <p style={{ fontSize: '1.1rem', lineHeight: 1.6, margin: 0, color: 'var(--text)' }}>
            {entry.simple_def || entry.definition || 'No definition available. Click "Full Context" to consult the dictionary.'}
          </p>
          {entry.memory_tip && (
            <div style={{ marginTop: '1.5rem', color: 'var(--accent)', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>💡</span> {entry.memory_tip}
            </div>
          )}
        </div>
        
        {entry.example && (
          <div>
            <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '1rem', fontWeight: 800 }}>CONTEXTUAL USAGE</h4>
            <div style={{ fontStyle: 'italic', fontSize: '1.1rem', color: 'var(--text)', background: 'var(--bg-subtle)', padding: '1.5rem', borderRadius: '16px', borderLeft: '4px solid var(--primary)', lineHeight: 1.5 }}>
              "<HighlightedSentence sentence={entry.example} lemma={entry.lemma} />"
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <div>Appears <strong>{entry.count} times</strong> in this volume</div>
          <div style={{ color: 'var(--primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>🌍</span> {entry.global_count || entry.count} total in library
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default function VocabView({ book, sm2Data, onUpdate, onBack, onSelectBook }) {
  const { settings, setIsLoading } = useContext(AppContext)
  const [tab, setTab] = useState('lexicon') // lexicon | intelligence
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [filterLevel, setFilterLevel] = useState('All')
  const [filterType, setFilterType] = useState('All')
  const [entityFilter, setEntityFilter] = useState('All') // All | Character | Location | Concept
  const [selectedWord, setSelectedWord] = useState(null)
  const [showExportOptions, setShowExportOptions] = useState(false)
  const [selectedChapter, setSelectedChapter] = useState(null)
  const [localVocab, setLocalVocab] = useState(book.vocab || [])
  const [isTOCOpen, setIsTOCOpen] = useState(false)
  
  const [sortBy, setSortBy] = useState('repeated') 
  const [sortOrder, setSortOrder] = useState('desc')

  // --- Chapter-Aware Data Loading ---
  useEffect(() => {
    if (selectedChapter === null) {
      setLocalVocab(book.vocab || [])
      return
    }

    const fetchChapterData = async () => {
      setIsLoading(true)
      try {
        const resp = await fetch(`${API}/api/library/${book.id}/vocab?chapter=${selectedChapter}&page_size=1000`)
        if (resp.ok) {
          const data = await resp.json()
          setLocalVocab(data.items)
        }
      } catch (err) {
        console.error('Failed to load chapter vocab', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchChapterData()
  }, [selectedChapter, book.id, book.vocab, setIsLoading])

  const handleToggleKnown = useCallback((lemma, isKnown) => {
    onUpdate(lemma, {
      ...sm2Data[lemma],
      status: isKnown ? 'learning' : 'mastered',
      mastery_source: isKnown ? 'study' : 'manual'
    })
  }, [sm2Data, onUpdate])

  const handleSpeak = (word) => {
    const audio = new Audio(`${API}/api/tts?word=${encodeURIComponent(word)}&voice=${encodeURIComponent(settings.ttsVoice || 'en-US-AriaNeural')}`)
    audio.play().catch(e => console.error('TTS playback error', e))
  }

  const PAGE_SIZE = 12

  // --- Lexicon Filtering ---
  const filteredLexicon = useMemo(() => {
    let result = [...localVocab]

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(v => v.lemma.toLowerCase().includes(q) || (v.translation && v.translation.includes(q)) || (v.definition && v.definition.toLowerCase().includes(q)))
    }

    if (filterLevel !== 'All') {
      result = result.filter(v => v.cefr === filterLevel)
    }

    if (filterType !== 'All') {
      const wantPhrase = filterType === 'Phrases'
      result = result.filter(v => {
        const isActuallyPhrase = v.is_idiom || !!v.idiom_type || (v.lemma && v.lemma.includes(' '))
        return isActuallyPhrase === wantPhrase
      })
    }

    result.sort((a, b) => {
      let cmp = 0
      if (sortBy === 'alphabet') {
        cmp = a.lemma.localeCompare(b.lemma)
      } else if (sortBy === 'repeated') {
        cmp = (a.count || 0) - (b.count || 0)
      } else if (sortBy === 'frequency') {
        const cefrScore = { '?': 0, 'A1': 1, 'A2': 2, 'B1': 3, 'B2': 4, 'C1': 5, 'C2': 6 }
        cmp = cefrScore[a.cefr || '?'] - cefrScore[b.cefr || '?']
      }
      return sortOrder === 'asc' ? cmp : -cmp
    })

    return result
  }, [localVocab, search, filterLevel, filterType, sortBy, sortOrder])

  // --- Intelligence Filtering ---
  const filteredEntities = useMemo(() => {
    if (!book || !book.entities) return []
    let result = [...book.entities]
    
    if (selectedChapter !== null) {
      result = result.filter(e => e.first_chapter === selectedChapter)
    }

    if (entityFilter !== 'All') {
      result = result.filter(e => e.label === entityFilter)
    }
    result.sort((a, b) => (b.count || 0) - (a.count || 0))
    return result
  }, [book, entityFilter, selectedChapter])

  const activeItems = tab === 'lexicon' ? filteredLexicon : filteredEntities
  const totalPages = Math.ceil(activeItems.length / PAGE_SIZE)
  const currentItems = activeItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [page, tab])

  return (
    <div className="vocab-view-container" style={{ position: 'relative', maxWidth: '1100px', margin: '0 auto', paddingBottom: '8rem' }}>
      <TOCTrigger 
        onClick={() => setIsTOCOpen(true)} 
        selectedChapter={selectedChapter}
        isMaster={book.id === 'master'}
      />

      <SidebarTOC 
        chapters={book.chapters} 
        selectedChapter={selectedChapter} 
        onSelectChapter={(num) => { setSelectedChapter(num); setPage(1); }}
        isMaster={book.id === 'master'}
        isOpen={isTOCOpen}
        onClose={() => setIsTOCOpen(false)}
      />

      <div className="vocab-content" style={{ width: '100%' }}>
        <div style={{ marginBottom: '5rem' }}>
          <button className="btn--secondary" onClick={onBack} style={{ marginBottom: '2.5rem', borderRadius: '12px', padding: '0.6rem 1.2rem' }}>⬅ Library Dashboard</button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Volume Archive</span>
            <h2 className="serif-title" style={{ fontSize: '3.5rem', lineHeight: 1.1, margin: '0 0 1.5rem -0.1rem' }}>{cleanTitle(book.title)}</h2>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '2.5rem' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', maxWidth: '500px', lineHeight: 1.5, margin: 0 }}>
              {tab === 'lexicon' 
                ? `Exploring the curated lexicon of ${localVocab.length} significant linguistic patterns.`
                : `Analyzing the thematic gravity and relationship nebula of characters and concepts.`}
            </p>

            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
              <div style={{ background: 'var(--bg-subtle)', padding: '0.5rem', borderRadius: '18px', display: 'flex', gap: '0.4rem', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                <button 
                  onClick={() => { setTab('lexicon'); setPage(1) }}
                  style={{ padding: '0.7rem 1.5rem', borderRadius: '14px', background: tab === 'lexicon' ? 'var(--bg-card)' : 'transparent', color: tab === 'lexicon' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 800, boxShadow: tab === 'lexicon' ? 'var(--shadow-sm)' : 'none', border: tab === 'lexicon' ? '1px solid var(--border)' : 'none', cursor: 'pointer', fontSize: '0.9rem', transition: 'all 0.2s' }}
                >
                  LEXICON
                </button>
                <button 
                  onClick={() => { setTab('intelligence'); setPage(1) }}
                  style={{ padding: '0.7rem 1.5rem', borderRadius: '14px', background: tab === 'intelligence' ? 'var(--bg-card)' : 'transparent', color: tab === 'intelligence' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 800, boxShadow: tab === 'intelligence' ? 'var(--shadow-sm)' : 'none', border: tab === 'intelligence' ? '1px solid var(--border)' : 'none', cursor: 'pointer', fontSize: '0.9rem', transition: 'all 0.2s' }}
                >
                  INTELLIGENCE
                </button>
              </div>

              <div style={{ position: 'relative' }}>
                <button 
                  className="btn--primary" 
                  onClick={() => setShowExportOptions(!showExportOptions)}
                  style={{ padding: '0.8rem 1.8rem', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: 700, fontSize: '0.9rem' }}
                >
                  <span>📥</span> EXPORT ARCHIVE
                </button>
                
                <AnimatePresence>
                  {showExportOptions && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      style={{ position: 'absolute', top: '120%', right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow-lg)', zIndex: 100, minWidth: '240px', padding: '0.75rem' }}
                    >
                      <button onClick={() => { exportData('anki', filteredLexicon, book.title); setShowExportOptions(false) }} style={{ width: '100%', padding: '1rem', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 600, color: 'var(--text)', borderRadius: '10px' }}>📇 Anki-Ready (CSV)</button>
                      <button onClick={() => { exportData('csv', filteredLexicon, book.title); setShowExportOptions(false) }} style={{ width: '100%', padding: '1rem', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 600, color: 'var(--text)', borderRadius: '10px' }}>📊 Plain Spreadsheet (CSV)</button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        {tab === 'lexicon' ? (
          <>
            <div className="vocab-header-card">
              <div className="vocab-controls" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'center' }}>
                  <div className="search-input-wrapper" style={{ position: 'relative', flex: 1, minWidth: '350px' }}>
                    <span style={{ position: 'absolute', left: '1.5rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '1.4rem' }}>🔍</span>
                    <input type="text" placeholder="Search ledger..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} style={{ outline: 'none' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'var(--bg-subtle)', padding: '0.75rem', borderRadius: '16px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', marginLeft: '0.75rem', letterSpacing: '0.1em' }}>SORT BY</span>
                    {['alphabet', 'repeated', 'frequency'].map(s => (
                      <button key={s} onClick={() => { if (sortBy === s) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); else { setSortBy(s); setSortOrder('desc') }; setPage(1) }} style={{ padding: '0.6rem 1.25rem', background: sortBy === s ? 'var(--bg-card)' : 'transparent', border: sortBy === s ? '1px solid var(--border)' : '1px solid transparent', borderRadius: '12px', cursor: 'pointer', fontWeight: sortBy === s ? 800 : 600, textTransform: 'uppercase', fontSize: '0.8rem', color: sortBy === s ? 'var(--primary)' : 'var(--text-muted)' }}>
                        {s} {sortBy === s && (sortOrder === 'asc' ? '↑' : '↓')}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                  <div className="filter-pills">
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', alignSelf: 'center', margin: '0 0.5rem', letterSpacing: '0.05em' }}>LEVEL</span>
                    {['All', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(lv => (
                      <button key={lv} className={`filter-pill ${filterLevel === lv ? 'filter-pill--active' : ''}`} style={{ padding: '0.5rem 1.1rem', background: filterLevel === lv ? 'var(--bg-card)' : 'transparent', border: filterLevel === lv ? '1px solid var(--border)' : 'none', borderRadius: '10px', fontWeight: filterLevel === lv ? 800 : 600, fontSize: '0.85rem', color: filterLevel === lv ? 'var(--primary)' : 'var(--text-muted)' }} onClick={() => { setFilterLevel(lv); setPage(1) }}>{lv}</button>
                    ))}
                  </div>
                  <div className="filter-pills">
                    {['All', 'Words', 'Phrases'].map(t => (
                      <button key={t} className={`filter-pill ${filterType === t ? 'filter-pill--active' : ''}`} style={{ padding: '0.5rem 1.5rem', background: filterType === t ? 'var(--bg-card)' : 'transparent', border: filterType === t ? '1px solid var(--border)' : 'none', borderRadius: '10px', fontWeight: filterType === t ? 800 : 600, fontSize: '0.85rem', color: filterType === t ? 'var(--primary)' : 'var(--text-muted)' }} onClick={() => { setFilterType(t); setPage(1) }}>{t}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {currentItems.map(entry => (
                <WordCard 
                  key={entry.lemma} 
                  entry={entry} 
                  isKnown={sm2Data[entry.lemma]?.status === 'mastered'} 
                  onToggle={handleToggleKnown} 
                  onDetail={(e) => setSelectedWord({ ...e, book_id: book.id })} 
                />
              ))}
            </div>          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <motion.div
              {...fadeUp}
              style={{
                padding: '4rem 3rem', 
                background: 'var(--bg-card)', 
                borderRadius: '28px', 
                color: 'var(--text)',
                textAlign: 'center',
                boxShadow: 'var(--shadow-lg)',
                border: '1px solid var(--border)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* Subtle background glow */}
              <div style={{ 
                position: 'absolute', 
                top: '-50%', left: '-20%', right: '-20%', bottom: '-50%',
                background: 'radial-gradient(circle at center, rgba(var(--primary-rgb), 0.08) 0%, transparent 70%)',
                pointerEvents: 'none'
              }} />

              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ 
                  fontSize: '3.5rem', 
                  marginBottom: '1.5rem',
                  filter: 'drop-shadow(0 10px 15px rgba(var(--primary-rgb), 0.2))'
                }}>🌌</div>
                
                <h3 style={{ 
                  fontSize: '2.2rem', 
                  marginBottom: '1rem', 
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: 'var(--text)'
                }}>
                  Intelligence Nebula
                </h3>
                
                <p style={{ 
                  color: 'var(--text-muted)', 
                  fontSize: '1.15rem', 
                  maxWidth: '550px', 
                  margin: '0 auto 2.5rem',
                  lineHeight: 1.6
                }}>
                  Explore the thematic gravity and relationship archive of characters, locations, and concepts within this volume.
                </p>
                
                <button 
                  onClick={() => onSelectBook({ ...book, initialChapter: selectedChapter }, true)}
                  className="btn--primary"
                  style={{ 
                    padding: '1.2rem 3rem', 
                    borderRadius: '16px', 
                    fontWeight: 800, 
                    fontSize: '1.1rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.75rem'
                  }}
                >
                  <span>Launch Graph</span>
                  <span style={{ fontSize: '1.3rem' }}>→</span>
                </button>              </div>
            </motion.div>

            <div className="vocab-header-card" style={{ padding: '1.5rem' }}>
              <div className="filter-pills" style={{ justifyContent: 'center' }}>
                {['All', 'Character', 'Location', 'Organization', 'Concept'].map(type => (
                  <button 
                    key={type} 
                    className={`filter-pill ${entityFilter === type ? 'filter-pill--active' : ''}`}
                    onClick={() => { setEntityFilter(type); setPage(1) }}
                    style={{ padding: '0.6rem 1.5rem', background: entityFilter === type ? 'var(--bg-card)' : 'transparent', borderRadius: '10px', fontWeight: entityFilter === type ? 800 : 600, fontSize: '0.85rem', color: entityFilter === type ? 'var(--primary)' : 'var(--text-muted)', border: entityFilter === type ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}
                  >
                    {type === 'All' ? 'ALL ENTITIES' : type.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
              {currentItems.length > 0 ? (
                currentItems.map((ent, i) => <EntityCard key={i} entity={ent} />)
              ) : (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '10rem 2rem', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-lg)', border: '2px dashed var(--border)' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>No matching entities found.</p>
                </div>
              )}
            </div>
          </div>
        )}

        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />

        <AnimatePresence>
          {selectedWord && <WordDetailModal entry={selectedWord} onClose={() => setSelectedWord(null)} onSpeak={handleSpeak} onSelectBook={onSelectBook} />}
        </AnimatePresence>
      </div>
    </div>
  )
}
