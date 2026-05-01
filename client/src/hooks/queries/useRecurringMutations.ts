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
import { movementKeys } from './useDashboardMovements'

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

export function useCreateRecurringRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateRuleInput) => createRecurringRule(input),
    onSettled: () => invalidateRecurringOnly(queryClient),
  })
}

export function useUpdateRecurringRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<RecurringRule> }) =>
      updateRecurringRule(id, updates),
    onSettled: () => invalidateRecurringOnly(queryClient),
  })
}

export function useToggleRecurringRuleActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      toggleRecurringRuleActive(id, isActive),
    onSettled: () => invalidateRecurringAndPending(queryClient),
  })
}

export function useAcceptPendingMovement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (movementId: string) => acceptPendingMovement(movementId),
    onSettled: () => invalidateRecurringAndPending(queryClient),
  })
}

export function useDiscardPendingMovement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (movementId: string) => discardPendingMovement(movementId),
    onSettled: () => invalidateRecurringAndPending(queryClient),
  })
}
