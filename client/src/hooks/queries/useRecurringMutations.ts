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

function invalidateRecurringOnly(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: recurringKeys.all })
}

function invalidateRecurringAndPending(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: recurringKeys.all })
  // Toggle-active may change the pending recurring movements count shown in the UI.
  // Use a partial prefix so all users' pendingRecurringCount queries are matched.
  queryClient.invalidateQueries({ queryKey: [...movementKeys.all, 'pendingRecurringCount'] })
}

// Accepting a pending movement promotes it to a real movement, which affects
// account balances, the monthly summary and trend charts.
function invalidateAfterAcceptOrDiscard(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: recurringKeys.all })
  queryClient.invalidateQueries({ queryKey: [...movementKeys.all, 'pendingRecurringCount'] })
  queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
  queryClient.invalidateQueries({ queryKey: movementKeys.all })
  queryClient.invalidateQueries({ queryKey: trendKeys.all })
}

export function useCreateRecurringRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateRuleInput) => createRecurringRule(input),
    onError: (err) => {
      console.error('[useCreateRecurringRule] mutation failed:', err)
    },
    onSettled: () => invalidateRecurringOnly(queryClient),
  })
}

export function useUpdateRecurringRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<RecurringRule> }) =>
      updateRecurringRule(id, updates),
    onError: (err) => {
      console.error('[useUpdateRecurringRule] mutation failed:', err)
    },
    onSettled: () => invalidateRecurringOnly(queryClient),
  })
}

export function useToggleRecurringRuleActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      toggleRecurringRuleActive(id, isActive),
    onError: (err) => {
      console.error('[useToggleRecurringRuleActive] mutation failed:', err)
    },
    onSettled: () => invalidateRecurringAndPending(queryClient),
  })
}

export function useAcceptPendingMovement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (movementId: string) => acceptPendingMovement(movementId),
    onError: (err) => {
      console.error('[useAcceptPendingMovement] mutation failed:', err)
    },
    // Accepting creates a real movement — bust dashboard, movements and trend caches.
    onSettled: () => invalidateAfterAcceptOrDiscard(queryClient),
  })
}

export function useDiscardPendingMovement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (movementId: string) => discardPendingMovement(movementId),
    onError: (err) => {
      console.error('[useDiscardPendingMovement] mutation failed:', err)
    },
    onSettled: () => invalidateAfterAcceptOrDiscard(queryClient),
  })
}
