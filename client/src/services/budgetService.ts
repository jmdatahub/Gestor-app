import { api } from '../lib/apiClient'

export interface Budget {
  id: string; user_id: string; organization_id?: string | null; category_id: string | null
  month: string; amount: number; created_at: string
  // camelCase aliases returned by Drizzle ORM (and snake_case compat fields)
  category_name?: string; monthly_limit?: number
  categoryName?: string; monthlyLimit?: number
}

export interface BudgetInput {
  user_id: string; organization_id?: string | null; category_id?: string | null
  month: string; amount?: number; category_name?: string; monthly_limit?: number
}

export function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export async function fetchBudgets(_userId: string, month?: string, organizationId?: string | null): Promise<Budget[]> {
  const params: Record<string, string> = {}
  if (month) params.month = month
  if (organizationId) params.org_id = organizationId
  const { data } = await api.get<{ data: Budget[] }>('/api/v1/budgets', params)
  return data
}

export async function createBudget(budget: Omit<Budget, 'id' | 'created_at'>): Promise<Budget> {
  const { data } = await api.post<{ data: Budget }>('/api/v1/budgets', budget)
  return data
}

export async function updateBudget(id: string, updates: Partial<Budget>): Promise<Budget> {
  const { data } = await api.patch<{ data: Budget }>(`/api/v1/budgets/${id}`, updates)
  return data
}

export async function deleteBudget(id: string): Promise<void> {
  await api.delete(`/api/v1/budgets/${id}`)
}

// Aliases for backward compatibility
export const getBudgetsForMonth = (userId: string, month: string, organizationId?: string | null) =>
  fetchBudgets(userId, month, organizationId)

export async function setBudget(input: BudgetInput): Promise<Budget> {
  const payload: Omit<Budget, 'id' | 'created_at'> = {
    user_id: input.user_id,
    organization_id: input.organization_id ?? null,
    category_id: input.category_id ?? null,
    month: input.month,
    amount: input.monthly_limit ?? input.amount ?? 0,
    category_name: input.category_name,
    monthly_limit: input.monthly_limit,
  }
  const { data } = await api.post<{ data: Budget }>('/api/v1/budgets', payload)
  return data
}
