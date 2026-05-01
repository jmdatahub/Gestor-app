import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { movements } from '../db/schema.js'
import { eq, and, desc, gte, lte, isNull, sql } from 'drizzle-orm'
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
// Query params: limit, offset, startDate, endDate, kind, status, orgId, personal
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const limit = Math.min(Number(req.query.limit) || 50, 500)
    const offset = Number(req.query.offset) || 0

    const conditions = [
      eq(movements.userId, userId),
      sql`${movements.deletedAt} IS NULL`,
    ]

    if (req.query.startDate) conditions.push(gte(movements.date, String(req.query.startDate)))
    if (req.query.endDate) conditions.push(lte(movements.date, String(req.query.endDate)))
    if (req.query.kind) conditions.push(eq(movements.kind, String(req.query.kind) as 'income' | 'expense' | 'transfer'))
    if (req.query.status) conditions.push(eq(movements.status, String(req.query.status) as 'confirmed' | 'pending'))
    if (req.query.orgId) conditions.push(eq(movements.organizationId, String(req.query.orgId)))
    if (req.query.personal === 'true') conditions.push(isNull(movements.organizationId))

    const rows = await db.select().from(movements)
      .where(and(...conditions))
      .orderBy(desc(movements.date), desc(movements.createdAt))
      .limit(limit)
      .offset(offset)

    res.json({ data: rows, limit, offset })
  } catch (err) {
    console.error('[movements GET /]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// GET /api/v1/movements/:id
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const row = (await db.select().from(movements)
      .where(and(eq(movements.id, req.params.id), eq(movements.userId, req.userId!)))
      .limit(1))[0]
    if (!row) { res.status(404).json({ error: 'Movimiento no encontrado' }); return }
    res.json({ data: row })
  } catch (err) {
    console.error('[movements GET /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// POST /api/v1/movements
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const body = MovementSchema.parse(req.body)
    const [row] = await db.insert(movements).values({
      ...body,
      userId: req.userId!,
    }).returning()
    res.status(201).json({ data: row })
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Datos inválidos', details: err.errors }); return
    }
    console.error('[movements POST /]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// PATCH /api/v1/movements/:id
router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = (await db.select({ id: movements.id }).from(movements)
      .where(and(eq(movements.id, req.params.id), eq(movements.userId, req.userId!)))
      .limit(1))[0]
    if (!existing) { res.status(404).json({ error: 'Movimiento no encontrado' }); return }

    const body = MovementSchema.partial().parse(req.body)
    const [updated] = await db.update(movements).set(body).where(eq(movements.id, req.params.id)).returning()
    res.json({ data: updated })
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Datos inválidos', details: err.errors }); return
    }
    console.error('[movements PATCH /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// DELETE /api/v1/movements/:id (soft delete)
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = (await db.select({ id: movements.id }).from(movements)
      .where(and(eq(movements.id, req.params.id), eq(movements.userId, req.userId!)))
      .limit(1))[0]
    if (!existing) { res.status(404).json({ error: 'Movimiento no encontrado' }); return }

    await db.update(movements).set({ deletedAt: new Date().toISOString() }).where(eq(movements.id, req.params.id))
    res.json({ ok: true })
  } catch (err) {
    console.error('[movements DELETE /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
