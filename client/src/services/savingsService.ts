import { api } from '../lib/apiClient'

export type SavingsGoalStatus = 'active' | 'completed' | 'paused'

export interface SavingsGoal {
  id: string; user_id: string; organization_id?: string | null; name: string
  target_amount: number; current_amount: number; target_date?: string | null
  description?: string | null; created_at: string; is_completed?: boolean
  status?: SavingsGoalStatus
}

export interface CreateGoalInput {
  user_id: string; organization_id?: string | null; name: string
  target_amount: number; current_amount?: number; target_date?: string | null
  description?: string | null
}

export interface AddContributionInput {
  goal_id: string; user_id?: string; amount: number; date: string; note?: string | null
  source_account_id?: string | null
}
export interface SavingsContribution {
  id: string; goal_id: string; user_id: string; amount: number; date: string
  note?: string | null; created_at: string
}

export async function fetchSavingsGoals(_userId: string, organizationId?: string | null): Promise<SavingsGoal[]> {
  const params: Record<string, string> = {}
  if (organizationId) params.org_id = organizationId
  const { data } = await api.get<{ data: SavingsGoal[] }>('/api/v1/savings-goals', params)
  return data
}

export async function getSavingsGoalById(id: string): Promise<SavingsGoal | null> {
  const { data } = await api.get<{ data: SavingsGoal }>(`/api/v1/savings-goals/${id}`)
  return data
}

export async function createSavingsGoal(goal: Omit<SavingsGoal, 'id' | 'created_at'>): Promise<SavingsGoal> {
  const { data } = await api.post<{ data: SavingsGoal }>('/api/v1/savings-goals', goal)
  return data
}

export async function updateSavingsGoal(id: string, updates: Partial<SavingsGoal>): Promise<SavingsGoal> {
  const { data } = await api.patch<{ data: SavingsGoal }>(`/api/v1/savings-goals/${id}`, updates)
  return data
}

export async function deleteSavingsGoal(id: string): Promise<void> {
  await api.delete(`/api/v1/savings-goals/${id}`)
}

export async function fetchSavingsContributions(goalId: string): Promise<SavingsContribution[]> {
  const { data } = await api.get<{ data: SavingsContribution[] }>(`/api/v1/savings-goals/${goalId}/contributions`)
  return data
}

export async function addSavingsContribution(goalId: string, contribution: Omit<SavingsContribution, 'id' | 'created_at' | 'goal_id'>): Promise<SavingsContribution> {
  const { data } = await api.post<{ data: SavingsContribution }>(`/api/v1/savings-goals/${goalId}/contributions`, contribution)
  return data
}

// ---- Backward-compat aliases ----

export const getGoalsByUser = fetchSavingsGoals
export const getGoalById = getSavingsGoalById
export const getContributionsByGoal = fetchSavingsContributions

export async function createGoal(input: CreateGoalInput): Promise<SavingsGoal> {
  const payload: Omit<SavingsGoal, 'id' | 'created_at'> = {
    user_id: input.user_id,
    organization_id: input.organization_id,
    name: input.name,
    target_amount: input.target_amount,
    current_amount: input.current_amount ?? 0,
    target_date: input.target_date,
    description: input.description,
  }
  return createSavingsGoal(payload)
}

export async function updateGoal(id: string, updates: Partial<SavingsGoal>): Promise<SavingsGoal> {
  return updateSavingsGoal(id, updates)
}

export async function deleteGoal(id: string): Promise<void> {
  return deleteSavingsGoal(id)
}

export async function addContribution(input: AddContributionInput): Promise<SavingsContribution> {
  return addSavingsContribution(input.goal_id, {
    user_id: input.user_id ?? '',
    amount: input.amount,
    date: input.date,
    note: input.note,
  })
}

export async function markGoalCompleted(id: string): Promise<SavingsGoal> {
  return updateSavingsGoal(id, { is_completed: true, status: 'completed' })
}
