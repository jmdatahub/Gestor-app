import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { savingsGoals, savingsContributions } from '../db/schema.js'
import { and, eq, isNull, desc } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'

const router = Router()

// ─── Savings Goals ────────────────────────────────────────────────────────────
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const orgId = req.query.org_id as string | undefined
  const filter = orgId
    ? eq(savingsGoals.organizationId, orgId)
    : and(eq(savingsGoals.userId, req.userId!), isNull(savingsGoals.organizationId))
  const rows = await db.select().from(savingsGoals).where(filter).orderBy(desc(savingsGoals.createdAt))
  res.json({ data: rows })
})

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const row = (await db.select().from(savingsGoals)
    .where(and(eq(savingsGoals.id, req.params.id), eq(savingsGoals.userId, req.userId!))).limit(1))[0]
  if (!row) { res.status(404).json({ error: 'Meta no encontrada' }); return }
  res.json({ data: row })
})

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const [row] = await db.insert(savingsGoals).values({ ...req.body, userId: req.userId! }).returning()
  res.status(201).json({ data: row })
})

router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const existing = (await db.select({ id: savingsGoals.id }).from(savingsGoals)
    .where(and(eq(savingsGoals.id, req.params.id), eq(savingsGoals.userId, req.userId!))).limit(1))[0]
  if (!existing) { res.status(404).json({ error: 'Meta no encontrada' }); return }
  const [updated] = await db.update(savingsGoals).set(req.body).where(eq(savingsGoals.id, req.params.id)).returning()
  res.json({ data: updated })
})

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const existing = (await db.select({ id: savingsGoals.id }).from(savingsGoals)
    .where(and(eq(savingsGoals.id, req.params.id), eq(savingsGoals.userId, req.userId!))).limit(1))[0]
  if (!existing) { res.status(404).json({ error: 'Meta no encontrada' }); return }
  await db.delete(savingsGoals).where(eq(savingsGoals.id, req.params.id))
  res.json({ ok: true })
})

// ─── Savings Contributions ────────────────────────────────────────────────────
router.get('/:goalId/contributions', authMiddleware, async (req: AuthRequest, res: Response) => {
  const rows = await db.select().from(savingsContributions)
    .where(eq(savingsContributions.goalId, req.params.goalId))
    .orderBy(desc(savingsContributions.date))
  res.json({ data: rows })
})

router.post('/:goalId/contributions', authMiddleware, async (req: AuthRequest, res: Response) => {
  const [row] = await db.insert(savingsContributions)
    .values({ ...req.body, goalId: req.params.goalId, userId: req.userId! }).returning()
  res.status(201).json({ data: row })
})

export default router
