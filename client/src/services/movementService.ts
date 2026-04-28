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

export async function fetchMovements(_userId: string, limit = 50, offset = 0, organizationId?: string | null): Promise<Movement[]> {
  const params: Record<string, string | number> = { limit, offset }
  if (organizationId) params.org_id = organizationId
  const { data } = await api.get<{ data: Movement[] }>('/api/v1/movements', params)
  return data
}

export async function fetchMovementsForMonth(_userId: string, year: number, month: number, organizationId?: string | null): Promise<Movement[]> {
  const params: Record<string, string | number> = { limit: 500, year, month }
  if (organizationId) params.org_id = organizationId
  const { data } = await api.get<{ data: Movement[] }>('/api/v1/movements', params)
  return data
}

export async function fetchMovementById(id: string): Promise<Movement | null> {
  const { data } = await api.get<{ data: Movement }>(`/api/v1/movements/${id}`)
  return data
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
  const { data } = await api.get<{ data: Category[] }>('/api/v1/categories', params)
  return data
}

export async function createCategory(cat: Omit<Category, 'id'>): Promise<Category> {
  const { data } = await api.post<{ data: Category }>('/api/v1/categories', cat)
  invalidateCategories()
  return data
}

export async function fetchAccounts(_userId: string, organizationId?: string | null): Promise<Account[]> {
  const params: Record<string, string> = {}
  if (organizationId) params.org_id = organizationId
  const { data } = await api.get<{ data: Account[] }>('/api/v1/accounts', params)
  return data
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
): Promise<Movement[]> {
  const now = new Date()
  return fetchMovementsForMonth(userId, now.getFullYear(), now.getMonth() + 1, organizationId)
}

export interface MonthlySummary {
  income: number; expense: number; balance: number
}

export function calculateMonthlySummary(movements: Movement[]): MonthlySummary {
  let income = 0; let expense = 0
  for (const m of movements) {
    if (m.kind === 'income') income += m.amount
    else if (m.kind === 'expense') expense += m.amount
  }
  return { income, expense, balance: income - expense }
}

export async function getPendingClassificationCount(
  _userId: string,
  organizationId?: string | null,
): Promise<number> {
  const params: Record<string, string | number> = { status: 'pending', limit: 1 }
  if (organizationId) params.org_id = organizationId
  const { total } = await api.get<{ data: Movement[]; total: number }>('/api/v1/movements', params)
  return total ?? 0
}

export async function fetchPendingClassificationMovements(
  _userId: string,
  organizationId?: string | null,
): Promise<Movement[]> {
  const params: Record<string, string | number> = { status: 'pending', limit: 200 }
  if (organizationId) params.org_id = organizationId
  const { data } = await api.get<{ data: Movement[] }>('/api/v1/movements', params)
  return data
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
