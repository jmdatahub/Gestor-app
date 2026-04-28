import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { debts, debtMovements } from '../db/schema.js'
import { and, eq, isNull, desc } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'

const router = Router()

// ─── Debts ────────────────────────────────────────────────────────────────────
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const orgId = req.query.org_id as string | undefined
  const filter = orgId
    ? eq(debts.organizationId, orgId)
    : and(eq(debts.userId, req.userId!), isNull(debts.organizationId))
  const rows = await db.select().from(debts).where(and(filter, isNull(debts.deletedAt)))
    .orderBy(desc(debts.createdAt))
  res.json({ data: rows })
})

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const row = (await db.select().from(debts)
    .where(and(eq(debts.id, req.params.id), eq(debts.userId, req.userId!))).limit(1))[0]
  if (!row) { res.status(404).json({ error: 'Deuda no encontrada' }); return }
  res.json({ data: row })
})

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const [row] = await db.insert(debts).values({ ...req.body, userId: req.userId! }).returning()
  res.status(201).json({ data: row })
})

router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const existing = (await db.select({ id: debts.id }).from(debts)
    .where(and(eq(debts.id, req.params.id), eq(debts.userId, req.userId!))).limit(1))[0]
  if (!existing) { res.status(404).json({ error: 'Deuda no encontrada' }); return }
  const [updated] = await db.update(debts).set(req.body).where(eq(debts.id, req.params.id)).returning()
  res.json({ data: updated })
})

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const existing = (await db.select({ id: debts.id }).from(debts)
    .where(and(eq(debts.id, req.params.id), eq(debts.userId, req.userId!))).limit(1))[0]
  if (!existing) { res.status(404).json({ error: 'Deuda no encontrada' }); return }
  await db.update(debts).set({ deletedAt: new Date().toISOString() }).where(eq(debts.id, req.params.id))
  res.json({ ok: true })
})

// ─── Debt movements ───────────────────────────────────────────────────────────
router.get('/:debtId/movements', authMiddleware, async (req: AuthRequest, res: Response) => {
  const rows = await db.select().from(debtMovements)
    .where(eq(debtMovements.debtId, req.params.debtId))
    .orderBy(desc(debtMovements.date))
  res.json({ data: rows })
})

router.post('/:debtId/movements', authMiddleware, async (req: AuthRequest, res: Response) => {
  const [row] = await db.insert(debtMovements)
    .values({ ...req.body, debtId: req.params.debtId }).returning()
  res.status(201).json({ data: row })
})

export default router
