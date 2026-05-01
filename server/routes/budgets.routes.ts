import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { budgets } from '../db/schema.js'
import { and, eq } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { z } from 'zod'

const router = Router()

const BudgetCreateSchema = z.object({
  name:           z.string().min(1).max(120),
  amount:         z.number().positive(),
  period:         z.enum(['monthly', 'weekly', 'yearly']).optional().default('monthly'),
  categoryId:     z.string().uuid().optional().nullable(),
  organizationId: z.string().uuid().optional().nullable(),
  startDate:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  endDate:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  isActive:       z.boolean().optional().default(true),
}).strict()

const BudgetPatchSchema = BudgetCreateSchema.partial()

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500)
    const offset = Number(req.query.offset) || 0
    const rows = await db.select().from(budgets)
      .where(eq(budgets.userId, req.userId!))
      .limit(limit).offset(offset)
    res.json({ data: rows, limit, offset })
  } catch (err) {
    console.error('[budgets GET /]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const row = (await db.select().from(budgets)
      .where(and(eq(budgets.id, req.params.id), eq(budgets.userId, req.userId!))).limit(1))[0]
    if (!row) { res.status(404).json({ error: 'Presupuesto no encontrado' }); return }
    res.json({ data: row })
  } catch (err) {
    console.error('[budgets GET /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    let body: z.infer<typeof BudgetCreateSchema>
    try {
      body = BudgetCreateSchema.parse(req.body)
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.errors }); return
      }
      throw err
    }
    const [row] = await db.insert(budgets).values({ ...body, userId: req.userId! }).returning()
    res.status(201).json({ data: row })
  } catch (err) {
    console.error('[budgets POST /]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = (await db.select({ id: budgets.id }).from(budgets)
      .where(and(eq(budgets.id, req.params.id), eq(budgets.userId, req.userId!))).limit(1))[0]
    if (!existing) { res.status(404).json({ error: 'Presupuesto no encontrado' }); return }

    let body: z.infer<typeof BudgetPatchSchema>
    try {
      body = BudgetPatchSchema.parse(req.body)
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.errors }); return
      }
      throw err
    }
    const [updated] = await db.update(budgets).set(body).where(eq(budgets.id, req.params.id)).returning()
    res.json({ data: updated })
  } catch (err) {
    console.error('[budgets PATCH /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = (await db.select({ id: budgets.id }).from(budgets)
      .where(and(eq(budgets.id, req.params.id), eq(budgets.userId, req.userId!))).limit(1))[0]
    if (!existing) { res.status(404).json({ error: 'Presupuesto no encontrado' }); return }
    await db.delete(budgets).where(eq(budgets.id, req.params.id))
    res.json({ ok: true })
  } catch (err) {
    console.error('[budgets DELETE /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
