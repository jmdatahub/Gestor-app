import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { savingsGoals, savingsContributions } from '../db/schema.js'
import { and, eq, isNull, desc } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'

const router = Router()

// ── Field-name bridge (Drizzle camelCase ↔ client snake_case) ─────────────────
function mapOut(row: Record<string, any>) {
  return {
    ...row,
    user_id:        row.userId        ?? row.user_id,
    organization_id:row.organizationId?? row.organization_id ?? null,
    target_amount:  row.targetAmount  != null ? parseFloat(row.targetAmount)  : (row.target_amount  != null ? parseFloat(row.target_amount)  : null),
    current_amount: row.currentAmount != null ? parseFloat(row.currentAmount) : (row.current_amount != null ? parseFloat(row.current_amount) : 0),
    target_date:    row.targetDate    ?? row.target_date    ?? null,
    is_active:      row.isActive      ?? row.is_active      ?? true,
    created_at:     row.createdAt     ?? row.created_at,
    updated_at:     row.updatedAt     ?? row.updated_at,
  }
}

function mapOutContribution(row: Record<string, any>) {
  return {
    ...row,
    goal_id:    row.goalId    ?? row.goal_id,
    user_id:    row.userId    ?? row.user_id,
    created_at: row.createdAt ?? row.created_at,
  }
}

// Accepts snake_case from client, converts to camelCase for Drizzle
function mapIn(body: Record<string, any>) {
  const out: Record<string, any> = {}
  const name = body.name; if (name != null) out.name = name
  const target = body.target_amount ?? body.targetAmount; if (target != null) out.targetAmount = String(target)
  const current = body.current_amount ?? body.currentAmount; if (current != null) out.currentAmount = String(current)
  const date = body.target_date ?? body.targetDate; if (date != null) out.targetDate = date
  const desc = body.description; if (desc != null) out.description = desc
  const color = body.color; if (color != null) out.color = color
  const icon = body.icon; if (icon != null) out.icon = icon
  const status = body.status; if (status != null) out.status = status
  const org = body.organization_id ?? body.organizationId; if (org !== undefined) out.organizationId = org ?? null
  const isCompleted = body.is_completed ?? body.isCompleted; if (isCompleted != null) out.status = isCompleted ? 'completed' : 'active'
  return out
}


// ─── Savings Goals ────────────────────────────────────────────────────────────
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.query.org_id as string | undefined
    const filter = orgId
      ? eq(savingsGoals.organizationId, orgId)
      : and(eq(savingsGoals.userId, req.userId!), isNull(savingsGoals.organizationId))
    const rows = await db.select().from(savingsGoals).where(filter).orderBy(desc(savingsGoals.createdAt))
    res.json({ data: rows.map(r => mapOut(r as any)) })
  } catch (err) {
    console.error('[savings GET /]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const row = (await db.select().from(savingsGoals)
      .where(and(eq(savingsGoals.id, req.params.id as string), eq(savingsGoals.userId, req.userId!))).limit(1))[0]
    if (!row) { res.status(404).json({ error: 'Meta no encontrada' }); return }
    res.json({ data: mapOut(row as any) })
  } catch (err) {
    console.error('[savings GET /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const mapped = mapIn(req.body)
    if (!mapped.name || !mapped.targetAmount) {
      res.status(400).json({ error: 'name y target_amount son requeridos' }); return
    }
    const [row] = await db.insert(savingsGoals).values({ ...mapped, userId: req.userId! } as any).returning()
    res.status(201).json({ data: mapOut(row as any) })
  } catch (err) {
    console.error('[savings POST /]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = (await db.select({ id: savingsGoals.id }).from(savingsGoals)
      .where(and(eq(savingsGoals.id, req.params.id as string), eq(savingsGoals.userId, req.userId!))).limit(1))[0]
    if (!existing) { res.status(404).json({ error: 'Meta no encontrada' }); return }
    const [updated] = await db.update(savingsGoals)
      .set(mapIn(req.body) as any)
      .where(eq(savingsGoals.id, req.params.id as string))
      .returning()
    res.json({ data: mapOut(updated as any) })
  } catch (err) {
    console.error('[savings PATCH /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = (await db.select({ id: savingsGoals.id }).from(savingsGoals)
      .where(and(eq(savingsGoals.id, req.params.id as string), eq(savingsGoals.userId, req.userId!))).limit(1))[0]
    if (!existing) { res.status(404).json({ error: 'Meta no encontrada' }); return }
    await db.delete(savingsGoals).where(eq(savingsGoals.id, req.params.id as string))
    res.json({ ok: true })
  } catch (err) {
    console.error('[savings DELETE /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// ─── Savings Contributions ────────────────────────────────────────────────────
router.get('/:goalId/contributions', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const goal = (await db.select({ id: savingsGoals.id }).from(savingsGoals)
      .where(and(eq(savingsGoals.id, req.params.goalId as string), eq(savingsGoals.userId, req.userId!))).limit(1))[0]
    if (!goal) { res.status(404).json({ error: 'Meta no encontrada' }); return }
    const rows = await db.select().from(savingsContributions)
      .where(eq(savingsContributions.goalId, req.params.goalId as string))
      .orderBy(desc(savingsContributions.date))
    res.json({ data: rows.map(r => mapOutContribution(r as any)) })
  } catch (err) {
    console.error('[savings GET /:goalId/contributions]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.post('/:goalId/contributions', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const goal = (await db.select({ id: savingsGoals.id }).from(savingsGoals)
      .where(and(eq(savingsGoals.id, req.params.goalId as string), eq(savingsGoals.userId, req.userId!))).limit(1))[0]
    if (!goal) { res.status(404).json({ error: 'Meta no encontrada' }); return }
    const amount = req.body.amount
    const date   = req.body.date
    if (!amount || !date) { res.status(400).json({ error: 'amount y date son requeridos' }); return }
    const [row] = await db.insert(savingsContributions)
      .values({ amount: String(amount), date, notes: req.body.notes ?? req.body.note ?? null, goalId: req.params.goalId as string, userId: req.userId! } as any)
      .returning()
    // Update current_amount on the goal
    const [current] = await db.select({ currentAmount: savingsGoals.currentAmount }).from(savingsGoals).where(eq(savingsGoals.id, req.params.goalId as string)).limit(1)
    const newAmount = (parseFloat(current?.currentAmount ?? '0') + parseFloat(String(amount))).toFixed(2)
    await db.update(savingsGoals).set({ currentAmount: newAmount } as any).where(eq(savingsGoals.id, req.params.goalId as string))
    res.status(201).json({ data: mapOutContribution(row as any) })
  } catch (err) {
    console.error('[savings POST /:goalId/contributions]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
