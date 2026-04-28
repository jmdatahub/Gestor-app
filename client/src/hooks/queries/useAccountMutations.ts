import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  createAccount,
  updateAccount,
  deleteAccount,
  type CreateAccountInput,
  type Account,
} from '../../services/accountService'
import { dashboardKeys } from './useDashboardAccounts'
import { movementKeys } from './useDashboardMovements'
import { trendKeys } from './useDashboardTrend'

function invalidateAccountDerived(queryClient: ReturnType<typeof useQueryClient>) {
  // Account changes affect every dashboard derivative: balances, recent movements, trend.
  queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
  queryClient.invalidateQueries({ queryKey: movementKeys.all })
  queryClient.invalidateQueries({ queryKey: trendKeys.all })
}

export function useCreateAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateAccountInput) => createAccount(input),
    onSettled: () => invalidateAccountDerived(queryClient),
  })
}

export function useUpdateAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Account> }) =>
      updateAccount(id, updates),
    onSettled: () => invalidateAccountDerived(queryClient),
  })
}

export function useDeleteAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteAccount(id),
    onSettled: () => invalidateAccountDerived(queryClient),
  })
}
