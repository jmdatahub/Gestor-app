import { api } from '../lib/apiClient'

interface CacheEntry<T> { data: T; expiresAt: number }

const cache = new Map<string, CacheEntry<unknown>>()
const TTL = 60_000

function get<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined
  if (!entry || Date.now() > entry.expiresAt) { cache.delete(key); return null }
  return entry.data
}

function set<T>(key: string, data: T) {
  cache.set(key, { data, expiresAt: Date.now() + TTL })
}

export function invalidateAccounts() { cache.delete('accounts') }
export function invalidateCategories() { cache.delete('categories') }

export interface CachedAccount { id: string; name: string; type?: string; is_active?: boolean; [key: string]: unknown }

export async function getCachedAccounts(orgId?: string | null): Promise<CachedAccount[]> {
  const key = `accounts_${orgId ?? 'personal'}`
  const cached = get<CachedAccount[]>(key)
  if (cached) return cached
  const params: Record<string, string> = {}
  if (orgId) params.org_id = orgId
  const { data } = await api.get<{ data: CachedAccount[] }>('/api/v1/accounts', params)
  set(key, data)
  return data
}

// Backward-compat alias
export const getActiveAccounts = getCachedAccounts

// Warmup cache: called on app start to pre-populate accounts and categories
export function warmup(_userId?: string, _orgId?: string | null): void {
  // Fire-and-forget: errors intentionally ignored
  getCachedAccounts(_orgId).catch(() => {})
  getCachedCategories(_orgId).catch(() => {})
}

export async function getCachedCategories(orgId?: string | null) {
  const key = `categories_${orgId ?? 'personal'}`
  const cached = get<unknown[]>(key)
  if (cached) return cached
  const params: Record<string, string> = {}
  if (orgId) params.org_id = orgId
  const { data } = await api.get<{ data: unknown[] }>('/api/v1/categories', params)
  set(key, data)
  return data
}
