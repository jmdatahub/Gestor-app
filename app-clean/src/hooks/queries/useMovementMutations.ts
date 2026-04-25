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

type SummarySnapshots = ReadonlyArray<[readonly unknown[], MonthlyMovementsSummary | undefined]>

// Snapshot all monthly summaries in cache and apply a delta to each, returning the snapshots
// for rollback in case the mutation fails.
async function applyOptimisticDelta(
  queryClient: ReturnType<typeof useQueryClient>,
  kind: string,
  amount: number,
  sign: 1 | -1,
): Promise<SummarySnapshots> {
  await queryClient.cancelQueries({ queryKey: movementKeys.all })
  const snapshots = queryClient.getQueriesData<MonthlyMovementsSummary>({
    queryKey: [...movementKeys.all, 'monthly'],
  })
  for (const [key, value] of snapshots) {
    queryClient.setQueryData(key, applySummaryDelta(value, kind, amount, sign))
  }
  return snapshots
}

function rollbackSnapshots(
  queryClient: ReturnType<typeof useQueryClient>,
  snapshots: SummarySnapshots | undefined,
) {
  snapshots?.forEach(([key, value]) => queryClient.setQueryData(key, value))
}

export function useCreateMovement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateMovementInput) => createMovement(input),
    onMutate: async (input) => {
      const snapshots = await applyOptimisticDelta(queryClient, input.kind, input.amount, +1)
      return { snapshots }
    },
    onError: (_err, _input, ctx) => rollbackSnapshots(queryClient, ctx?.snapshots),
    onSettled: () => invalidateMovementDerived(queryClient),
  })
}

// For optimistic update: caller passes the full original movement so we can:
// 1) reverse its previous contribution to the summary,
// 2) apply the new contribution.
// If `original` is omitted (back-compat), no optimistic update happens — only invalidation.
export function useUpdateMovement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: {
      id: string
      updates: Partial<Movement>
      original?: Pick<Movement, 'kind' | 'amount'>
    }) => updateMovement(id, updates),
    onMutate: async ({ updates, original }) => {
      if (!original) return { snapshots: undefined }
      // Reverse the original contribution.
      await applyOptimisticDelta(queryClient, original.kind, original.amount, -1)
      // Apply the new contribution (using original as fallback for unchanged fields).
      const newKind = updates.kind ?? original.kind
      const newAmount = updates.amount ?? original.amount
      const snapshots = await applyOptimisticDelta(queryClient, newKind, newAmount, +1)
      return { snapshots }
    },
    onError: (_err, _input, ctx) => rollbackSnapshots(queryClient, ctx?.snapshots),
    onSettled: () => invalidateMovementDerived(queryClient),
  })
}

// For optimistic delete: caller passes the original kind+amount so we can subtract them
// from the summary. Falls back to id-only invalidation if `original` omitted.
export function useDeleteMovement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; original?: Pick<Movement, 'kind' | 'amount'> }) =>
      deleteMovement(id),
    onMutate: async ({ original }) => {
      if (!original) return { snapshots: undefined }
      const snapshots = await applyOptimisticDelta(queryClient, original.kind, original.amount, -1)
      return { snapshots }
    },
    onError: (_err, _input, ctx) => rollbackSnapshots(queryClient, ctx?.snapshots),
    onSettled: () => invalidateMovementDerived(queryClient),
  })
}
