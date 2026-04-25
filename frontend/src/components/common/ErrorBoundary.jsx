import React from 'react';
import { motion } from 'framer-motion';
import { fadeUp } from '../../utils/motion';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem', background: 'var(--bg-subtle)' }}>
          <motion.div
            {...fadeUp}
            style={{ maxWidth: '600px', width: '100%', background: 'var(--bg-card)', padding: '3rem', borderRadius: '24px', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '1.5rem', textAlign: 'center' }}>⚠️</div>
            <h2 className="serif-title" style={{ fontSize: '2.5rem', marginBottom: '1rem', color: 'var(--text)', textAlign: 'center' }}>Registry Failure</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: '2rem', textAlign: 'center', lineHeight: 1.5 }}>
              The Archive encountered a critical paradox and could not render this view.
            </p>
            
            <div style={{ background: 'var(--bg-subtle)', padding: '1.5rem', borderRadius: '12px', border: '1px dashed var(--border)', overflowX: 'auto', marginBottom: '3rem' }}>
              <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem', fontWeight: 800 }}>Diagnostic Log</h4>
              <code style={{ fontSize: '0.85rem', color: 'var(--accent)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', display: 'block' }}>
                {this.state.error && this.state.error.toString()}
                {this.state.errorInfo && this.state.errorInfo.componentStack}
              </code>
            </div>

            <button 
              onClick={this.handleReset}
              className="btn--primary"
              style={{ width: '100%', padding: '1.25rem', fontSize: '1.1rem', fontWeight: 800, borderRadius: '16px' }}
            >
              Return to Main Dashboard
            </button>
          </motion.div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
