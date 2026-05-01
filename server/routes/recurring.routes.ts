import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { recurringRules, movements } from '../db/schema.js'
import { and, eq, isNull, desc } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'

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
  if (body.description != null) out.description = body.description
  if (body.category    != null) out.category    = typeof body.category === 'object' && 'name' in body.category ? body.category.name : body.category
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

  const filter = orgId
    ? eq(recurringRules.organizationId, orgId)
    : and(eq(recurringRules.userId, req.userId!), isNull(recurringRules.organizationId))
  const rows = await db.select().from(recurringRules).where(and(filter, isNull(recurringRules.deletedAt)))
  res.json({ data: rows.map(r => mapOut(r as any)) })
})

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const mapped = mapIn(req.body)
    if (!mapped.direction) { res.status(400).json({ error: "kind o direction es requerido ('income' o 'expense')" }); return }
    if (!mapped.accountId || !mapped.amount || !mapped.frequency) { res.status(400).json({ error: 'account_id, amount y frequency son requeridos' }); return }
    const [row] = await db.insert(recurringRules).values({ ...mapped, userId: req.userId! } as any).returning()
    res.status(201).json({ data: mapOut(row as any) })
  } catch (err) {
    console.error('[recurring POST /]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = (await db.select({ id: recurringRules.id }).from(recurringRules)
      .where(and(eq(recurringRules.id, req.params.id as string), eq(recurringRules.userId, req.userId!))).limit(1))[0]
    if (!existing) { res.status(404).json({ error: 'Regla no encontrada' }); return }
    const [updated] = await db.update(recurringRules).set(mapIn(req.body) as any).where(eq(recurringRules.id, req.params.id as string)).returning()
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
    await db.update(recurringRules).set({ deletedAt: new Date().toISOString() }).where(eq(recurringRules.id, req.params.id as string))
    res.json({ ok: true })
  } catch (err) {
    console.error('[recurring DELETE /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// ─── Pending movements (status = 'pending') ───────────────────────────────────
router.get('/pending', authMiddleware, async (req: AuthRequest, res: Response) => {
  const rows = await db.select().from(movements)
    .where(and(eq(movements.userId, req.userId!), eq(movements.status, 'pending'), isNull(movements.deletedAt)))
    .orderBy(desc(movements.date))
  res.json({ data: rows })
})

export default router
