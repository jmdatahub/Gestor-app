import { api } from '../lib/apiClient'

export type OfflineOperation = {
  id: string
  table: string
  method: 'POST' | 'PATCH' | 'DELETE'
  path: string
  body?: unknown
  timestamp: number
}

const QUEUE_KEY = 'offline_queue'
const LAST_SYNC_KEY = 'offline_last_sync'

export function getQueue(): OfflineOperation[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]') } catch { return [] }
}

function saveQueue(q: OfflineOperation[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
}

export function enqueue(op: Omit<OfflineOperation, 'id' | 'timestamp'>) {
  const q = getQueue()
  q.push({ ...op, id: crypto.randomUUID(), timestamp: Date.now() })
  saveQueue(q)
}

export function clearQueue() { localStorage.removeItem(QUEUE_KEY) }

// ---- Online status helpers ----

export function isOnline(): boolean {
  return navigator.onLine
}

type OnlineListener = (online: boolean) => void

export function onOnlineStatusChange(listener: OnlineListener): () => void {
  const handleOnline = () => listener(true)
  const handleOffline = () => listener(false)
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}

// ---- Sync helpers ----

export function getPendingChanges(): OfflineOperation[] {
  return getQueue()
}

export function getLastSyncTime(): number | null {
  const v = localStorage.getItem(LAST_SYNC_KEY)
  return v ? parseInt(v, 10) : null
}

function setLastSyncTime() {
  localStorage.setItem(LAST_SYNC_KEY, String(Date.now()))
}

export async function syncPendingChanges(): Promise<{ success: number; failed: number }> {
  const q = getQueue()
  if (!q.length) return { success: 0, failed: 0 }
  let success = 0; let failed = 0
  const remaining: OfflineOperation[] = []
  for (const op of q) {
    try {
      if (op.method === 'POST') await api.post(op.path, op.body)
      else if (op.method === 'PATCH') await api.patch(op.path, op.body)
      else if (op.method === 'DELETE') await api.delete(op.path)
      success++
    } catch { failed++; remaining.push(op) }
  }
  saveQueue(remaining)
  setLastSyncTime()
  return { success, failed }
}

// Legacy alias
export const replayQueue = syncPendingChanges
