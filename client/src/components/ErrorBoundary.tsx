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

const CHUNK_RELOAD_KEY = '__chunk_reload_attempted__'

/**
 * Detects "failed to load lazy chunk" style errors. These happen after a deploy
 * when the service worker / browser still references the previous build's chunk
 * filenames, which now return 404 / wrong MIME. They surface inconsistently
 * (one page works, another crashes) which looks suspiciously like the
 * "Patrimonio crashes in light mode" symptom but is unrelated to the theme.
 */
function isChunkLoadError(error: Error | null): boolean {
  if (!error) return false
  const msg = `${error.name} ${error.message}`.toLowerCase()
  return (
    msg.includes('chunkloaderror') ||
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('importing a module script failed') ||
    msg.includes("unexpected token '<'") // 404 HTML returned for a JS chunk
  )
}

async function purgeCachesAndReload() {
  try {
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    }
  } catch {
    // Ignore — fall through to a hard reload regardless.
  }
  // Cache-busting reload so the browser fetches the latest index.html and chunks.
  const url = new URL(window.location.href)
  url.searchParams.set('_r', Date.now().toString(36))
  window.location.replace(url.toString())
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error('[ErrorBoundary]', error, info)
    captureException(error, { extra: { componentStack: (info as { componentStack?: string })?.componentStack } })

    // Self-heal: if this looks like a stale lazy chunk (very common cause of
    // "this page crashes but others don't" after a deploy with a PWA service
    // worker), clear caches and hard-reload exactly once.
    if (isChunkLoadError(error)) {
      try {
        const alreadyTried = sessionStorage.getItem(CHUNK_RELOAD_KEY) === '1'
        if (!alreadyTried) {
          sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')
          void purgeCachesAndReload()
        }
      } catch {
        // sessionStorage might be unavailable (private mode). Best-effort reload.
        void purgeCachesAndReload()
      }
    }
  }

  handleReset = () => {
    this.setState({ error: null })
  }

  handleHardReload = () => {
    void purgeCachesAndReload()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    if (this.props.fallback) return this.props.fallback

    const isDev = typeof import.meta !== 'undefined' && (import.meta as any)?.env?.DEV
    const errorMessage = error.message || error.name || 'Error desconocido'

    return (
      <div className="page-container fade-in" role="alert" aria-live="assertive">
        <div className="panel" style={{ maxWidth: 640, margin: '40px auto' }}>
          <div className="panel-body" style={{ textAlign: 'center', padding: 32 }}>
            <div style={{ display: 'inline-flex', padding: 16, borderRadius: '50%', background: 'var(--surface-2)', marginBottom: 16 }} aria-hidden="true">
              <AlertTriangle size={32} className="text-danger" />
            </div>
            <h2 style={{ marginBottom: 8 }}>Ha ocurrido un error</h2>
            <p className="text-muted" style={{ marginBottom: 16 }}>
              No hemos podido cargar esta sección. Si el problema persiste, recarga la página.
            </p>
            <details
              style={{
                textAlign: 'left',
                background: 'var(--surface-2)',
                border: '1px solid var(--border-color)',
                borderRadius: 8,
                padding: 12,
                marginBottom: 24,
                fontSize: 13,
              }}
            >
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Detalles del error</summary>
              <pre
                style={{
                  marginTop: 8,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  color: 'var(--text-primary)',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                }}
              >
                {errorMessage}
                {isDev && error.stack ? `\n\n${error.stack}` : ''}
              </pre>
            </details>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={this.handleReset} type="button">
                <RefreshCw size={16} aria-hidden="true" />
                <span style={{ marginLeft: 6 }}>Reintentar</span>
              </button>
              <button className="btn btn-secondary" onClick={this.handleHardReload} type="button">
                Recargar página
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }
}
