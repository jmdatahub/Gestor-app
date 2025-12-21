/**
 * ErrorBanner - Componente reutilizable para mostrar errores normalizados
 * 
 * Muestra:
 * - Mensaje en español
 * - Botón "Ver detalles" con accordion
 * - Checklist de diagnóstico
 */

import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react'
import type { NormalizedError } from '../../utils/errorCatalog'

interface ErrorBannerProps {
  error: NormalizedError | null
  onDismiss?: () => void
  className?: string
}

export function ErrorBanner({ error, onDismiss, className = '' }: ErrorBannerProps) {
  const [showDetails, setShowDetails] = useState(false)
  const [copied, setCopied] = useState(false)
  
  if (!error) return null
  
  const handleCopyDebug = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(error.debug, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Ignore
    }
  }
  
  return (
    <div className={`error-banner ${className}`}>
      <div className="error-banner-header">
        <div className="error-banner-icon">
          <AlertTriangle size={18} />
        </div>
        <div className="error-banner-content">
          <p className="error-banner-message">{error.userMessageES}</p>
          <span className="error-banner-code">{error.code}</span>
        </div>
        {onDismiss && (
          <button 
            onClick={onDismiss} 
            className="error-banner-dismiss"
            aria-label="Cerrar"
          >
            ×
          </button>
        )}
      </div>
      
      <button 
        className="error-banner-toggle"
        onClick={() => setShowDetails(!showDetails)}
      >
        {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        <span>Ver detalles</span>
      </button>
      
      {showDetails && (
        <div className="error-banner-details">
          {/* Checklist */}
          <div className="error-checklist">
            <strong>Posibles soluciones:</strong>
            <ul>
              {error.suggestedFixChecklist.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
          
          {/* Debug info */}
          <div className="error-debug">
            <div className="error-debug-header">
              <strong>Información técnica</strong>
              <button onClick={handleCopyDebug} className="error-copy-btn">
                {copied ? <Check size={12} /> : <Copy size={12} />}
                <span>{copied ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>
            <pre>{JSON.stringify(error.debug, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  )
}

// CSS styles (add to index.css)
export const errorBannerStyles = `
.error-banner {
  background: var(--bg-danger, #fef2f2);
  border: 1px solid var(--border-danger, #fecaca);
  border-radius: var(--radius-md, 8px);
  padding: 12px;
  margin-bottom: 16px;
}

.error-banner-header {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.error-banner-icon {
  color: var(--text-danger, #dc2626);
  flex-shrink: 0;
  padding-top: 2px;
}

.error-banner-content {
  flex: 1;
  min-width: 0;
}

.error-banner-message {
  color: var(--text-danger, #991b1b);
  font-size: 14px;
  font-weight: 500;
  margin: 0;
}

.error-banner-code {
  font-size: 11px;
  color: var(--text-secondary);
  font-family: monospace;
  background: rgba(0,0,0,0.05);
  padding: 2px 6px;
  border-radius: 4px;
  display: inline-block;
  margin-top: 4px;
}

.error-banner-dismiss {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 20px;
  line-height: 1;
  padding: 0;
}

.error-banner-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  padding: 8px 0 0 0;
  transition: color 0.2s;
}

.error-banner-toggle:hover {
  color: var(--text-primary);
}

.error-banner-details {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-danger, #fecaca);
}

.error-checklist {
  font-size: 13px;
  margin-bottom: 12px;
}

.error-checklist strong {
  display: block;
  margin-bottom: 6px;
  color: var(--text-primary);
}

.error-checklist ul {
  margin: 0;
  padding-left: 20px;
}

.error-checklist li {
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.error-debug {
  background: rgba(0,0,0,0.03);
  border-radius: 6px;
  padding: 10px;
}

.error-debug-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.error-debug-header strong {
  font-size: 12px;
  color: var(--text-secondary);
}

.error-copy-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 11px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.error-copy-btn:hover {
  background: var(--bg-hover);
}

.error-debug pre {
  margin: 0;
  font-size: 11px;
  color: var(--text-secondary);
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
`
