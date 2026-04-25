import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  createMovement,
  updateMovement,
  deleteMovement,
  type CreateMovementInput,
  type Movement,
} from '../../services/movementService'
import { dashboardKeys } from './useDashboardAccounts'
import { movementKeys } from './useDashboardMovements'
import { trendKeys } from './useDashboardTrend'
import type { MonthlyMovementsSummary } from '../../schemas/movementSchemas'

function invalidateMovementDerived(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
  queryClient.invalidateQueries({ queryKey: movementKeys.all })
  queryClient.invalidateQueries({ queryKey: trendKeys.all })
}

// Optimistic delta for the monthly summary so the dashboard KPIs feel instant.
// Exported for unit testing.
export function applySummaryDelta(
  prev: MonthlyMovementsSummary | undefined,
  kind: string,
  amount: number,
  sign: 1 | -1,
): MonthlyMovementsSummary | undefined {
  if (!prev) return prev
  const delta = sign * amount
  if (kind === 'income') {
    return { income: prev.income + delta, expense: prev.expense, balance: prev.balance + delta }
  }
  if (kind === 'expense') {
    return { income: prev.income, expense: prev.expense + delta, balance: prev.balance - delta }
  }
  return prev
}

export function useCreateMovement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateMovementInput) => createMovement(input),
    onMutate: async (input) => {
      // Optimistically bump the monthly summary so KPIs feel instant.
      await queryClient.cancelQueries({ queryKey: movementKeys.all })
      const snapshots = queryClient.getQueriesData<MonthlyMovementsSummary>({
        queryKey: [...movementKeys.all, 'monthly'],
      })
      for (const [key, value] of snapshots) {
        queryClient.setQueryData(key, applySummaryDelta(value, input.kind, input.amount, +1))
      }
      return { snapshots }
    },
    onError: (_err, _input, ctx) => {
      ctx?.snapshots.forEach(([key, value]) => queryClient.setQueryData(key, value))
    },
    onSettled: () => invalidateMovementDerived(queryClient),
  })
}

export function useUpdateMovement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Movement> }) =>
      updateMovement(id, updates),
    onSettled: () => invalidateMovementDerived(queryClient),
  })
}

export function useDeleteMovement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteMovement(id),
    onSettled: () => invalidateMovementDerived(queryClient),
  })
}
