import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { debts, debtMovements } from '../db/schema.js'
import { and, eq, isNull, desc } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { z } from 'zod'

const router = Router()

const DebtCreateSchema = z.object({
  direction:        z.enum(['i_owe', 'they_owe_me']),
  counterpartyName: z.string().min(1).max(150),
  totalAmount:      z.string().or(z.number()).transform(String),
  remainingAmount:  z.string().or(z.number()).transform(String).optional(),
  dueDate:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  description:      z.string().max(500).optional().nullable(),
  isClosed:         z.boolean().optional().default(false),
  organizationId:   z.string().uuid().optional().nullable(),
}).strict()

const DebtPatchSchema = DebtCreateSchema.partial()

const DebtMovementCreateSchema = z.object({
  amount:      z.string().or(z.number()).transform(String),
  date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().max(500).optional().nullable(),
}).strict()

// ─── Debts ────────────────────────────────────────────────────────────────────
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.query.org_id as string | undefined
    const filter = orgId
      ? eq(debts.organizationId, orgId)
      : and(eq(debts.userId, req.userId!), isNull(debts.organizationId))
    const rows = await db.select().from(debts).where(and(filter, isNull(debts.deletedAt)))
      .orderBy(desc(debts.createdAt))
    res.json({ data: rows })
  } catch (err) {
    console.error('[debts GET /]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const row = (await db.select().from(debts)
      .where(and(eq(debts.id, req.params.id), eq(debts.userId, req.userId!))).limit(1))[0]
    if (!row) { res.status(404).json({ error: 'Deuda no encontrada' }); return }
    res.json({ data: row })
  } catch (err) {
    console.error('[debts GET /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    let body: z.infer<typeof DebtCreateSchema>
    try {
      body = DebtCreateSchema.parse(req.body)
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.errors }); return
      }
      throw err
    }
    const [row] = await db.insert(debts).values({ ...body, userId: req.userId! }).returning()
    res.status(201).json({ data: row })
  } catch (err) {
    console.error('[debts POST /]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = (await db.select({ id: debts.id }).from(debts)
      .where(and(eq(debts.id, req.params.id), eq(debts.userId, req.userId!))).limit(1))[0]
    if (!existing) { res.status(404).json({ error: 'Deuda no encontrada' }); return }

    let body: z.infer<typeof DebtPatchSchema>
    try {
      body = DebtPatchSchema.parse(req.body)
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.errors }); return
      }
      throw err
    }
    const [updated] = await db.update(debts).set(body).where(eq(debts.id, req.params.id)).returning()
    res.json({ data: updated })
  } catch (err) {
    console.error('[debts PATCH /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = (await db.select({ id: debts.id }).from(debts)
      .where(and(eq(debts.id, req.params.id), eq(debts.userId, req.userId!))).limit(1))[0]
    if (!existing) { res.status(404).json({ error: 'Deuda no encontrada' }); return }
    await db.update(debts).set({ deletedAt: new Date().toISOString() }).where(eq(debts.id, req.params.id))
    res.json({ ok: true })
  } catch (err) {
    console.error('[debts DELETE /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// ─── Debt movements ───────────────────────────────────────────────────────────
router.get('/:debtId/movements', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Verify the debt belongs to the requesting user before exposing its movements
    const debt = (await db.select({ id: debts.id }).from(debts)
      .where(and(eq(debts.id, req.params.debtId), eq(debts.userId, req.userId!))).limit(1))[0]
    if (!debt) { res.status(404).json({ error: 'Deuda no encontrada' }); return }

    const rows = await db.select().from(debtMovements)
      .where(eq(debtMovements.debtId, req.params.debtId))
      .orderBy(desc(debtMovements.date))
    res.json({ data: rows })
  } catch (err) {
    console.error('[debts GET /:debtId/movements]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.post('/:debtId/movements', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Verify the debt belongs to the requesting user before adding movements
    const debt = (await db.select({ id: debts.id }).from(debts)
      .where(and(eq(debts.id, req.params.debtId), eq(debts.userId, req.userId!))).limit(1))[0]
    if (!debt) { res.status(404).json({ error: 'Deuda no encontrada' }); return }

    let body: z.infer<typeof DebtMovementCreateSchema>
    try {
      body = DebtMovementCreateSchema.parse(req.body)
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.errors }); return
      }
      throw err
    }
    const [row] = await db.insert(debtMovements)
      .values({ ...body, debtId: req.params.debtId }).returning()
    res.status(201).json({ data: row })
  } catch (err) {
    console.error('[debts POST /:debtId/movements]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
