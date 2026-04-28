import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { providers } from '../db/schema.js'
import { and, eq, ilike, asc } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'

const router = Router()

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const q = req.query.q as string | undefined
  const filter = q
    ? and(eq(providers.userId, req.userId!), ilike(providers.name, `%${q}%`))
    : eq(providers.userId, req.userId!)
  const rows = await db.select().from(providers).where(filter).orderBy(asc(providers.name)).limit(50)
  res.json({ data: rows })
})

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const [row] = await db.insert(providers).values({ ...req.body, userId: req.userId! }).returning()
  res.status(201).json({ data: row })
})

router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const existing = (await db.select({ id: providers.id }).from(providers)
    .where(and(eq(providers.id, req.params.id), eq(providers.userId, req.userId!))).limit(1))[0]
  if (!existing) { res.status(404).json({ error: 'Proveedor no encontrado' }); return }
  const [updated] = await db.update(providers).set(req.body).where(eq(providers.id, req.params.id)).returning()
  res.json({ data: updated })
})

export default router
