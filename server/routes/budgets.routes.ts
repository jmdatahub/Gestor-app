import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { budgets } from '../db/schema.js'
import { and, eq } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'

const router = Router()

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const rows = await db.select().from(budgets).where(eq(budgets.userId, req.userId!))
  res.json({ data: rows })
})

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const [row] = await db.insert(budgets).values({ ...req.body, userId: req.userId! }).returning()
  res.status(201).json({ data: row })
})

router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const existing = (await db.select({ id: budgets.id }).from(budgets)
    .where(and(eq(budgets.id, req.params.id), eq(budgets.userId, req.userId!))).limit(1))[0]
  if (!existing) { res.status(404).json({ error: 'Presupuesto no encontrado' }); return }
  const [updated] = await db.update(budgets).set(req.body).where(eq(budgets.id, req.params.id)).returning()
  res.json({ data: updated })
})

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const existing = (await db.select({ id: budgets.id }).from(budgets)
    .where(and(eq(budgets.id, req.params.id), eq(budgets.userId, req.userId!))).limit(1))[0]
  if (!existing) { res.status(404).json({ error: 'Presupuesto no encontrado' }); return }
  await db.delete(budgets).where(eq(budgets.id, req.params.id))
  res.json({ ok: true })
})

export default router
