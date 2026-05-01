import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { debts, debtMovements } from '../db/schema.js'
import { and, eq, isNull, desc } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'

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
  if (name != null) out.counterpartyName = name
  const total = body.total_amount ?? body.totalAmount
  if (total != null) out.totalAmount = String(total)
  const remaining = body.remaining_amount ?? body.remainingAmount
  if (remaining != null) out.remainingAmount = String(remaining)
  const due = body.due_date ?? body.dueDate
  if (due != null) out.dueDate = due
  if (body.description != null) out.description = body.description
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
    const filter = orgId
      ? eq(debts.organizationId, orgId)
      : and(eq(debts.userId, req.userId!), isNull(debts.organizationId))
    const rows = await db.select().from(debts).where(and(filter, isNull(debts.deletedAt)))
      .orderBy(desc(debts.createdAt))
    res.json({ data: rows.map(r => mapOut(r as any)) })
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
    if (!mapped.direction) mapped.direction = 'i_owe'
    const [row] = await db.insert(debts).values({ ...mapped, userId: req.userId! } as any).returning()
    res.status(201).json({ data: mapOut(row as any) })
  } catch (err) {
    console.error('[debts POST /]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = (await db.select({ id: debts.id }).from(debts)
      .where(and(eq(debts.id, req.params.id as string), eq(debts.userId, req.userId!))).limit(1))[0]
    if (!existing) { res.status(404).json({ error: 'Deuda no encontrada' }); return }
    const [updated] = await db.update(debts)
      .set(mapIn(req.body) as any)
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
    await db.update(debts).set({ deletedAt: new Date().toISOString() }).where(eq(debts.id, req.params.id as string))
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
    const rows = await db.select().from(debtMovements)
      .where(eq(debtMovements.debtId, req.params.debtId as string))
      .orderBy(desc(debtMovements.date))
    res.json({ data: rows.map(r => mapOutMovement(r as any)) })
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
