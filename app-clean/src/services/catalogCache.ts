/**
 * catalogCache.ts
 * 
 * Cache en memoria para catálogos frecuentemente consultados.
 * Reduce llamadas repetidas a Supabase durante navegación.
 * 
 * Política:
 * - TTL: 60 segundos (configurable)
 * - Invalidación inmediata tras CRUD
 * - Cache por usuario (userId como key)
 */

import { supabase } from '../lib/supabaseClient'

// ==============================================
// TYPES
// ==============================================

interface CacheEntry<T> {
  data: T
  timestamp: number
  userId: string
}

interface Account {
  id: string
  user_id: string
  name: string
  type: string
  is_active: boolean
  parent_account_id?: string | null
  created_at: string
}

interface Category {
  id: string
  user_id: string
  name: string
  kind: 'income' | 'expense'
  color?: string
}

// ==============================================
// CONFIG
// ==============================================

const TTL_MS = 60 * 1000 // 60 seconds
const DEBUG = false // Set to true for console logs

// ==============================================
// CACHE STORAGE
// ==============================================

let accountsCache: CacheEntry<Account[]> | null = null
let categoriesCache: CacheEntry<Category[]> | null = null

// ==============================================
// HELPERS
// ==============================================

function isValid<T>(cache: CacheEntry<T> | null, userId: string): boolean {
  if (!cache) return false
  if (cache.userId !== userId) return false
  const age = Date.now() - cache.timestamp
  return age < TTL_MS
}

function log(message: string, ...args: unknown[]) {
  if (DEBUG) {
    console.log(`[CatalogCache] ${message}`, ...args)
  }
}

// ==============================================
// PUBLIC API
// ==============================================

/**
 * Get accounts for user (cached)
 * Returns cached data if valid, otherwise fetches from Supabase
 */
export async function getAccounts(userId: string): Promise<Account[]> {
  if (isValid(accountsCache, userId)) {
    log('HIT accounts cache')
    return accountsCache!.data
  }

  log('MISS accounts cache - fetching from Supabase')
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', userId)
    .order('name')

  if (error) {
    console.error('Error fetching accounts:', error)
    throw error
  }

  const accounts = data || []
  accountsCache = {
    data: accounts,
    timestamp: Date.now(),
    userId
  }

  return accounts
}

/**
 * Get active accounts only (cached, filtered)
 */
export async function getActiveAccounts(userId: string): Promise<Account[]> {
  const accounts = await getAccounts(userId)
  return accounts.filter(a => a.is_active)
}

/**
 * Get categories for user (cached)
 */
export async function getCategories(userId: string): Promise<Category[]> {
  if (isValid(categoriesCache, userId)) {
    log('HIT categories cache')
    return categoriesCache!.data
  }

  log('MISS categories cache - fetching from Supabase')
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .order('name')

  if (error) {
    // Categories table might not exist yet
    console.warn('Categories fetch failed:', error)
    return []
  }

  const categories = data || []
  categoriesCache = {
    data: categories,
    timestamp: Date.now(),
    userId
  }

  return categories
}

/**
 * Invalidate accounts cache
 * Call after create/update/delete account
 */
export function invalidateAccounts(_userId?: string) {
  log('INVALIDATE accounts cache')
  accountsCache = null
}

/**
 * Invalidate categories cache
 * Call after create/update/delete category
 */
export function invalidateCategories(_userId?: string) {
  log('INVALIDATE categories cache')
  categoriesCache = null
}

/**
 * Invalidate all caches
 * Call on logout or user switch
 */
export function invalidateAll() {
  log('INVALIDATE all caches')
  accountsCache = null
  categoriesCache = null
}

/**
 * Warmup cache (preload both catalogs)
 * Call on dashboard load for better UX
 */
export async function warmup(userId: string): Promise<void> {
  log('WARMUP starting')
  await Promise.all([
    getAccounts(userId),
    getCategories(userId)
  ])
  log('WARMUP complete')
}

/**
 * Get cache stats (for debugging)
 */
export function getCacheStats() {
  return {
    accounts: accountsCache ? {
      userId: accountsCache.userId,
      count: accountsCache.data.length,
      ageMs: Date.now() - accountsCache.timestamp
    } : null,
    categories: categoriesCache ? {
      userId: categoriesCache.userId,
      count: categoriesCache.data.length,
      ageMs: Date.now() - categoriesCache.timestamp
    } : null
  }
}
