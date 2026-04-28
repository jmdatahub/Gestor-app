import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { apiTokens } from '../db/schema.js'
import { and, eq, desc } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import crypto from 'crypto'

const router = Router()

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const rows = await db.select().from(apiTokens)
    .where(eq(apiTokens.userId, req.userId!))
    .orderBy(desc(apiTokens.createdAt))
  res.json({ data: rows })
})

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const token = crypto.randomBytes(32).toString('hex')
  const [row] = await db.insert(apiTokens)
    .values({ ...req.body, userId: req.userId!, token }).returning()
  res.status(201).json({ data: row })
})

router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const existing = (await db.select({ id: apiTokens.id }).from(apiTokens)
    .where(and(eq(apiTokens.id, req.params.id), eq(apiTokens.userId, req.userId!))).limit(1))[0]
  if (!existing) { res.status(404).json({ error: 'Token no encontrado' }); return }
  const [updated] = await db.update(apiTokens).set({ scopes: req.body.scopes }).where(eq(apiTokens.id, req.params.id)).returning()
  res.json({ data: updated })
})

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const existing = (await db.select({ id: apiTokens.id }).from(apiTokens)
    .where(and(eq(apiTokens.id, req.params.id), eq(apiTokens.userId, req.userId!))).limit(1))[0]
  if (!existing) { res.status(404).json({ error: 'Token no encontrado' }); return }
  await db.delete(apiTokens).where(eq(apiTokens.id, req.params.id))
  res.json({ ok: true })
})

export default router
