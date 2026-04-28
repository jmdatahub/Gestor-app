import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { categories } from '../db/schema.js'
import { and, eq, isNull, asc } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'

const router = Router()

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const orgId = req.query.org_id as string | undefined
  const filter = orgId
    ? eq(categories.organizationId, orgId)
    : and(eq(categories.userId, req.userId!), isNull(categories.organizationId))
  const rows = await db.select().from(categories).where(filter).orderBy(asc(categories.name))
  res.json({ data: rows })
})

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const row = (await db.select().from(categories)
    .where(and(eq(categories.id, req.params.id), eq(categories.userId, req.userId!))).limit(1))[0]
  if (!row) { res.status(404).json({ error: 'Categoría no encontrada' }); return }
  res.json({ data: row })
})

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const [row] = await db.insert(categories).values({ ...req.body, userId: req.userId! }).returning()
  res.status(201).json({ data: row })
})

router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const existing = (await db.select({ id: categories.id }).from(categories)
    .where(and(eq(categories.id, req.params.id), eq(categories.userId, req.userId!))).limit(1))[0]
  if (!existing) { res.status(404).json({ error: 'Categoría no encontrada' }); return }
  const [updated] = await db.update(categories).set(req.body).where(eq(categories.id, req.params.id)).returning()
  res.json({ data: updated })
})

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const existing = (await db.select({ id: categories.id }).from(categories)
    .where(and(eq(categories.id, req.params.id), eq(categories.userId, req.userId!))).limit(1))[0]
  if (!existing) { res.status(404).json({ error: 'Categoría no encontrada' }); return }
  await db.delete(categories).where(eq(categories.id, req.params.id))
  res.json({ ok: true })
})

export default router
