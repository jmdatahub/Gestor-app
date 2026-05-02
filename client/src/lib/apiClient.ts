import { storage } from './storage'
import { enqueue } from '../services/offlineService'

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) || ''

// ---------------------------------------------------------------------------
// Security note – token storage trade-off
// ---------------------------------------------------------------------------
// The auth token lives in namespaced localStorage (see storage.ts).
// The namespace prevents dev/prod instances in the same browser from sharing
// tokens. For details on the localStorage-vs-HttpOnly-cookie trade-off see
// the comment in AuthContext.tsx.
// ---------------------------------------------------------------------------

function getToken(): string | null {
  return storage.get('auth_token')
}

/** Redirect to login and clear stored token on 401. */
function handle401(): void {
  storage.remove('auth_token')
  // Avoid redirect loops if we are already on the auth page.
  if (!window.location.pathname.startsWith('/auth')) {
    window.location.href = '/auth'
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string | number | undefined>,
  signal?: AbortSignal,
): Promise<T> {
  const url = new URL(`${API_URL}${path}`, window.location.origin)
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) url.searchParams.set(k, String(v))
    })
  }

  const token = getToken()
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  })

  if (res.status === 401) {
    const err = await res.json().catch(() => ({ error: 'Unauthorized' }))
    // Only trigger global 401 handler (logout) for authenticated requests, not for login attempts.
    if (token) handle401()
    throw Object.assign(new Error(err.error || 'Unauthorized'), { status: 401, body: err })
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw Object.assign(new Error(err.error || 'Request failed'), { status: res.status, body: err })
  }

  return res.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Offline-aware mutation helpers (issue #2)
// ---------------------------------------------------------------------------
// When the browser reports it is offline, POST / PATCH / DELETE mutations are
// enqueued in localStorage via offlineService instead of being silently lost.
// The OfflineContext replays the queue automatically when connectivity returns.
//
// Callers receive a resolved promise with `{ queued: true }` so React Query
// mutations can treat it as an optimistic success and show appropriate UI.
// GET requests are never queued — they will fail fast and the caller should
// handle the error (e.g. show cached data).
// ---------------------------------------------------------------------------

/** Thrown by offline mutation helpers so callers can detect queued ops. */
export class OfflineQueuedError extends Error {
  readonly queued = true
  constructor(path: string) {
    super(`[offline] ${path} queued for retry`)
    this.name = 'OfflineQueuedError'
  }
}

function queueOrThrow(method: 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown): never {
  // Derive a logical table name from the path (e.g. /api/v1/movements → movements)
  const table = path.split('/').filter(Boolean).at(-1) ?? 'unknown'
  enqueue({ table, method, path, body })
  throw new OfflineQueuedError(path)
}

export const api = {
  get: <T>(path: string, params?: Record<string, string | number | undefined>, signal?: AbortSignal) =>
    request<T>('GET', path, undefined, params, signal),

  post: <T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> => {
    if (!navigator.onLine) queueOrThrow('POST', path, body)
    return request<T>('POST', path, body, undefined, signal)
  },

  patch: <T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> => {
    if (!navigator.onLine) queueOrThrow('PATCH', path, body)
    return request<T>('PATCH', path, body, undefined, signal)
  },

  delete: <T>(path: string, signal?: AbortSignal): Promise<T> => {
    if (!navigator.onLine) queueOrThrow('DELETE', path)
    return request<T>('DELETE', path, undefined, undefined, signal)
  },
}
