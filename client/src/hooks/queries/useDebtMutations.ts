import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  createDebt,
  updateDebt,
  addDebtMovement,
  type CreateDebtInput,
  type Debt,
  type DebtMovement,
} from '../../services/debtService'
import { dashboardKeys } from './useDashboardAccounts'
import { movementKeys } from './useDashboardMovements'

export const debtKeys = {
  all: ['debts'] as const,
  list: (userId: string, workspaceId: string | null) => [...debtKeys.all, 'list', userId, workspaceId] as const,
  // detail and movements include workspaceId so switching workspace never returns stale data
  detail: (debtId: string, workspaceId: string | null) => [...debtKeys.all, 'detail', debtId, workspaceId] as const,
  movements: (debtId: string, workspaceId: string | null) => [...debtKeys.all, 'movements', debtId, workspaceId] as const,
}

function invalidateDebtDerived(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: debtKeys.all })
  // Debt payments produce real movements which feed dashboard balances.
  queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
  queryClient.invalidateQueries({ queryKey: movementKeys.all })
}

// Metadata-only changes (name, notes, due_date) don't affect movements or dashboard.
function invalidateDebtOnly(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: debtKeys.all })
}

export function useCreateDebt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateDebtInput) => createDebt(input),
    onError: (err) => {
      console.error('[useCreateDebt] mutation failed:', err)
    },
    onSettled: () => invalidateDebtDerived(queryClient),
  })
}

export function useUpdateDebt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Debt> }) =>
      updateDebt(id, updates),
    onError: (err) => {
      console.error('[useUpdateDebt] mutation failed:', err)
    },
    // Metadata updates don't change balances or movements.
    onSettled: () => invalidateDebtOnly(queryClient),
  })
}

export function useAddDebtMovement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (movement: Omit<DebtMovement, 'id' | 'created_at'>) => addDebtMovement(movement),
    onError: (err) => {
      console.error('[useAddDebtMovement] mutation failed:', err)
    },
    // Debt payments create real movements which affect dashboard balances and summaries.
    onSettled: () => invalidateDebtDerived(queryClient),
  })
}
