import { useQuery } from '@tanstack/react-query'
import { fetchAccountsSummary } from '../../services/accountService'
import { getAccountBalancesSummary, getFinancialDistribution } from '../../services/summaryService'
import { accountSummarySchema, accountWithBalanceSchema } from '../../schemas/accountSchemas'
import { financialDistributionSchema } from '../../schemas/summarySchemas'
import { z } from 'zod'

// Keys
export const dashboardKeys = {
  all: ['dashboard'] as const,
  accountsSummary: (userId: string, workspaceId: string | null) => [...dashboardKeys.all, 'accountsSummary', userId, workspaceId] as const,
  financialDistribution: (userId: string, workspaceId: string | null) => [...dashboardKeys.all, 'financialDistribution', userId, workspaceId] as const,
  topAccounts: (userId: string, workspaceId: string | null, rollupParents: boolean) => [...dashboardKeys.all, 'topAccounts', userId, workspaceId, rollupParents] as const,
}

// Hooks
export const useAccountsSummary = (userId: string | null, workspaceId: string | null) => {
  return useQuery({
    queryKey: dashboardKeys.accountsSummary(userId!, workspaceId),
    queryFn: async () => {
      const data = await fetchAccountsSummary(userId!, workspaceId)
      return accountSummarySchema.parse(data)
    },
    enabled: !!userId,
  })
}

export const useFinancialDistribution = (userId: string | null, workspaceId: string | null) => {
  return useQuery({
    queryKey: dashboardKeys.financialDistribution(userId!, workspaceId),
    queryFn: async () => {
      const data = await getFinancialDistribution(userId!, workspaceId)
      return financialDistributionSchema.parse(data)
    },
    enabled: !!userId,
  })
}

export const useTopAccounts = (userId: string | null, workspaceId: string | null, rollupParents: boolean) => {
  return useQuery({
    queryKey: dashboardKeys.topAccounts(userId!, workspaceId, rollupParents),
    queryFn: async () => {
      const accountList = await getAccountBalancesSummary(userId!, { includeChildrenRollup: rollupParents }, workspaceId)
      if (!accountList) return []
      const validatedList = z.array(accountWithBalanceSchema).parse(accountList)
      return [...validatedList].sort((a, b) => b.balance - a.balance).slice(0, 5)
    },
    enabled: !!userId,
  })
}
