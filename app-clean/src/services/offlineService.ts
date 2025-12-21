/**
 * Offline Sync Service
 * 
 * Manages offline data caching and synchronization with Supabase.
 * - Caches data locally in localStorage
 * - Queues changes when offline
 * - Syncs automatically when back online
 * - Provides manual sync option
 */

import { supabase } from '../lib/supabaseClient'

export interface PendingChange {
  id: string
  table: string
  operation: 'insert' | 'update' | 'delete'
  data: Record<string, any>
  timestamp: number
  retries: number
}

export interface SyncStatus {
  isOnline: boolean
  lastSyncAt: number | null
  pendingChanges: number
  isSyncing: boolean
}

const STORAGE_KEY = 'app-offline-queue'
const CACHE_PREFIX = 'app-cache-'
const LAST_SYNC_KEY = 'app-last-sync'

// Get user ID for namespacing cache
async function getUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id || null
}

// Queue for pending changes
export function getPendingChanges(): PendingChange[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function savePendingChanges(changes: PendingChange[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(changes))
}

export function addPendingChange(change: Omit<PendingChange, 'id' | 'timestamp' | 'retries'>): void {
  const changes = getPendingChanges()
  const newChange: PendingChange = {
    ...change,
    id: `change-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    retries: 0,
  }
  changes.push(newChange)
  savePendingChanges(changes)
}

export function removePendingChange(id: string): void {
  const changes = getPendingChanges().filter(c => c.id !== id)
  savePendingChanges(changes)
}

// Cache management
function getCacheKey(table: string, userId: string): string {
  return `${CACHE_PREFIX}${userId}-${table}`
}

export function getCachedData<T>(table: string, userId: string): T[] | null {
  try {
    const raw = localStorage.getItem(getCacheKey(table, userId))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setCachedData<T>(table: string, userId: string, data: T[]): void {
  localStorage.setItem(getCacheKey(table, userId), JSON.stringify(data))
}

export function clearCache(userId: string): void {
  const keysToRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(`${CACHE_PREFIX}${userId}`)) {
      keysToRemove.push(key)
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key))
}

// Online/Offline detection
export function isOnline(): boolean {
  return navigator.onLine
}

export function onOnlineStatusChange(callback: (online: boolean) => void): () => void {
  const handleOnline = () => callback(true)
  const handleOffline = () => callback(false)
  
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
  
  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}

// Sync operations
export async function syncPendingChanges(): Promise<{ success: number; failed: number }> {
  const changes = getPendingChanges()
  if (changes.length === 0) return { success: 0, failed: 0 }
  
  let success = 0
  let failed = 0
  
  for (const change of changes) {
    try {
      let error: any = null
      
      switch (change.operation) {
        case 'insert':
          const insertResult = await supabase.from(change.table).insert(change.data)
          error = insertResult.error
          break
        case 'update':
          const updateResult = await supabase.from(change.table)
            .update(change.data)
            .eq('id', change.data.id)
          error = updateResult.error
          break
        case 'delete':
          const deleteResult = await supabase.from(change.table)
            .delete()
            .eq('id', change.data.id)
          error = deleteResult.error
          break
      }
      
      if (error) throw error
      
      removePendingChange(change.id)
      success++
    } catch (err) {
      console.error(`Sync failed for ${change.id}:`, err)
      // Increment retry count
      const updatedChanges = getPendingChanges().map(c => 
        c.id === change.id ? { ...c, retries: c.retries + 1 } : c
      )
      savePendingChanges(updatedChanges)
      failed++
    }
  }
  
  if (success > 0) {
    localStorage.setItem(LAST_SYNC_KEY, Date.now().toString())
  }
  
  return { success, failed }
}

export function getLastSyncTime(): number | null {
  const raw = localStorage.getItem(LAST_SYNC_KEY)
  return raw ? parseInt(raw) : null
}

export function getSyncStatus(): SyncStatus {
  return {
    isOnline: isOnline(),
    lastSyncAt: getLastSyncTime(),
    pendingChanges: getPendingChanges().length,
    isSyncing: false,
  }
}

// Wrapper for offline-first data fetching
export async function fetchWithCache<T>(
  table: string,
  fetchFn: () => Promise<T[]>,
): Promise<T[]> {
  const userId = await getUserId()
  if (!userId) return []
  
  // Try to fetch from network first
  if (isOnline()) {
    try {
      const data = await fetchFn()
      setCachedData(table, userId, data)
      return data
    } catch (err) {
      console.warn(`Network fetch failed for ${table}, using cache`)
    }
  }
  
  // Fall back to cache
  const cached = getCachedData<T>(table, userId)
  return cached || []
}

// Wrapper for offline-first mutations
export async function mutateWithQueue<T extends Record<string, any>>(
  table: string,
  operation: 'insert' | 'update' | 'delete',
  data: T,
  mutationFn: () => Promise<void>,
): Promise<boolean> {
  if (isOnline()) {
    try {
      await mutationFn()
      return true
    } catch (err) {
      console.warn(`Online mutation failed, queuing for later`)
    }
  }
  
  // Queue for later sync
  addPendingChange({ table, operation, data })
  return false
}
