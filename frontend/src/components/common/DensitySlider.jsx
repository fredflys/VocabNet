export default function DensitySlider({ value, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '200px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Nebula Density</span>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>{value} nodes</span>
      </div>
      <input 
        type="range" 
        min="5" 
        max="100" 
        step="5"
        value={value} 
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ 
          width: '100%',
          accentColor: 'var(--primary)',
          cursor: 'pointer'
        }} 
      />
    </div>
  )
}
