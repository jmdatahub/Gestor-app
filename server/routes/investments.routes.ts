import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { investments, investmentPriceHistory } from '../db/schema.js'
import { and, eq, isNull, desc } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'

const router = Router()

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const orgId = req.query.org_id as string | undefined
  const filter = orgId
    ? eq(investments.organizationId, orgId)
    : and(eq(investments.userId, req.userId!), isNull(investments.organizationId))
  const rows = await db.select().from(investments).where(and(filter, isNull(investments.deletedAt)))
    .orderBy(desc(investments.createdAt))
  res.json({ data: rows })
})

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const row = (await db.select().from(investments)
    .where(and(eq(investments.id, req.params.id), eq(investments.userId, req.userId!))).limit(1))[0]
  if (!row) { res.status(404).json({ error: 'Inversión no encontrada' }); return }
  res.json({ data: row })
})

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const [row] = await db.insert(investments).values({ ...req.body, userId: req.userId! }).returning()
  res.status(201).json({ data: row })
})

router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const existing = (await db.select({ id: investments.id }).from(investments)
    .where(and(eq(investments.id, req.params.id), eq(investments.userId, req.userId!))).limit(1))[0]
  if (!existing) { res.status(404).json({ error: 'Inversión no encontrada' }); return }
  const [updated] = await db.update(investments).set(req.body).where(eq(investments.id, req.params.id)).returning()
  res.json({ data: updated })
})

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const existing = (await db.select({ id: investments.id }).from(investments)
    .where(and(eq(investments.id, req.params.id), eq(investments.userId, req.userId!))).limit(1))[0]
  if (!existing) { res.status(404).json({ error: 'Inversión no encontrada' }); return }
  await db.delete(investmentPriceHistory).where(eq(investmentPriceHistory.investmentId, req.params.id))
  await db.update(investments).set({ deletedAt: new Date().toISOString() }).where(eq(investments.id, req.params.id))
  res.json({ ok: true })
})

// ─── Price History ────────────────────────────────────────────────────────────
router.get('/:id/price-history', authMiddleware, async (req: AuthRequest, res: Response) => {
  const rows = await db.select().from(investmentPriceHistory)
    .where(eq(investmentPriceHistory.investmentId, req.params.id))
    .orderBy(desc(investmentPriceHistory.date))
  res.json({ data: rows })
})

router.post('/:id/price-history', authMiddleware, async (req: AuthRequest, res: Response) => {
  const [row] = await db.insert(investmentPriceHistory)
    .values({ ...req.body, investmentId: req.params.id }).returning()
  res.status(201).json({ data: row })
})

export default router
