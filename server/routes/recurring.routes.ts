import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { recurringRules, movements } from '../db/schema.js'
import { and, eq, isNull, desc, count } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { assertOrgMember } from '../middleware/orgMembership.js'
import { z } from 'zod'

const RecurringCreateSchema = z.object({
  direction:       z.enum(['income', 'expense']).optional(),
  kind:            z.enum(['income', 'expense']).optional(),
  amount:          z.union([z.string(), z.number()]).refine(
    (v) => { const n = parseFloat(String(v)); return !isNaN(n) && n > 0 },
    { message: 'amount debe ser un número mayor que 0' }
  ),
  frequency:       z.string().min(1),
  account_id:      z.string().uuid().optional(),
  accountId:       z.string().uuid().optional(),
  description:     z.string().max(500).optional().nullable(),
  category:        z.union([z.string(), z.object({ name: z.string() })]).optional().nullable(),
  category_id:     z.string().uuid().optional().nullable(),
  categoryId:      z.string().uuid().optional().nullable(),
  organization_id: z.string().uuid().optional().nullable(),
  organizationId:  z.string().uuid().optional().nullable(),
  is_active:       z.boolean().optional(),
  isActive:        z.boolean().optional(),
  day_of_week:     z.number().int().min(0).max(6).optional().nullable(),
  dayOfWeek:       z.number().int().min(0).max(6).optional().nullable(),
  day_of_month:    z.number().int().min(1).max(31).optional().nullable(),
  dayOfMonth:      z.number().int().min(1).max(31).optional().nullable(),
  next_occurrence: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  nextOccurrence:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  auto_apply:      z.boolean().optional(),
  autoApply:       z.boolean().optional(),
}).passthrough()

const router = Router()

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function mapOut(row: Record<string, any>) {
  return {
    ...row,
    user_id:         row.userId         ?? row.user_id,
    organization_id: row.organizationId ?? row.organization_id ?? null,
    account_id:      row.accountId      ?? row.account_id,
    category_id:     row.categoryId     ?? row.category_id     ?? null,
    is_active:       row.isActive       ?? row.is_active       ?? true,
    next_occurrence: row.nextOccurrence ?? row.next_occurrence ?? null,
    day_of_week:     row.dayOfWeek      ?? row.day_of_week     ?? null,
    day_of_month:    row.dayOfMonth     ?? row.day_of_month    ?? null,
    auto_apply:      row.autoApply      ?? row.auto_apply      ?? false,
    created_at:      row.createdAt      ?? row.created_at,
    deleted_at:      row.deletedAt      ?? row.deleted_at      ?? null,
  }
}

function mapIn(body: Record<string, any>) {
  const out: Record<string, any> = {}
  const dir = body.direction ?? body.kind; if (dir != null) out.direction = dir
  if (body.amount      != null) out.amount      = body.amount
  if (body.frequency   != null) out.frequency   = body.frequency
  if (body.description != null) out.description = typeof body.description === 'string' ? body.description.slice(0, 500) : body.description
  if (body.category    != null) {
    const catVal = typeof body.category === 'object' && body.category !== null && 'name' in body.category ? body.category.name : body.category
    out.category = typeof catVal === 'string' ? catVal.slice(0, 100) : catVal
  }
  const acct = body.account_id ?? body.accountId; if (acct != null) out.accountId = acct
  const cat  = body.category_id ?? body.categoryId; if (cat !== undefined) out.categoryId = cat ?? null
  const org  = body.organization_id ?? body.organizationId; if (org !== undefined) out.organizationId = org ?? null
  const isAct = body.is_active ?? body.isActive; if (isAct != null) out.isActive = isAct
  const dayW = body.day_of_week ?? body.dayOfWeek; if (dayW !== undefined) out.dayOfWeek = dayW
  const dayM = body.day_of_month ?? body.dayOfMonth; if (dayM !== undefined) out.dayOfMonth = dayM
  const next = body.next_occurrence ?? body.nextOccurrence; if (next !== undefined) out.nextOccurrence = next
  const auto = body.auto_apply ?? body.autoApply; if (auto != null) out.autoApply = auto
  return out
}

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const orgId = req.query.org_id as string | undefined

  // Validate org_id when provided
  if (orgId !== undefined && !UUID_RE.test(orgId)) {
    res.status(400).json({ error: 'org_id must be a valid UUID' })
    return
  }

  // Org membership check — prevent reading another org's recurring rules
  if (orgId) {
    const ok = await assertOrgMember(req, res, orgId)
    if (!ok) return
  }

  const filter = orgId
    ? eq(recurringRules.organizationId, orgId)
    : and(eq(recurringRules.userId, req.userId!), isNull(recurringRules.organizationId))
  const limit = Math.min(Number(req.query.limit) || 100, 500)
  const offset = Number(req.query.offset) || 0
  const whereClause = and(filter, isNull(recurringRules.deletedAt))
  const [rows, [{ total }]] = await Promise.all([
    db.select().from(recurringRules)
      .where(whereClause)
      .limit(limit).offset(offset),
    db.select({ total: count() }).from(recurringRules).where(whereClause),
  ])
  res.json({ data: rows.map(r => mapOut(r as any)), total: Number(total), limit, offset })
})

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Validate with Zod first
    let validated: z.infer<typeof RecurringCreateSchema>
    try {
      validated = RecurringCreateSchema.parse(req.body)
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues }); return
      }
      throw err
    }
    const mapped = mapIn(validated as any)
    if (!mapped.direction) { res.status(400).json({ error: "kind o direction es requerido ('income' o 'expense')" }); return }
    if (!mapped.accountId || !mapped.amount || !mapped.frequency) { res.status(400).json({ error: 'account_id, amount y frequency son requeridos' }); return }

    // If next_occurrence is provided, warn but do NOT reject — it may be intentional
    // (e.g. backfilling). However, if it's in the past, set it to today to avoid
    // the processor firing it immediately on every boot.
    if (mapped.nextOccurrence) {
      const nextDate = new Date(mapped.nextOccurrence)
      const today    = new Date(); today.setHours(0, 0, 0, 0)
      if (nextDate < today) {
        // Silently advance to today so the processor does not fire immediately
        mapped.nextOccurrence = today.toISOString().slice(0, 10)
      }
    }

    const actorEmail = req.userEmail ?? null
    const [row] = await db.insert(recurringRules).values({ ...mapped, userId: req.userId!, createdByEmail: actorEmail, updatedByEmail: actorEmail } as any).returning()
    res.status(201).json({ data: mapOut(row as any) })
  } catch (err) {
    console.error('[recurring POST /]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = (await db.select({ id: recurringRules.id }).from(recurringRules)
      .where(and(eq(recurringRules.id, req.params.id as string), eq(recurringRules.userId, req.userId!), isNull(recurringRules.deletedAt))).limit(1))[0]
    if (!existing) { res.status(404).json({ error: 'Regla no encontrada' }); return }

    const patch = mapIn(req.body)

    // Validate amount if being updated
    if (patch.amount !== undefined) {
      const n = parseFloat(String(patch.amount))
      if (isNaN(n) || n <= 0) {
        res.status(400).json({ error: 'amount debe ser un número mayor que 0' }); return
      }
    }

    // Advance past next_occurrence to today if it would be in the past
    if (patch.nextOccurrence) {
      const nextDate = new Date(patch.nextOccurrence)
      const today    = new Date(); today.setHours(0, 0, 0, 0)
      if (nextDate < today) {
        patch.nextOccurrence = today.toISOString().slice(0, 10)
      }
    }

    const actorEmail = req.userEmail ?? null
    const [updated] = await db.update(recurringRules).set({ ...patch, updatedByEmail: actorEmail } as any).where(eq(recurringRules.id, req.params.id as string)).returning()
    res.json({ data: mapOut(updated as any) })
  } catch (err) {
    console.error('[recurring PATCH /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = (await db.select({ id: recurringRules.id }).from(recurringRules)
      .where(and(eq(recurringRules.id, req.params.id as string), eq(recurringRules.userId, req.userId!))).limit(1))[0]
    if (!existing) { res.status(404).json({ error: 'Regla no encontrada' }); return }
    const actorEmail = req.userEmail ?? null
    await db.update(recurringRules).set({ deletedAt: new Date().toISOString(), updatedByEmail: actorEmail } as any).where(eq(recurringRules.id, req.params.id as string))
    res.json({ ok: true })
  } catch (err) {
    console.error('[recurring DELETE /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// TODO: unused, consider removing — client fetches pending movements via GET /api/v1/movements?status=pending
router.get('/pending', authMiddleware, async (req: AuthRequest, res: Response) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500)
  const offset = Number(req.query.offset) || 0
  const pendingWhere = and(eq(movements.userId, req.userId!), eq(movements.status, 'pending'), isNull(movements.deletedAt))
  const [rows, [{ total }]] = await Promise.all([
    db.select().from(movements)
      .where(pendingWhere)
      .orderBy(desc(movements.date))
      .limit(limit).offset(offset),
    db.select({ total: count() }).from(movements).where(pendingWhere),
  ])
  res.json({ data: rows, total: Number(total), limit, offset })
})

export default router
