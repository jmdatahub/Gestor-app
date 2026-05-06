import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  createInvestment,
  updateInvestment,
  deleteInvestment,
  updatePrice,
  createInvestmentMovement,
  type CreateInvestmentInput,
  type CreateMovementInput,
  type Investment,
} from '../../services/investmentService'
import { dashboardKeys } from './useDashboardAccounts'
import { movementKeys } from './useDashboardMovements'
import { trendKeys } from './useDashboardTrend'

export const investmentKeys = {
  all: ['investments'] as const,
  list: (userId: string, workspaceId: string | null) => [...investmentKeys.all, 'list', userId, workspaceId] as const,
  // detail and priceHistory include workspaceId so switching workspace never returns stale data
  detail: (id: string, workspaceId: string | null) => [...investmentKeys.all, 'detail', id, workspaceId] as const,
  priceHistory: (id: string, workspaceId: string | null) => [...investmentKeys.all, 'priceHistory', id, workspaceId] as const,
}

function invalidateInvestmentDerived(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: investmentKeys.all })
  // createInvestment can produce a funding-account expense — bust dashboard caches too.
  queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
  queryClient.invalidateQueries({ queryKey: movementKeys.all })
  queryClient.invalidateQueries({ queryKey: trendKeys.all })
}

// Price updates only affect investment data; they don't create new movements.
function invalidateInvestmentOnly(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: investmentKeys.all })
}

export function useCreateInvestment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateInvestmentInput) => createInvestment(input),
    onError: (err) => {
      console.error('[useCreateInvestment] mutation failed:', err)
    },
    onSettled: () => invalidateInvestmentDerived(queryClient),
  })
}

export function useUpdateInvestment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Investment> }) =>
      updateInvestment(id, updates),
    onError: (err) => {
      console.error('[useUpdateInvestment] mutation failed:', err)
    },
    onSettled: () => invalidateInvestmentDerived(queryClient),
  })
}

export function useDeleteInvestment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteInvestment(id),
    onError: (err) => {
      console.error('[useDeleteInvestment] mutation failed:', err)
    },
    onSettled: () => invalidateInvestmentDerived(queryClient),
  })
}

export function useUpdateInvestmentPrice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, userId, price, date }: { id: string; userId: string; price: number; date: string }) =>
      updatePrice(id, userId, price, date),
    onError: (err) => {
      console.error('[useUpdateInvestmentPrice] mutation failed:', err)
    },
    // Price updates only affect the investment record, not movements or dashboard balances.
    onSettled: () => invalidateInvestmentOnly(queryClient),
  })
}

export function useCreateInvestmentMovement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CreateMovementInput }) =>
      createInvestmentMovement(id, input),
    onError: (err) => {
      console.error('[useCreateInvestmentMovement] mutation failed:', err)
    },
    // Movements may affect funding accounts (buy = expense, sell = income) so bust dashboard caches too.
    onSettled: () => invalidateInvestmentDerived(queryClient),
  })
}
