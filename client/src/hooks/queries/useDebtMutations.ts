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
  detail: (debtId: string) => [...debtKeys.all, 'detail', debtId] as const,
  movements: (debtId: string) => [...debtKeys.all, 'movements', debtId] as const,
}

function invalidateDebtDerived(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: debtKeys.all })
  // Debts can produce movements (payments) which feed the dashboard.
  queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
  queryClient.invalidateQueries({ queryKey: movementKeys.all })
}

export function useCreateDebt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateDebtInput) => createDebt(input),
    onSettled: () => invalidateDebtDerived(queryClient),
  })
}

export function useUpdateDebt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Debt> }) =>
      updateDebt(id, updates),
    onSettled: () => invalidateDebtDerived(queryClient),
  })
}

export function useAddDebtMovement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (movement: Omit<DebtMovement, 'id' | 'created_at'>) => addDebtMovement(movement),
    onSettled: () => invalidateDebtDerived(queryClient),
  })
}
