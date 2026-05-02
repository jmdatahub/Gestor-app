import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import {
  isOnline as checkOnline,
  onOnlineStatusChange,
  syncPendingChanges,
  getPendingChanges,
  getLastSyncTime,
} from '../services/offlineService'
import { useToast } from '../components/Toast'
import { useSettings } from './SettingsContext'

// How long before cached data is considered stale when offline (5 minutes).
const STALE_THRESHOLD_MS = 5 * 60 * 1000

interface OfflineContextValue {
  isOnline: boolean
  pendingChanges: number
  lastSyncAt: number | null
  isSyncing: boolean
  syncNow: () => Promise<void>
  /** True when offline AND the last successful sync was more than 5 minutes ago. */
  isDataStale: boolean
}

const OfflineContext = createContext<OfflineContextValue | undefined>(undefined)

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(checkOnline())
  const [pendingChanges, setPendingChanges] = useState(getPendingChanges().length)
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(getLastSyncTime())
  const [isSyncing, setIsSyncing] = useState(false)
  const { showToast } = useToast()
  const { settings } = useSettings()

  const syncNow = useCallback(async () => {
    if (!checkOnline() || isSyncing) return

    setIsSyncing(true)
    try {
      const result = await syncPendingChanges()
      setPendingChanges(getPendingChanges().length)
      setLastSyncAt(getLastSyncTime())

      if (result.success > 0) {
        showToast(
          settings.language === 'es'
            ? `${result.success} cambio${result.success > 1 ? 's' : ''} sincronizado${result.success > 1 ? 's' : ''}`
            : `${result.success} change${result.success > 1 ? 's' : ''} synced`,
          'success'
        )
      }

      if (result.failed > 0) {
        showToast(
          settings.language === 'es'
            ? `${result.failed} cambio${result.failed > 1 ? 's' : ''} no se pudo${result.failed > 1 ? 'ieron' : ''} sincronizar`
            : `${result.failed} change${result.failed > 1 ? 's' : ''} failed to sync`,
          'error'
        )
      }
    } catch (err) {
      console.error('Sync error:', err)
      showToast(
        settings.language === 'es' ? 'Error al sincronizar' : 'Sync error',
        'error'
      )
    } finally {
      setIsSyncing(false)
    }
  }, [isSyncing, settings.language, showToast])

  // Monitor online status — syncNow is stable via useCallback so it is safe in deps
  useEffect(() => {
    const unsubscribe = onOnlineStatusChange((online) => {
      setIsOnline(online)

      if (online) {
        showToast(
          settings.language === 'es' ? 'Conexión restaurada' : 'Connection restored',
          'success'
        )
        // Auto-sync when back online
        syncNow()
      } else {
        showToast(
          settings.language === 'es' ? 'Sin conexión - Modo offline activo' : 'Offline - Changes will sync later',
          'warning'
        )
      }
    })

    return unsubscribe
  }, [settings.language, showToast, syncNow])

  // Refresh pending count periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setPendingChanges(getPendingChanges().length)
      setLastSyncAt(getLastSyncTime())
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  // Stale data indicator (issue #6): data is stale when offline and the last
  // sync was more than STALE_THRESHOLD_MS ago (or has never synced).
  const isDataStale =
    !isOnline &&
    (lastSyncAt === null || Date.now() - lastSyncAt > STALE_THRESHOLD_MS)

  const value = useMemo(
    () => ({ isOnline, pendingChanges, lastSyncAt, isSyncing, syncNow, isDataStale }),
    [isOnline, pendingChanges, lastSyncAt, isSyncing, syncNow, isDataStale],
  )

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  )
}

export function useOffline() {
  const ctx = useContext(OfflineContext)
  if (!ctx) throw new Error('useOffline must be used within OfflineProvider')
  return ctx
}
