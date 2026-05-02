/**
 * OfflineBanner — prominent top-of-page banner shown while the user is offline.
 *
 * Also surfaces a "datos desactualizados" warning when the user has been
 * offline long enough that cached data is considered stale (> 5 min).
 *
 * Issues addressed: #5 (offline indicator) and #6 (stale data indicator).
 */
import { WifiOff, Clock } from 'lucide-react'
import { useOffline } from '../context/OfflineContext'

export function OfflineBanner() {
  const { isOnline, isDataStale, lastSyncAt, pendingChanges } = useOffline()

  if (isOnline) return null

  const lastSyncLabel = lastSyncAt
    ? new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' }).format(new Date(lastSyncAt))
    : null

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 9000,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 20px',
        background: isDataStale
          ? 'linear-gradient(90deg, rgba(239,68,68,0.12), rgba(220,38,38,0.08))'
          : 'linear-gradient(90deg, rgba(245,158,11,0.12), rgba(217,119,6,0.08))',
        borderBottom: isDataStale
          ? '1px solid rgba(239,68,68,0.35)'
          : '1px solid rgba(245,158,11,0.35)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      {isDataStale ? (
        <Clock size={15} style={{ color: '#ef4444', flexShrink: 0 }} />
      ) : (
        <WifiOff size={15} style={{ color: '#f59e0b', flexShrink: 0 }} />
      )}

      <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
        {isDataStale ? (
          <>
            Sin conexión — datos desactualizados
            {lastSyncLabel && (
              <span style={{ fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 6 }}>
                (última sincronización {lastSyncLabel})
              </span>
            )}
          </>
        ) : (
          <>
            Sin conexión — modo offline activo
            {pendingChanges > 0 && (
              <span style={{ fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 6 }}>
                · {pendingChanges} cambio{pendingChanges > 1 ? 's' : ''} pendiente{pendingChanges > 1 ? 's' : ''}
              </span>
            )}
          </>
        )}
      </span>
    </div>
  )
}
