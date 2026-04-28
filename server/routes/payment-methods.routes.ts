import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { paymentMethods } from '../db/schema.js'
import { and, eq, asc } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'

const router = Router()

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const rows = await db.select().from(paymentMethods)
    .where(eq(paymentMethods.userId, req.userId!))
    .orderBy(asc(paymentMethods.name))
  res.json({ data: rows })
})

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const [row] = await db.insert(paymentMethods).values({ ...req.body, userId: req.userId! }).returning()
  res.status(201).json({ data: row })
})

router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const existing = (await db.select({ id: paymentMethods.id }).from(paymentMethods)
    .where(and(eq(paymentMethods.id, req.params.id), eq(paymentMethods.userId, req.userId!))).limit(1))[0]
  if (!existing) { res.status(404).json({ error: 'Método de pago no encontrado' }); return }
  const [updated] = await db.update(paymentMethods).set(req.body).where(eq(paymentMethods.id, req.params.id)).returning()
  res.json({ data: updated })
})

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const existing = (await db.select({ id: paymentMethods.id }).from(paymentMethods)
    .where(and(eq(paymentMethods.id, req.params.id), eq(paymentMethods.userId, req.userId!))).limit(1))[0]
  if (!existing) { res.status(404).json({ error: 'Método de pago no encontrado' }); return }
  await db.delete(paymentMethods).where(eq(paymentMethods.id, req.params.id))
  res.json({ ok: true })
})

export default router
