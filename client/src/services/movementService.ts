import { api } from '../lib/apiClient'
import { invalidateCategories } from './catalogCache'

export interface Movement {
  id: string; user_id: string; organization_id?: string | null; account_id: string
  kind: 'income' | 'expense' | 'investment'; amount: number; date: string
  description: string | null; category_id: string | null; status?: string
  is_business?: boolean; created_at: string; tax_rate?: number | null
  tax_amount?: number | null; provider?: string | null; payment_method?: string | null
  paid_by_user_id?: string | null; paid_by_external?: string | null
  linked_debt_id?: string | null; is_subscription?: boolean
  subscription_end_date?: string | null; auto_renew?: boolean
  account?: { id: string; name: string }
  category?: { id: string; name: string; color?: string }
  creator?: { id: string; display_name: string | null; email: string | null } | null
}
export interface Account { id: string; user_id: string; organization_id?: string | null; name: string; type: string }
export interface Category { id: string; user_id: string; organization_id?: string | null; name: string; kind: string; color?: string; description?: string | null }

export interface MovementsPage {
  data: Movement[]
  total: number
  limit: number
  offset: number
}

export async function fetchMovements(_userId: string, limit = 50, offset = 0, organizationId?: string | null, signal?: AbortSignal): Promise<MovementsPage> {
  const params: Record<string, string | number> = { limit, offset }
  if (organizationId) params.org_id = organizationId
  const res = await api.get<MovementsPage>('/api/v1/movements', params, signal)
  const data = Array.isArray(res?.data) ? res.data : []
  return {
    data,
    total: Number.isFinite(Number(res?.total)) ? Number(res?.total) : data.length,
    limit: Number.isFinite(Number(res?.limit)) ? Number(res?.limit) : limit,
    offset: Number.isFinite(Number(res?.offset)) ? Number(res?.offset) : offset,
  }
}

export async function fetchMovementsForMonth(_userId: string, year: number, month: number, organizationId?: string | null, signal?: AbortSignal): Promise<Movement[]> {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const end = new Date(year, month, 0).toISOString().slice(0, 10) // last day of month
  const params: Record<string, string | number> = { limit: 500, startDate: start, endDate: end }
  if (organizationId) params.org_id = organizationId
  const res = await api.get<{ data: Movement[] }>('/api/v1/movements', params, signal)
  return Array.isArray(res?.data) ? res.data : []
}

export async function fetchMovementById(id: string): Promise<Movement | null> {
  const res = await api.get<{ data: Movement }>(`/api/v1/movements/${id}`)
  return res?.data ?? null
}

export async function createMovement(movement: Omit<Movement, 'id' | 'created_at'>): Promise<Movement> {
  const { data } = await api.post<{ data: Movement }>('/api/v1/movements', movement)
  invalidateCategories()
  return data
}

export async function updateMovement(id: string, updates: Partial<Movement>): Promise<Movement> {
  const { data } = await api.patch<{ data: Movement }>(`/api/v1/movements/${id}`, updates)
  return data
}

export async function deleteMovement(id: string): Promise<void> {
  await api.delete(`/api/v1/movements/${id}`)
}

export async function fetchCategories(_userId: string, organizationId?: string | null): Promise<Category[]> {
  const params: Record<string, string> = {}
  if (organizationId) params.org_id = organizationId
  const res = await api.get<{ data: Category[] }>('/api/v1/categories', params)
  return Array.isArray(res?.data) ? res.data : []
}

export async function createCategory(cat: Omit<Category, 'id'>): Promise<Category> {
  const { data } = await api.post<{ data: Category }>('/api/v1/categories', cat)
  invalidateCategories()
  return data
}

export async function fetchAccounts(_userId: string, organizationId?: string | null): Promise<Account[]> {
  const params: Record<string, string> = {}
  if (organizationId) params.org_id = organizationId
  const res = await api.get<{ data: Account[] }>('/api/v1/accounts', params)
  return Array.isArray(res?.data) ? res.data : []
}

export async function acceptPendingMovement(id: string): Promise<void> {
  await api.patch(`/api/v1/movements/${id}`, { status: 'confirmed' })
}

export async function discardPendingMovement(id: string): Promise<void> {
  await api.delete(`/api/v1/movements/${id}`)
}

// ---- Backward-compat aliases & helpers ----

export type CreateMovementInput = Omit<Movement, 'id' | 'created_at'>

export async function fetchMonthlyMovements(
  userId: string,
  organizationId?: string | null,
  signal?: AbortSignal,
): Promise<Movement[]> {
  const now = new Date()
  return fetchMovementsForMonth(userId, now.getFullYear(), now.getMonth() + 1, organizationId, signal)
}

export interface MonthlySummary {
  income: number; expense: number; balance: number
}

export function calculateMonthlySummary(movements: Movement[]): MonthlySummary {
  let income = 0; let expense = 0
  for (const m of movements) {
    if (m.kind === 'income') income += Number(m.amount)
    else if (m.kind === 'expense') expense += Number(m.amount)
  }
  return { income, expense, balance: income - expense }
}

export async function getPendingClassificationCount(
  _userId: string,
  organizationId?: string | null,
  signal?: AbortSignal,
): Promise<number> {
  const params: Record<string, string | number> = { status: 'pending', limit: 1 }
  if (organizationId) params.org_id = organizationId
  const res = await api.get<{ data: Movement[]; total: number }>('/api/v1/movements', params, signal)
  return Number(res?.total) || 0
}

export async function fetchPendingClassificationMovements(
  _userId: string,
  organizationId?: string | null,
): Promise<Movement[]> {
  const params: Record<string, string | number> = { status: 'pending', limit: 200 }
  if (organizationId) params.org_id = organizationId
  const res = await api.get<{ data: Movement[] }>('/api/v1/movements', params)
  return Array.isArray(res?.data) ? res.data : []
}

export async function getOrCreateCategory(
  userId: string,
  name: string,
  kind: string,
  organizationId?: string | null,
): Promise<Category> {
  const cats = await fetchCategories(userId, organizationId)
  const existing = cats.find(c => c.name.toLowerCase() === name.toLowerCase() && c.kind === kind)
  if (existing) return existing
  return createCategory({ user_id: userId, organization_id: organizationId ?? null, name, kind })
}
