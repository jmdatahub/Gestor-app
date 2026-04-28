import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  createInvestment,
  updateInvestment,
  deleteInvestment,
  updatePrice,
  type CreateInvestmentInput,
  type Investment,
} from '../../services/investmentService'
import { dashboardKeys } from './useDashboardAccounts'
import { movementKeys } from './useDashboardMovements'
import { trendKeys } from './useDashboardTrend'

export const investmentKeys = {
  all: ['investments'] as const,
  list: (userId: string, workspaceId: string | null) => [...investmentKeys.all, 'list', userId, workspaceId] as const,
  detail: (id: string) => [...investmentKeys.all, 'detail', id] as const,
  priceHistory: (id: string) => [...investmentKeys.all, 'priceHistory', id] as const,
}

function invalidateInvestmentDerived(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: investmentKeys.all })
  // createInvestment can produce a funding-account expense — bust dashboard caches too.
  queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
  queryClient.invalidateQueries({ queryKey: movementKeys.all })
  queryClient.invalidateQueries({ queryKey: trendKeys.all })
}

export function useCreateInvestment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateInvestmentInput) => createInvestment(input),
    onSettled: () => invalidateInvestmentDerived(queryClient),
  })
}

export function useUpdateInvestment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Investment> }) =>
      updateInvestment(id, updates),
    onSettled: () => invalidateInvestmentDerived(queryClient),
  })
}

export function useDeleteInvestment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteInvestment(id),
    onSettled: () => invalidateInvestmentDerived(queryClient),
  })
}

export function useUpdateInvestmentPrice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, userId, price, date }: { id: string; userId: string; price: number; date: string }) =>
      updatePrice(id, userId, price, date),
    onSettled: () => invalidateInvestmentDerived(queryClient),
  })
}
