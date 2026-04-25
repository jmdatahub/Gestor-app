import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  createGoal,
  updateGoal,
  deleteGoal,
  addContribution,
  type CreateGoalInput,
  type SavingsGoal,
  type AddContributionInput,
} from '../../services/savingsService'
import { dashboardKeys } from './useDashboardAccounts'
import { movementKeys } from './useDashboardMovements'
import { trendKeys } from './useDashboardTrend'

export const savingsKeys = {
  all: ['savings'] as const,
  list: (userId: string, workspaceId: string | null) => [...savingsKeys.all, 'list', userId, workspaceId] as const,
  detail: (goalId: string) => [...savingsKeys.all, 'detail', goalId] as const,
}

function invalidateSavingsDerived(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: savingsKeys.all })
  // Contributions create movements, so dashboard summaries are affected too.
  queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
  queryClient.invalidateQueries({ queryKey: movementKeys.all })
  queryClient.invalidateQueries({ queryKey: trendKeys.all })
}

export function useCreateSavingsGoal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateGoalInput) => createGoal(input),
    onSettled: () => invalidateSavingsDerived(queryClient),
  })
}

export function useUpdateSavingsGoal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<SavingsGoal> }) =>
      updateGoal(id, updates),
    onSettled: () => invalidateSavingsDerived(queryClient),
  })
}

export function useDeleteSavingsGoal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteGoal(id),
    onSettled: () => invalidateSavingsDerived(queryClient),
  })
}

export function useAddSavingsContribution() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: AddContributionInput) => addContribution(input),
    onSettled: () => invalidateSavingsDerived(queryClient),
  })
}
