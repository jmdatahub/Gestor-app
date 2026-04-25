import { z } from 'zod'

export const movementKindSchema = z.enum(['income', 'expense', 'investment', 'transfer_in', 'transfer_out'])

export const movementSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  organization_id: z.string().uuid().nullable().optional(),
  account_id: z.string().uuid(),
  kind: movementKindSchema,
  amount: z.number(),
  date: z.string(),
  description: z.string().nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  status: z.string().optional(),
  is_business: z.boolean().optional(),
  created_at: z.string(),
  tax_rate: z.number().nullable().optional(),
  tax_amount: z.number().nullable().optional(),
  provider: z.string().nullable().optional(),
  payment_method: z.string().nullable().optional(),
  paid_by_user_id: z.string().uuid().nullable().optional(),
  paid_by_external: z.string().nullable().optional(),
  linked_debt_id: z.string().uuid().nullable().optional(),
  is_subscription: z.boolean().optional(),
  subscription_end_date: z.string().nullable().optional(),
  auto_renew: z.boolean().optional(),
  
  // Joined fields
  account: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }).optional(),
  category: z.object({
    id: z.string().uuid(),
    name: z.string(),
    color: z.string().optional(),
  }).nullable().optional(),
  creator: z.object({
    id: z.string().uuid(),
    display_name: z.string().nullable(),
    email: z.string().nullable(),
  }).nullable().optional(),
})

export const monthlyMovementsSummarySchema = z.object({
  income: z.number(),
  expense: z.number(),
  balance: z.number(),
})

export const createMovementInputSchema = z.object({
  user_id: z.string().uuid(),
  organization_id: z.string().uuid().nullable().optional(),
  account_id: z.string().uuid(),
  kind: z.enum(['income', 'expense', 'investment']),
  amount: z.number().positive(),
  date: z.string(),
  description: z.string().nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  tax_rate: z.number().nullable().optional(),
  tax_amount: z.number().nullable().optional(),
  provider: z.string().nullable().optional(),
  payment_method: z.string().nullable().optional(),
  paid_by_user_id: z.string().uuid().nullable().optional(),
  paid_by_external: z.string().nullable().optional(),
  linked_debt_id: z.string().uuid().nullable().optional(),
  is_subscription: z.boolean().optional(),
  subscription_end_date: z.string().nullable().optional(),
  auto_renew: z.boolean().optional(),
})

export type Movement = z.infer<typeof movementSchema>
export type CreateMovementInput = z.infer<typeof createMovementInputSchema>
export type MonthlyMovementsSummary = z.infer<typeof monthlyMovementsSummarySchema>
