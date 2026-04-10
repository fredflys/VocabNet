import { useMemo, useState, useRef, useCallback, useEffect } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { motion, AnimatePresence } from 'framer-motion'
import DensitySlider from './common/DensitySlider'

export default function IntelligenceNebula({ entities, bookTitle, onClose, totalChapters = 1 }) {
  const fgRef = useRef()
  const [density, setDensity] = useState(30)
  const [activeFilter, setActiveFilter] = useState('All')
  const [selectedNode, setSelectedNode] = useState(null)
  const [selectedLink, setSelectedLink] = useState(null)
  const [currentChapter, setCurrentChapter] = useState(totalChapters || 1)

  // --- Theme Detection ---
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
  const theme = {
    bg: isDark ? 'radial-gradient(circle at center, #1e1b4b 0%, #0f172a 100%)' : 'radial-gradient(circle at center, #fdfbf7 0%, #f5f2eb 100%)',
    headerBg: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.85)',
    sidebarBg: isDark ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
    textColor: isDark ? '#ffffff' : '#0f172a',
    mutedText: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(15, 23, 42, 0.5)',
    linkColor: isDark ? 'rgba(129, 140, 248, 0.4)' : 'rgba(99, 102, 241, 0.35)',
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
  }

  // --- Helpers ---
  const getColor = useCallback((type) => {
    const colors = { 'Character': '#10b981', 'Location': '#3b82f6', 'Organization': '#ec4899', 'Concept': '#8b5cf6' }
    return colors[type] || '#94a3b8'
  }, [])

  const graphData = useMemo(() => {
    // 1. Filter by current evolution chapter
    let filtered = entities.filter(e => e.first_chapter <= currentChapter)
    
    // 2. Score by prominence
    let scored = filtered.map(e => {
      const count = e.occurrence_count || e.count || 1
      const relationshipCount = e.relationships?.length || 0
      const prominence = (count * 1.5) + (relationshipCount * 5.0)
      return { ...e, prominence, safeCount: count }
    })

    if (activeFilter !== 'All') {
      scored = scored.filter(e => e.label === activeFilter)
    }

    scored.sort((a, b) => b.prominence - a.prominence)
    const visibleEntities = scored.slice(0, density)
    const visibleIds = new Set(visibleEntities.map(e => e.text))

    // 5. Transform to D3 Nodes
    // Note: We don't try to access fgRef here anymore to avoid render-phase errors.
    // react-force-graph will reconcile nodes by 'id' automatically.
    const nodes = visibleEntities.map(e => ({
      id: e.text,
      label: e.text,
      type: e.label,
      val: Math.sqrt(e.safeCount) * 2 + 6,
      prominence: e.prominence,
      count: e.safeCount,
      chapter: e.first_chapter
    }))

    const links = []
    visibleEntities.forEach(source => {
      if (source.relationships) {
        source.relationships.forEach(rel => {
          if (visibleIds.has(rel.target)) {
            links.push({
              source: source.text,
              target: rel.target,
              weight: rel.weight,
              scenes: rel.scenes || []
            })
          }
        })
      }
    })

    return { nodes, links }
  }, [entities, density, activeFilter, currentChapter])

  // --- Force Tuning ---
  useEffect(() => {
    if (!fgRef.current) return
    // Increase spread
    fgRef.current.d3Force('charge').strength(-600).distanceMax(800)
    fgRef.current.d3Force('link').distance(l => 150 + (l.weight * 3))
    fgRef.current.d3Force('center').strength(0.05)
    
    // Re-heat simulation on data change to allow new nodes to find their place
    fgRef.current.d3ReheatSimulation()
  }, [graphData])

  const handleNodeClick = useCallback(node => {
    setSelectedLink(null)
    setSelectedNode(node === selectedNode ? null : node)
    if (node && fgRef.current) {
      fgRef.current.centerAt(node.x, node.y, 800)
      fgRef.current.zoom(2.5, 800)
    }
  }, [selectedNode])

  const handleLinkClick = useCallback(link => {
    setSelectedNode(null)
    setSelectedLink(link === selectedLink ? null : link)
  }, [selectedLink])

  const handleNodeDragEnd = useCallback(node => {
    // Pin node position after dragging
    node.fx = node.x
    node.fy = node.y
  }, [])

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: theme.bg, display: 'flex', flexDirection: 'column', color: theme.textColor }}
    >
      {/* Header */}
      <div style={{ 
        padding: '1.5rem 4rem', 
        display: 'grid', 
        gridTemplateColumns: '1fr auto 1fr', 
        alignItems: 'center', 
        background: theme.headerBg, 
        backdropFilter: 'blur(20px)', 
        borderBottom: `1px solid ${theme.borderColor}`, 
        zIndex: 100 
      }}>
        <div style={{ justifySelf: 'start' }}>
          <button 
            onClick={onClose} 
            className="btn--secondary" 
            style={{ padding: '0.8rem 1.5rem', borderRadius: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <span>⬅</span> Close Archive
          </button>
        </div>

        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block' }}>Intelligence Archive</span>
          <h2 style={{ margin: '0.2rem 0 0', fontSize: '2rem', fontWeight: 400, fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>{bookTitle}</h2>
        </div>
        <div />
      </div>

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <ForceGraph2D
          ref={fgRef}
          graphData={graphData}
          onNodeDragEnd={handleNodeDragEnd}
          nodeColor={node => getColor(node.type)}
          linkColor={link => selectedLink === link ? 'var(--primary)' : theme.linkColor}
          linkWidth={link => (selectedLink === link ? 4 : Math.sqrt(link.weight) + 1)}
          
          cooldownTicks={150}
          cooldownTime={3000}
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.4}
          
          onNodeClick={handleNodeClick}
          onLinkClick={handleLinkClick}
          nodeCanvasObject={(node, ctx, globalScale) => {
            const label = node.label
            const isSelected = selectedNode?.id === node.id || selectedLink?.source.id === node.id || selectedLink?.target.id === node.id
            const baseColor = getColor(node.type)
            
            ctx.shadowColor = baseColor
            ctx.shadowBlur = isSelected ? 25 : 10
            
            ctx.beginPath()
            ctx.arc(node.x, node.y, node.val, 0, 2 * Math.PI, false)
            ctx.fillStyle = baseColor
            ctx.globalAlpha = isSelected ? 1 : 0.8
            ctx.fill()
            
            const fontSize = 13 / globalScale
            ctx.font = `700 ${fontSize}px "Plus Jakarta Sans", sans-serif`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            
            ctx.strokeStyle = isDark ? '#0f172a' : '#ffffff'
            ctx.lineWidth = 4 / globalScale
            ctx.strokeText(label, node.x, node.y + node.val + (fontSize))
            
            ctx.fillStyle = theme.textColor
            ctx.globalAlpha = 1
            ctx.fillText(label, node.x, node.y + node.val + (fontSize))
            
            ctx.shadowBlur = 0
          }}
        />

        {/* Global Controller */}
        <div style={{ position: 'absolute', bottom: '3rem', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center', zIndex: 50 }}>
          {totalChapters > 1 && (
            <div style={{ background: theme.sidebarBg, padding: '1rem 2.5rem', borderRadius: '20px', border: `1px solid ${theme.borderColor}`, backdropFilter: 'blur(20px)', boxShadow: 'var(--shadow-lg)', minWidth: '500px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: theme.mutedText, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Evolution Timeline</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--primary)' }}>Chapter {currentChapter} / {totalChapters}</span>
              </div>
              <input type="range" min="1" max={totalChapters} step="1" value={currentChapter} onChange={(e) => setCurrentChapter(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer' }} />
            </div>
          )}
          <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', background: theme.sidebarBg, padding: '1rem 2.5rem', borderRadius: '24px', boxShadow: 'var(--shadow-lg)', border: `1px solid ${theme.borderColor}`, backdropFilter: 'blur(20px)' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {['All', 'Character', 'Location', 'Organization', 'Concept'].map(type => (
                <button key={type} onClick={() => { setActiveFilter(type); setDensity(30); }} style={{ padding: '0.6rem 1.2rem', borderRadius: '12px', border: 'none', background: activeFilter === type ? 'var(--primary)' : 'transparent', color: activeFilter === type ? 'white' : theme.mutedText, fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}>{type === 'All' ? 'GALAXY' : type.toUpperCase()}</button>
              ))}
            </div>
            <div style={{ width: '1px', height: '30px', background: theme.borderColor }}></div>
            <DensitySlider value={density} onChange={setDensity} />
          </div>
        </div>

        {/* Legend */}
        <div style={{ position: 'absolute', bottom: '2rem', right: '2rem', padding: '1rem 1.5rem', background: theme.headerBg, borderRadius: '16px', border: `1px solid ${theme.borderColor}`, fontSize: '0.75rem', display: 'flex', gap: '1.5rem', backdropFilter: 'blur(10px)' }}>
          {['Character', 'Location', 'Organization', 'Concept'].map(type => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: theme.mutedText }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: getColor(type) }}></div> {type}
            </div>
          ))}
        </div>

        {/* Side Panel */}
        <AnimatePresence>
          {(selectedNode || selectedLink) && (
            <motion.div
              initial={{ x: 450 }} animate={{ x: 0 }} exit={{ x: 450 }}
              style={{ position: 'absolute', top: '2rem', right: '2rem', bottom: '2rem', width: '420px', background: theme.sidebarBg, backdropFilter: 'blur(40px)', borderRadius: '28px', border: `1px solid ${theme.borderColor}`, padding: '2.5rem', boxShadow: '0 30px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: '2rem', zIndex: 100, color: theme.textColor }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="badge" style={{ background: 'var(--primary)22', color: 'var(--primary)', border: '1px solid var(--primary)' }}>
                  {selectedNode ? 'Entity Insight' : 'Scene Spotlight'}
                </span>
                <button onClick={() => { setSelectedNode(null); setSelectedLink(null) }} style={{ background: 'none', border: 'none', color: theme.textColor, fontSize: '1.8rem', cursor: 'pointer', opacity: 0.5 }}>×</button>
              </div>
              
              {selectedNode ? (
                <>
                  <h3 style={{ fontSize: '2.4rem', margin: 0, fontWeight: 800, fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>{selectedNode.label}</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    <div style={{ padding: '1.25rem', background: 'var(--bg-subtle)', borderRadius: '16px', border: `1px solid ${theme.borderColor}` }}>
                      <div style={{ fontSize: '0.7rem', color: theme.mutedText, fontWeight: 800, textTransform: 'uppercase' }}>OCCURRENCES</div>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{selectedNode.count}</div>
                    </div>
                    <div style={{ padding: '1.25rem', background: 'var(--bg-subtle)', borderRadius: '16px', border: `1px solid ${theme.borderColor}` }}>
                      <div style={{ fontSize: '0.7rem', color: theme.mutedText, fontWeight: 800, textTransform: 'uppercase' }}>FIRST CHAPTER</div>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{selectedNode.chapter}</div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ fontWeight: 800, fontSize: '1.2rem' }}>{selectedLink.source.label}</div>
                    <div style={{ color: 'var(--primary)', fontSize: '1.5rem' }}>&harr;</div>
                    <div style={{ fontWeight: 800, fontSize: '1.2rem' }}>{selectedLink.target.label}</div>
                  </div>
                  <div style={{ fontSize: '0.9rem', color: theme.mutedText }}>Found together in <strong>{selectedLink.weight} scenes</strong>.</div>
                  
                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {selectedLink.scenes && selectedLink.scenes.length > 0 ? (
                      selectedLink.scenes.map((scene, i) => (
                        <div key={i} style={{ fontStyle: 'italic', fontSize: '1.05rem', lineHeight: 1.6, padding: '1.5rem', background: 'var(--bg-subtle)', borderRadius: '18px', borderLeft: '4px solid var(--primary)' }}>
                          "{scene}"
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5, border: '1px dashed var(--border)', borderRadius: '12px' }}>
                        No scene context captured.
                      </div>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
