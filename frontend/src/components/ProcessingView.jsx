import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

const STATUS_MESSAGES = {
    0: 'Initializing neural engine...',
    5: 'Deciphering tome structure...',
    15: 'Linguistic pre-processing...',
    20: 'Loading NLP semantic models...',
    30: 'Extracting candidate vocabulary...',
    45: 'Calculating lexical frequency...',
    55: 'Filtering for target proficiency...',
    60: 'Synthesizing definitions...',
    80: 'Finalizing scholarly ledger...',
    90: 'Archiving results...',
    100: 'Cataloging Complete!',
}

function getStatusMessage(progress) {
    const keys = Object.keys(STATUS_MESSAGES).map(Number).sort((a, b) => b - a)
    for (const k of keys) {
        if (progress >= k) return STATUS_MESSAGES[k]
    }
    return 'Working...'
}

export default function ProcessingView({ jobId, fileName, onComplete, onCancel }) {
    const [progress, setProgress] = useState(0)
    const [statusMsg, setStatusMsg] = useState('Initializing...')
    const [error, setError] = useState('')

    useEffect(() => {
        if (!jobId) return
        const es = new EventSource(`http://localhost:8000/api/job/stream/${jobId}`)
        
        es.onmessage = async (e) => {
            const data = JSON.parse(e.data)
            setProgress(data.progress || 0)
            setStatusMsg(getStatusMessage(data.progress || 0))

            if (data.status === 'done') {
                es.close()
                try {
                    const res = await fetch(`http://localhost:8000/api/job/${jobId}`)
                    const finalData = await res.json()
                    onComplete(finalData.result)
                } catch(err) {
                    setError('Archive fetch failed.')
                }
            } else if (data.status === 'error') {
                es.close()
                setError(data.error || 'Lexical analysis failed.')
            }
        }

        es.onerror = () => {
            es.close()
            setError('Connection to archive interrupted.')
        }

        return () => es.close()
    }, [jobId, onComplete])

    if (error) {
        return (
            <div style={{ textAlign: 'center', padding: '5rem 2rem' }}>
                <div style={{ fontSize: '4rem', marginBottom: '2rem' }}>⚠️</div>
                <h2 className="serif-title" style={{ fontSize: '2.5rem' }}>Analysis Interrupted</h2>
                <div className="error-banner" style={{ maxWidth: '500px', margin: '2rem auto' }}>{error}</div>
                <button className="btn--secondary" onClick={onCancel}>Return to Library</button>
            </div>
        )
    }

    return (
        <div style={{ maxWidth: '600px', margin: '6rem auto', textAlign: 'center' }}>
            <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{ background: 'white', padding: '4rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}
            >
                <div className="loading-bar" style={{ position: 'relative', marginBottom: '3rem', height: '8px', borderRadius: '4px', background: 'var(--bg-subtle)', overflow: 'hidden' }}>
                    <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        style={{ height: '100%', background: 'var(--primary)', boxShadow: '0 0 10px rgba(var(--primary-rgb), 0.5)' }}
                    />
                </div>
                
                <h2 className="serif-title" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Cataloging volume</h2>
                <p style={{ color: 'var(--primary)', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '2rem' }}>{fileName?.toUpperCase()}</p>
                
                <div style={{ minHeight: '1.5rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                    {statusMsg}
                </div>
                <div style={{ marginTop: '1rem', fontSize: '2.5rem', fontWeight: 800, color: 'var(--text)' }}>
                    {progress}%
                </div>
                
                <p style={{ marginTop: '3rem', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    Our semantic analysis engine is reading every passage to identify high-value vocabulary for your level.
                </p>
            </motion.div>
        </div>
    )
}
