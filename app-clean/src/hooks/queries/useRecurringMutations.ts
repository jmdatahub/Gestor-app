import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  createRecurringRule,
  updateRecurringRule,
  toggleRecurringRuleActive,
  acceptPendingMovement,
  discardPendingMovement,
  type CreateRuleInput,
  type RecurringRule,
} from '../../services/recurringService'
import { dashboardKeys } from './useDashboardAccounts'
import { movementKeys } from './useDashboardMovements'
import { trendKeys } from './useDashboardTrend'

export const recurringKeys = {
  all: ['recurring'] as const,
  list: (userId: string, workspaceId: string | null) => [...recurringKeys.all, 'list', userId, workspaceId] as const,
}

function invalidateRecurringDerived(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: recurringKeys.all })
  queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
  queryClient.invalidateQueries({ queryKey: movementKeys.all })
  queryClient.invalidateQueries({ queryKey: trendKeys.all })
}

export function useCreateRecurringRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateRuleInput) => createRecurringRule(input),
    onSettled: () => invalidateRecurringDerived(queryClient),
  })
}

export function useUpdateRecurringRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<RecurringRule> }) =>
      updateRecurringRule(id, updates),
    onSettled: () => invalidateRecurringDerived(queryClient),
  })
}

export function useToggleRecurringRuleActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      toggleRecurringRuleActive(id, isActive),
    onSettled: () => invalidateRecurringDerived(queryClient),
  })
}

export function useAcceptPendingMovement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (movementId: string) => acceptPendingMovement(movementId),
    onSettled: () => invalidateRecurringDerived(queryClient),
  })
}

export function useDiscardPendingMovement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (movementId: string) => discardPendingMovement(movementId),
    onSettled: () => invalidateRecurringDerived(queryClient),
  })
}
