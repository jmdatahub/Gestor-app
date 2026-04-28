import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { recurringRules, movements } from '../db/schema.js'
import { and, eq, isNull, desc } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'

const router = Router()

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const orgId = req.query.org_id as string | undefined
  const filter = orgId
    ? eq(recurringRules.organizationId, orgId)
    : and(eq(recurringRules.userId, req.userId!), isNull(recurringRules.organizationId))
  const rows = await db.select().from(recurringRules).where(and(filter, isNull(recurringRules.deletedAt)))
  res.json({ data: rows })
})

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const [row] = await db.insert(recurringRules).values({ ...req.body, userId: req.userId! }).returning()
  res.status(201).json({ data: row })
})

router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const existing = (await db.select({ id: recurringRules.id }).from(recurringRules)
    .where(and(eq(recurringRules.id, req.params.id), eq(recurringRules.userId, req.userId!))).limit(1))[0]
  if (!existing) { res.status(404).json({ error: 'Regla no encontrada' }); return }
  const [updated] = await db.update(recurringRules).set(req.body).where(eq(recurringRules.id, req.params.id)).returning()
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
