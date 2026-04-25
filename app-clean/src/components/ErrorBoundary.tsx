import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { captureException } from '../lib/sentry'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error('[ErrorBoundary]', error, info)
    // Forward to Sentry if it's been initialized; no-op otherwise.
    captureException(error, { extra: { componentStack: (info as { componentStack?: string })?.componentStack } })
  }

  handleReset = () => {
    this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    if (this.props.fallback) return this.props.fallback

    return (
      <div className="page-container fade-in" role="alert" aria-live="assertive">
        <div className="panel" style={{ maxWidth: 560, margin: '40px auto' }}>
          <div className="panel-body" style={{ textAlign: 'center', padding: 32 }}>
            <div style={{ display: 'inline-flex', padding: 16, borderRadius: '50%', background: 'var(--surface-2)', marginBottom: 16 }} aria-hidden="true">
              <AlertTriangle size={32} className="text-danger" />
            </div>
            <h2 style={{ marginBottom: 8 }}>Ha ocurrido un error</h2>
            <p className="text-muted" style={{ marginBottom: 24 }}>
              {error.message || 'No hemos podido cargar esta sección.'}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={this.handleReset} type="button">
                <RefreshCw size={16} aria-hidden="true" />
                <span style={{ marginLeft: 6 }}>Reintentar</span>
              </button>
              <button className="btn btn-secondary" onClick={() => window.location.reload()} type="button">
                Recargar página
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }
}
