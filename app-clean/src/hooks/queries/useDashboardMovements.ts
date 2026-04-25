import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchMonthlyMovements, calculateMonthlySummary, getPendingClassificationCount } from '../../services/movementService'
import { generatePendingMovementsForUser, getPendingMovementsCount } from '../../services/recurringService'
import { monthlyMovementsSummarySchema } from '../../schemas/movementSchemas'
import { z } from 'zod'

export const movementKeys = {
  all: ['movements'] as const,
  monthly: (userId: string, workspaceId: string | null) => [...movementKeys.all, 'monthly', userId, workspaceId] as const,
  pendingClassificationCount: (userId: string, workspaceId: string | null) => [...movementKeys.all, 'pendingClassificationCount', userId, workspaceId] as const,
  pendingRecurringCount: (userId: string) => [...movementKeys.all, 'pendingRecurringCount', userId] as const,
}

export const useMonthlyMovementsSummary = (userId: string | null, workspaceId: string | null) => {
  return useQuery({
    queryKey: movementKeys.monthly(userId!, workspaceId),
    queryFn: async () => {
      const movements = await fetchMonthlyMovements(userId!, workspaceId)
      const data = calculateMonthlySummary(movements || [])
      return monthlyMovementsSummarySchema.parse(data)
    },
    enabled: !!userId,
  })
}

export const usePendingClassificationCount = (userId: string | null, workspaceId: string | null) => {
  return useQuery({
    queryKey: movementKeys.pendingClassificationCount(userId!, workspaceId),
    queryFn: async () => {
      const data = await getPendingClassificationCount(userId!, workspaceId)
      return z.number().parse(data)
    },
    enabled: !!userId,
  })
}

export const usePendingRecurringCount = (userId: string | null) => {
  return useQuery({
    queryKey: movementKeys.pendingRecurringCount(userId!),
    queryFn: async () => {
      // Trigger generation in background first
      try {
        const generated = await generatePendingMovementsForUser(userId!)
        if (generated > 0) {
          console.log(`Generated ${generated} pending movements from recurring rules`)
        }
      } catch (err) {
        console.error('Error generating recurring:', err)
      }
      
      const count = await getPendingMovementsCount(userId!)
      return z.number().parse(count)
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes, recurring movements don't need real-time generation checks
  })
}
