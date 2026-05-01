import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { paymentMethods } from '../db/schema.js'
import { and, eq, asc } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { z } from 'zod'

const router = Router()

const PaymentMethodCreateSchema = z.object({
  name:        z.string().min(1).max(100),
  type:        z.string().max(50).optional().nullable(),
  description: z.string().max(300).optional().nullable(),
  isDefault:   z.boolean().optional().default(false),
}).strict()

const PaymentMethodPatchSchema = PaymentMethodCreateSchema.partial()

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const rows = await db.select().from(paymentMethods)
      .where(eq(paymentMethods.userId, req.userId!))
      .orderBy(asc(paymentMethods.name))
    res.json({ data: rows })
  } catch (err) {
    console.error('[payment-methods GET /]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    let body: z.infer<typeof PaymentMethodCreateSchema>
    try {
      body = PaymentMethodCreateSchema.parse(req.body)
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.errors }); return
      }
      throw err
    }
    const [row] = await db.insert(paymentMethods).values({ ...body, userId: req.userId! }).returning()
    res.status(201).json({ data: row })
  } catch (err) {
    console.error('[payment-methods POST /]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = (await db.select({ id: paymentMethods.id }).from(paymentMethods)
      .where(and(eq(paymentMethods.id, req.params.id), eq(paymentMethods.userId, req.userId!))).limit(1))[0]
    if (!existing) { res.status(404).json({ error: 'Método de pago no encontrado' }); return }

    let body: z.infer<typeof PaymentMethodPatchSchema>
    try {
      body = PaymentMethodPatchSchema.parse(req.body)
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.errors }); return
      }
      throw err
    }
    const [updated] = await db.update(paymentMethods).set(body).where(eq(paymentMethods.id, req.params.id)).returning()
    res.json({ data: updated })
  } catch (err) {
    console.error('[payment-methods PATCH /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = (await db.select({ id: paymentMethods.id }).from(paymentMethods)
      .where(and(eq(paymentMethods.id, req.params.id), eq(paymentMethods.userId, req.userId!))).limit(1))[0]
    if (!existing) { res.status(404).json({ error: 'Método de pago no encontrado' }); return }
    await db.delete(paymentMethods).where(eq(paymentMethods.id, req.params.id))
    res.json({ ok: true })
  } catch (err) {
    console.error('[payment-methods DELETE /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
