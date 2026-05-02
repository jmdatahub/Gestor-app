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
  // detail includes workspaceId so switching workspace never returns stale data
  detail: (goalId: string, workspaceId: string | null) => [...savingsKeys.all, 'detail', goalId, workspaceId] as const,
}

function invalidateSavingsDerived(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: savingsKeys.all })
  // Contributions create movements, so dashboard summaries are affected too.
  queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
  queryClient.invalidateQueries({ queryKey: movementKeys.all })
  queryClient.invalidateQueries({ queryKey: trendKeys.all })
}

// Metadata-only changes (name, target amount, notes) don't affect movements or dashboard.
function invalidateSavingsOnly(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: savingsKeys.all })
}

export function useCreateSavingsGoal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateGoalInput) => createGoal(input),
    onError: (err) => {
      console.error('[useCreateSavingsGoal] mutation failed:', err)
    },
    onSettled: () => invalidateSavingsOnly(queryClient),
  })
}

export function useUpdateSavingsGoal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<SavingsGoal> }) =>
      updateGoal(id, updates),
    onError: (err) => {
      console.error('[useUpdateSavingsGoal] mutation failed:', err)
    },
    onSettled: () => invalidateSavingsOnly(queryClient),
  })
}

export function useDeleteSavingsGoal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteGoal(id),
    onError: (err) => {
      console.error('[useDeleteSavingsGoal] mutation failed:', err)
    },
    onSettled: () => invalidateSavingsOnly(queryClient),
  })
}

export function useAddSavingsContribution() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: AddContributionInput) => addContribution(input),
    onError: (err) => {
      console.error('[useAddSavingsContribution] mutation failed:', err)
    },
    // Contributions create movements and affect account balances.
    onSettled: () => invalidateSavingsDerived(queryClient),
  })
}
