/**
 * PwaUpdateBanner — sticky banner shown when a new service worker is waiting.
 *
 * Appears at the bottom of the screen. Clicking "Actualizar" triggers
 * SKIP_WAITING → controllerchange → window.reload() so the user always
 * gets the latest version without losing their current page context.
 */
import { RefreshCw, X } from 'lucide-react'
import { useState } from 'react'
import { usePwaUpdate } from '../hooks/usePwaUpdate'

export function PwaUpdateBanner() {
  const { updateAvailable, applyUpdate } = usePwaUpdate()
  const [dismissed, setDismissed] = useState(false)

  if (!updateAvailable || dismissed) return null

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 99990,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 20px',
        background: 'var(--bg-card, #1e293b)',
        border: '1px solid var(--primary, #4f46e5)',
        borderRadius: 14,
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        maxWidth: 'calc(100vw - 48px)',
        animation: 'pwa-banner-slide-up 0.35s cubic-bezier(0.16,1,0.3,1) forwards',
      }}
    >
      <style>{`
        @keyframes pwa-banner-slide-up {
          from { opacity: 0; transform: translateX(-50%) translateY(20px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>

      <RefreshCw
        size={18}
        style={{ color: 'var(--primary, #4f46e5)', flexShrink: 0 }}
      />

      <span style={{ fontSize: 14, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
        Nueva versión disponible
      </span>

      <button
        onClick={applyUpdate}
        style={{
          background: 'var(--primary, #4f46e5)',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          padding: '6px 14px',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        Actualizar
      </button>

      <button
        onClick={() => setDismissed(true)}
        aria-label="Cerrar"
        style={{
          background: 'transparent',
          border: 'none',
          padding: 4,
          cursor: 'pointer',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <X size={14} />
      </button>
    </div>
  )
}
