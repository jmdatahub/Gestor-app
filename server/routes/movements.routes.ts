import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { movements } from '../db/schema.js'
import { eq, and, desc, sql } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { z } from 'zod'

const router = Router()

const MovementSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kind: z.enum(['income', 'expense', 'transfer']),
  amount: z.string().or(z.number()).transform(String),
  description: z.string().optional(),
  categoryId: z.string().uuid().optional().nullable(),
  accountId: z.string().uuid(),
  status: z.enum(['confirmed', 'pending']).default('confirmed'),
  isBusiness: z.boolean().default(false),
  organizationId: z.string().uuid().optional().nullable(),
})

// GET /api/v1/movements
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!
  const limit = Math.min(Number(req.query.limit) || 50, 200)
  const offset = Number(req.query.offset) || 0

  const rows = await db.select().from(movements)
    .where(and(eq(movements.userId, userId), sql`${movements.deletedAt} IS NULL`))
    .orderBy(desc(movements.date), desc(movements.createdAt))
    .limit(limit)
    .offset(offset)

  res.json({ data: rows, limit, offset })
})

// GET /api/v1/movements/:id
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const row = (await db.select().from(movements)
    .where(and(eq(movements.id, req.params.id), eq(movements.userId, req.userId!)))
    .limit(1))[0]
  if (!row) { res.status(404).json({ error: 'Movimiento no encontrado' }); return }
  res.json({ data: row })
})

// POST /api/v1/movements
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const body = MovementSchema.parse(req.body)
  const [row] = await db.insert(movements).values({
    ...body,
    userId: req.userId!,
  }).returning()
  res.status(201).json({ data: row })
})

// PATCH /api/v1/movements/:id
router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const existing = (await db.select({ id: movements.id }).from(movements)
    .where(and(eq(movements.id, req.params.id), eq(movements.userId, req.userId!)))
    .limit(1))[0]
  if (!existing) { res.status(404).json({ error: 'Movimiento no encontrado' }); return }

  const body = MovementSchema.partial().parse(req.body)
  const [updated] = await db.update(movements).set(body).where(eq(movements.id, req.params.id)).returning()
  res.json({ data: updated })
})

// DELETE /api/v1/movements/:id (soft delete)
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const existing = (await db.select({ id: movements.id }).from(movements)
    .where(and(eq(movements.id, req.params.id), eq(movements.userId, req.userId!)))
    .limit(1))[0]
  if (!existing) { res.status(404).json({ error: 'Movimiento no encontrado' }); return }

  await db.update(movements).set({ deletedAt: new Date().toISOString() }).where(eq(movements.id, req.params.id))
  res.json({ ok: true })
})

export default router
