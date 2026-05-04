import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { debts, debtMovements } from '../db/schema.js'
import { and, eq, isNull, desc, count } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { assertOrgMember } from '../middleware/orgMembership.js'

const router = Router()

// ── Field-name bridge ──────────────────────────────────────────────────────────
function mapOut(row: Record<string, any>) {
  const direction = row.direction ?? 'i_owe'
  const isClosed  = row.isClosed  ?? row.is_closed  ?? row.isSettled ?? row.is_settled ?? false
  const name      = row.counterpartyName ?? row.counterparty_name ?? ''
  return {
    ...row,
    user_id:          row.userId          ?? row.user_id,
    organization_id:  row.organizationId  ?? row.organization_id  ?? null,
    counterparty_name:name,
    title:            name,
    total_amount:     row.totalAmount     != null ? parseFloat(row.totalAmount)     : (row.total_amount     != null ? parseFloat(row.total_amount)     : 0),
    remaining_amount: row.remainingAmount != null ? parseFloat(row.remainingAmount) : (row.remaining_amount != null ? parseFloat(row.remaining_amount) : 0),
    due_date:         row.dueDate         ?? row.due_date         ?? null,
    is_settled:       isClosed,
    is_closed:        isClosed,
    direction,
    debt_type:        direction === 'i_owe' ? 'i_owe' : 'owed_to_me',
    created_at:       row.createdAt       ?? row.created_at,
    deleted_at:       row.deletedAt       ?? row.deleted_at       ?? null,
  }
}

function mapOutMovement(row: Record<string, any>) {
  return {
    ...row,
    debt_id:    row.debtId    ?? row.debt_id,
    created_at: row.createdAt ?? row.created_at,
  }
}

function mapIn(body: Record<string, any>) {
  const out: Record<string, any> = {}
  const dir = body.direction ?? (body.debt_type === 'owed_to_me' ? 'they_owe_me' : body.debt_type)
  if (dir != null) out.direction = dir
  const name = body.counterparty_name ?? body.counterpartyName ?? body.title
  if (name != null) out.counterpartyName = typeof name === 'string' ? name.slice(0, 100) : name
  const total = body.total_amount ?? body.totalAmount
  if (total != null) out.totalAmount = String(total)
  const remaining = body.remaining_amount ?? body.remainingAmount
  if (remaining != null) out.remainingAmount = String(remaining)
  const due = body.due_date ?? body.dueDate
  if (due != null) out.dueDate = due
  if (body.description != null) out.description = typeof body.description === 'string' ? body.description.slice(0, 500) : body.description
  const closed = body.is_closed ?? body.isClosed ?? body.is_settled ?? body.isSettled
  if (closed != null) out.isClosed = closed
  const org = body.organization_id ?? body.organizationId
  if (org !== undefined) out.organizationId = org ?? null
  return out
}

// ─── Debts ────────────────────────────────────────────────────────────────────
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.query.org_id as string | undefined
    if (orgId) {
      const ok = await assertOrgMember(req, res, orgId)
      if (!ok) return
    }
    const filter = orgId
      ? eq(debts.organizationId, orgId)
      : and(eq(debts.userId, req.userId!), isNull(debts.organizationId))
    const limit = Math.min(Number(req.query.limit) || 100, 500)
    const offset = Number(req.query.offset) || 0
    const whereClause = and(filter, isNull(debts.deletedAt))
    const [rows, [{ total }]] = await Promise.all([
      db.select().from(debts).where(whereClause)
        .orderBy(desc(debts.createdAt))
        .limit(limit).offset(offset),
      db.select({ total: count() }).from(debts).where(whereClause),
    ])
    res.json({ data: rows.map(r => mapOut(r as any)), total: Number(total), limit, offset })
  } catch (err) {
    console.error('[debts GET /]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const row = (await db.select().from(debts)
      .where(and(eq(debts.id, req.params.id as string), eq(debts.userId, req.userId!))).limit(1))[0]
    if (!row) { res.status(404).json({ error: 'Deuda no encontrada' }); return }
    res.json({ data: mapOut(row as any) })
  } catch (err) {
    console.error('[debts GET /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const mapped = mapIn(req.body)
    if (!mapped.counterpartyName || !mapped.totalAmount) {
      res.status(400).json({ error: 'counterparty_name y total_amount son requeridos' }); return
    }
    // Reject total_amount of 0 or negative
    const totalNum = parseFloat(mapped.totalAmount)
    if (isNaN(totalNum) || totalNum <= 0) {
      res.status(400).json({ error: 'total_amount debe ser un número mayor que 0' }); return
    }
    if (!mapped.direction) mapped.direction = 'i_owe'
    const actorEmail = req.userEmail ?? null
    const [row] = await db.insert(debts).values({ ...mapped, userId: req.userId!, createdByEmail: actorEmail, updatedByEmail: actorEmail } as any).returning()
    res.status(201).json({ data: mapOut(row as any) })
  } catch (err) {
    console.error('[debts POST /]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Include isNull(deletedAt) to prevent updating soft-deleted records
    const existing = (await db.select({ id: debts.id }).from(debts)
      .where(and(eq(debts.id, req.params.id as string), eq(debts.userId, req.userId!), isNull(debts.deletedAt))).limit(1))[0]
    if (!existing) { res.status(404).json({ error: 'Deuda no encontrada' }); return }
    const patch = mapIn(req.body)
    // Reject total_amount of 0 or negative if being updated
    if (patch.totalAmount !== undefined) {
      const n = parseFloat(patch.totalAmount)
      if (isNaN(n) || n <= 0) {
        res.status(400).json({ error: 'total_amount debe ser un número mayor que 0' }); return
      }
    }
    const actorEmail = req.userEmail ?? null
    const [updated] = await db.update(debts)
      .set({ ...patch, updatedByEmail: actorEmail } as any)
      .where(eq(debts.id, req.params.id as string))
      .returning()
    res.json({ data: mapOut(updated as any) })
  } catch (err) {
    console.error('[debts PATCH /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = (await db.select({ id: debts.id }).from(debts)
      .where(and(eq(debts.id, req.params.id as string), eq(debts.userId, req.userId!))).limit(1))[0]
    if (!existing) { res.status(404).json({ error: 'Deuda no encontrada' }); return }
    const actorEmail = req.userEmail ?? null
    await db.update(debts).set({ deletedAt: new Date().toISOString(), updatedByEmail: actorEmail } as any).where(eq(debts.id, req.params.id as string))
    res.json({ ok: true })
  } catch (err) {
    console.error('[debts DELETE /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// ─── Debt movements ───────────────────────────────────────────────────────────
router.get('/:debtId/movements', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const debt = (await db.select({ id: debts.id }).from(debts)
      .where(and(eq(debts.id, req.params.debtId as string), eq(debts.userId, req.userId!))).limit(1))[0]
    if (!debt) { res.status(404).json({ error: 'Deuda no encontrada' }); return }
    const limit = Math.min(Number(req.query.limit) || 100, 500)
    const offset = Number(req.query.offset) || 0
    const movWhere = eq(debtMovements.debtId, req.params.debtId as string)
    const [rows, [{ total }]] = await Promise.all([
      db.select().from(debtMovements)
        .where(movWhere)
        .orderBy(desc(debtMovements.date))
        .limit(limit).offset(offset),
      db.select({ total: count() }).from(debtMovements).where(movWhere),
    ])
    res.json({ data: rows.map(r => mapOutMovement(r as any)), total: Number(total), limit, offset })
  } catch (err) {
    console.error('[debts GET /:debtId/movements]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.post('/:debtId/movements', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const debt = (await db.select({ id: debts.id }).from(debts)
      .where(and(eq(debts.id, req.params.debtId as string), eq(debts.userId, req.userId!))).limit(1))[0]
    if (!debt) { res.status(404).json({ error: 'Deuda no encontrada' }); return }
    const amount = req.body.amount
    const date   = req.body.date
    if (!amount || !date) { res.status(400).json({ error: 'amount y date son requeridos' }); return }
    const [row] = await db.insert(debtMovements)
      .values({ amount: String(amount), date, description: req.body.description ?? null, debtId: req.params.debtId as string } as any)
      .returning()
    res.status(201).json({ data: mapOutMovement(row as any) })
  } catch (err) {
    console.error('[debts POST /:debtId/movements]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
