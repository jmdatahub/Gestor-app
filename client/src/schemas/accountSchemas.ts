import { z } from 'zod'

export const accountTypeSchema = z.enum(['general', 'savings', 'cash', 'bank', 'broker', 'other'])

export const accountSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  organization_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1, 'El nombre es requerido'),
  type: accountTypeSchema,
  description: z.string().nullable().optional(),
  is_active: z.boolean().default(true),
  parent_account_id: z.string().uuid().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string().nullable().optional(),
})

export const accountWithBalanceSchema = accountSchema.extend({
  balance: z.number().default(0),
})

export const accountSummarySchema = z.object({
  totalBalance: z.number(),
  accountCount: z.number(),
})

export const createAccountInputSchema = z.object({
  user_id: z.string().uuid(),
  organization_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1, 'El nombre es requerido'),
  type: accountTypeSchema,
  description: z.string().nullable().optional(),
  parent_account_id: z.string().uuid().nullable().optional(),
})

export type Account = z.infer<typeof accountSchema>
export type AccountWithBalance = z.infer<typeof accountWithBalanceSchema>
export type AccountSummary = z.infer<typeof accountSummarySchema>
export type CreateAccountInput = z.infer<typeof createAccountInputSchema>
