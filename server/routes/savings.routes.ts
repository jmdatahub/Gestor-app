import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { savingsGoals, savingsContributions } from '../db/schema.js'
import { and, eq, isNull, desc } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { z } from 'zod'

const router = Router()

const SavingsGoalCreateSchema = z.object({
  name:           z.string().min(1).max(150),
  targetAmount:   z.string().or(z.number()).transform(String),
  currentAmount:  z.string().or(z.number()).transform(String).optional(),
  targetDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  description:    z.string().max(500).optional().nullable(),
  color:          z.string().max(30).optional().nullable(),
  icon:           z.string().max(50).optional().nullable(),
  status:         z.enum(['active', 'completed', 'cancelled']).optional().default('active'),
  organizationId: z.string().uuid().optional().nullable(),
}).strict()

const SavingsGoalPatchSchema = SavingsGoalCreateSchema.partial()

const ContributionCreateSchema = z.object({
  amount: z.string().or(z.number()).transform(String),
  date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes:  z.string().max(300).optional().nullable(),
}).strict()

// ─── Savings Goals ────────────────────────────────────────────────────────────
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.query.org_id as string | undefined
    const filter = orgId
      ? eq(savingsGoals.organizationId, orgId)
      : and(eq(savingsGoals.userId, req.userId!), isNull(savingsGoals.organizationId))
    const rows = await db.select().from(savingsGoals).where(filter).orderBy(desc(savingsGoals.createdAt))
    res.json({ data: rows })
  } catch (err) {
    console.error('[savings GET /]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const row = (await db.select().from(savingsGoals)
      .where(and(eq(savingsGoals.id, req.params.id), eq(savingsGoals.userId, req.userId!))).limit(1))[0]
    if (!row) { res.status(404).json({ error: 'Meta no encontrada' }); return }
    res.json({ data: row })
  } catch (err) {
    console.error('[savings GET /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    let body: z.infer<typeof SavingsGoalCreateSchema>
    try {
      body = SavingsGoalCreateSchema.parse(req.body)
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.errors }); return
      }
      throw err
    }
    const [row] = await db.insert(savingsGoals).values({ ...body, userId: req.userId! }).returning()
    res.status(201).json({ data: row })
  } catch (err) {
    console.error('[savings POST /]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = (await db.select({ id: savingsGoals.id }).from(savingsGoals)
      .where(and(eq(savingsGoals.id, req.params.id), eq(savingsGoals.userId, req.userId!))).limit(1))[0]
    if (!existing) { res.status(404).json({ error: 'Meta no encontrada' }); return }

    let body: z.infer<typeof SavingsGoalPatchSchema>
    try {
      body = SavingsGoalPatchSchema.parse(req.body)
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.errors }); return
      }
      throw err
    }
    const [updated] = await db.update(savingsGoals).set(body).where(eq(savingsGoals.id, req.params.id)).returning()
    res.json({ data: updated })
  } catch (err) {
    console.error('[savings PATCH /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = (await db.select({ id: savingsGoals.id }).from(savingsGoals)
      .where(and(eq(savingsGoals.id, req.params.id), eq(savingsGoals.userId, req.userId!))).limit(1))[0]
    if (!existing) { res.status(404).json({ error: 'Meta no encontrada' }); return }
    await db.delete(savingsGoals).where(eq(savingsGoals.id, req.params.id))
    res.json({ ok: true })
  } catch (err) {
    console.error('[savings DELETE /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// ─── Savings Contributions ────────────────────────────────────────────────────
router.get('/:goalId/contributions', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Verify the goal belongs to the requesting user before exposing contributions
    const goal = (await db.select({ id: savingsGoals.id }).from(savingsGoals)
      .where(and(eq(savingsGoals.id, req.params.goalId), eq(savingsGoals.userId, req.userId!))).limit(1))[0]
    if (!goal) { res.status(404).json({ error: 'Meta no encontrada' }); return }

    const rows = await db.select().from(savingsContributions)
      .where(eq(savingsContributions.goalId, req.params.goalId))
      .orderBy(desc(savingsContributions.date))
    res.json({ data: rows })
  } catch (err) {
    console.error('[savings GET /:goalId/contributions]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.post('/:goalId/contributions', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Verify the goal belongs to the requesting user before adding contributions
    const goal = (await db.select({ id: savingsGoals.id }).from(savingsGoals)
      .where(and(eq(savingsGoals.id, req.params.goalId), eq(savingsGoals.userId, req.userId!))).limit(1))[0]
    if (!goal) { res.status(404).json({ error: 'Meta no encontrada' }); return }

    let body: z.infer<typeof ContributionCreateSchema>
    try {
      body = ContributionCreateSchema.parse(req.body)
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.errors }); return
      }
      throw err
    }
    const [row] = await db.insert(savingsContributions)
      .values({ ...body, goalId: req.params.goalId, userId: req.userId! }).returning()
    res.status(201).json({ data: row })
  } catch (err) {
    console.error('[savings POST /:goalId/contributions]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
