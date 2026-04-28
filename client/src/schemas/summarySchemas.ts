import { z } from 'zod'

export const financialDistributionSubItemSchema = z.object({
  name: z.string(),
  value: z.number(),
  color: z.string().optional(),
  opacity: z.number().optional(),
})

export const financialDistributionItemSchema = z.object({
  name: z.string(),
  value: z.number(),
  color: z.string(),
  subItems: z.array(financialDistributionSubItemSchema).optional(),
})

export const financialDistributionSchema = z.object({
  totalAssets: z.number(),
  liquidity: z.number(),
  savings: z.number(),
  investments: z.number(),
  distribution: z.array(financialDistributionItemSchema),
})

export type FinancialDistribution = z.infer<typeof financialDistributionSchema>
export type FinancialDistributionSubItem = z.infer<typeof financialDistributionSubItemSchema>
export type FinancialDistributionItem = z.infer<typeof financialDistributionItemSchema>
