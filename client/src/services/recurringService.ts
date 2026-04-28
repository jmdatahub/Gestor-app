import { api } from '../lib/apiClient'
import type { Movement } from './movementService'

export interface RecurringRule {
  id: string; user_id: string; organization_id?: string | null; name?: string
  frequency: string; amount: number; kind: string; account_id: string
  category_id?: string | null; next_occurrence: string; is_active?: boolean
  description?: string | null; created_at: string; deleted_at?: string | null
  day_of_week?: number | null; day_of_month?: number | null
  // Joined/compat fields
  category?: { id: string; name: string; color?: string } | null
  account?: { id: string; name: string } | null
}

export type CreateRuleInput = Omit<RecurringRule, 'id' | 'created_at' | 'category'> & { category?: string | null | { id: string; name: string; color?: string } }

export async function fetchRecurringRules(_userId: string, organizationId?: string | null): Promise<RecurringRule[]> {
  const params: Record<string, string> = {}
  if (organizationId) params.org_id = organizationId
  const { data } = await api.get<{ data: RecurringRule[] }>('/api/v1/recurring-rules', params)
  return data
}

export async function createRecurringRule(rule: Omit<RecurringRule, 'id' | 'created_at'> | CreateRuleInput): Promise<RecurringRule> {
  const { data } = await api.post<{ data: RecurringRule }>('/api/v1/recurring-rules', rule)
  return data
}

export async function updateRecurringRule(id: string, updates: Partial<RecurringRule>): Promise<RecurringRule> {
  const { data } = await api.patch<{ data: RecurringRule }>(`/api/v1/recurring-rules/${id}`, updates)
  return data
}

export async function deleteRecurringRule(id: string): Promise<void> {
  await api.delete(`/api/v1/recurring-rules/${id}`)
}

export async function fetchPendingMovements(_userId: string): Promise<Movement[]> {
  const { data } = await api.get<{ data: Movement[] }>('/api/v1/movements', { status: 'pending', limit: 200 })
  return data
}

export async function generatePendingFromRules(_userId: string, _organizationId?: string | null): Promise<void> {
  // handled server-side; client just refreshes
}

// ---- Backward-compat aliases & helpers ----

export const getUserRecurringRules = fetchRecurringRules

export const getPendingMovements = fetchPendingMovements

export async function toggleRecurringRuleActive(id: string, isActive: boolean): Promise<RecurringRule> {
  return updateRecurringRule(id, { is_active: isActive })
}

export async function generatePendingMovementsForUser(_userId: string): Promise<number> {
  // Server handles generation; return 0 (no local generation)
  return 0
}

export async function getPendingMovementsCount(_userId: string): Promise<number> {
  const movements = await fetchPendingMovements(_userId)
  return movements.length
}

export { acceptPendingMovement, discardPendingMovement } from './movementService'
