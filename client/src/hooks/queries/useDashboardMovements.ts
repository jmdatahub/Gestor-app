import { useQuery } from '@tanstack/react-query'
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

// 30-second staleTime: movement summaries are expensive to compute. Mutations
// invalidate these keys explicitly on any change that affects them.
const MOVEMENTS_STALE_MS = 1000 * 30

export const useMonthlyMovementsSummary = (userId: string | null, workspaceId: string | null) => {
  return useQuery({
    queryKey: movementKeys.monthly(userId!, workspaceId),
    queryFn: async ({ signal }) => {
      const movements = await fetchMonthlyMovements(userId!, workspaceId, signal)
      const data = calculateMonthlySummary(movements || [])
      return monthlyMovementsSummarySchema.parse(data)
    },
    enabled: !!userId,
    staleTime: MOVEMENTS_STALE_MS,
  })
}

export const usePendingClassificationCount = (userId: string | null, workspaceId: string | null) => {
  return useQuery({
    queryKey: movementKeys.pendingClassificationCount(userId!, workspaceId),
    queryFn: async ({ signal }) => {
      const data = await getPendingClassificationCount(userId!, workspaceId, signal)
      return z.number().parse(data)
    },
    enabled: !!userId,
    staleTime: MOVEMENTS_STALE_MS,
  })
}

export const usePendingRecurringCount = (userId: string | null) => {
  return useQuery({
    queryKey: movementKeys.pendingRecurringCount(userId!),
    queryFn: async ({ signal }) => {
      // Trigger generation in background first; failure is non-fatal — count still proceeds.
      try {
        const generated = await generatePendingMovementsForUser(userId!)
        if (generated > 0) {
          console.log(`Generated ${generated} pending movements from recurring rules`)
        }
      } catch (err) {
        // Generation errors are non-fatal: the server may already have pending
        // movements queued. Log and continue to fetch the count.
        console.error('Error generating recurring:', err)
      }

      // This is the authoritative fetch — let any error propagate so React Query
      // marks the query as failed rather than silently returning undefined.
      const count = await getPendingMovementsCount(userId!, signal)
      return z.number().parse(count)
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes — recurring generation checks don't need to be real-time
  })
}
