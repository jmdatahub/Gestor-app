import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { recurringRules, movements } from '../db/schema.js'
import { and, eq, isNull, desc } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { z } from 'zod'

const router = Router()

// UUID v4 regex used for lightweight query-param validation
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const RecurringRuleSchema = z.object({
  // The client may send `kind` or `direction`; both map to the DB `direction` column.
  kind: z.enum(['income', 'expense']).optional(),
  direction: z.enum(['income', 'expense']).optional(),
  amount: z.number().positive(),
  accountId: z.string().min(1),
  frequency: z.enum(['weekly', 'monthly']),
  // category may arrive as a plain string or as an object {id, name, color}
  category: z
    .union([z.string(), z.object({ name: z.string() }).passthrough()])
    .optional()
    .nullable()
    .transform((v) => {
      if (v === null || v === undefined) return v
      if (typeof v === 'object' && 'name' in v) return v.name
      return v as string
    }),
  categoryId: z.string().uuid().optional().nullable(),
  description: z.string().optional().nullable(),
  dayOfWeek: z.number().int().min(0).max(6).optional().nullable(),
  dayOfMonth: z.number().int().min(1).max(31).optional().nullable(),
  nextOccurrence: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  autoApply: z.boolean().optional(),
  organizationId: z.string().uuid().optional().nullable(),
}).refine(
  (d) => d.kind !== undefined || d.direction !== undefined,
  { message: "Either 'kind' or 'direction' must be provided with a value of 'income' or 'expense'" }
)

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const orgId = req.query.org_id as string | undefined

  // Validate org_id when provided
  if (orgId !== undefined && !UUID_RE.test(orgId)) {
    res.status(400).json({ error: 'org_id must be a valid UUID' })
    return
  }

  const filter = orgId
    ? eq(recurringRules.organizationId, orgId)
    : and(eq(recurringRules.userId, req.userId!), isNull(recurringRules.organizationId))
  const rows = await db.select().from(recurringRules).where(and(filter, isNull(recurringRules.deletedAt)))
  res.json({ data: rows })
})

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  let body: z.infer<typeof RecurringRuleSchema>
  try {
    body = RecurringRuleSchema.parse(req.body)
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: err.errors })
      return
    }
    throw err
  }

  // Normalise kind/direction: the DB column is `direction` (NOT NULL).
  // The client typically sends `kind`; accept either and write to `direction`.
  const { kind, direction, ...rest } = body
  const resolvedDirection = (direction ?? kind) as 'income' | 'expense'

  const [row] = await db
    .insert(recurringRules)
    .values({ ...rest, direction: resolvedDirection, userId: req.userId! })
    .returning()
  res.status(201).json({ data: row })
})

router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const existing = (await db.select({ id: recurringRules.id }).from(recurringRules)
    .where(and(eq(recurringRules.id, req.params.id), eq(recurringRules.userId, req.userId!))).limit(1))[0]
  if (!existing) { res.status(404).json({ error: 'Regla no encontrada' }); return }

  let body: Partial<z.infer<typeof RecurringRuleSchema>>
  try {
    body = RecurringRuleSchema.partial().parse(req.body)
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Datos inválidos', details: err.errors }); return
    }
    throw err
  }

  const { kind, direction, ...rest } = body as Record<string, unknown>
  const updates: Record<string, unknown> = { ...rest }
  if (direction !== undefined || kind !== undefined) {
    updates.direction = direction ?? kind
  }
  // Do not allow userId/organizationId/id to be overwritten
  delete updates.userId
  delete updates.organizationId
  delete updates.id

  const [updated] = await db.update(recurringRules).set(updates as any).where(eq(recurringRules.id, req.params.id)).returning()
  res.json({ data: updated })
})

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const existing = (await db.select({ id: recurringRules.id }).from(recurringRules)
    .where(and(eq(recurringRules.id, req.params.id), eq(recurringRules.userId, req.userId!))).limit(1))[0]
  if (!existing) { res.status(404).json({ error: 'Regla no encontrada' }); return }
  await db.update(recurringRules).set({ deletedAt: new Date().toISOString() }).where(eq(recurringRules.id, req.params.id))
  res.json({ ok: true })
})

// ─── Pending movements (status = 'pending') ───────────────────────────────────
router.get('/pending', authMiddleware, async (req: AuthRequest, res: Response) => {
  const rows = await db.select().from(movements)
    .where(and(eq(movements.userId, req.userId!), eq(movements.status, 'pending'), isNull(movements.deletedAt)))
    .orderBy(desc(movements.date))
  res.json({ data: rows })
})

export default router
