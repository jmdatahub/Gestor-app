import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { paymentMethods } from '../db/schema.js'
import { and, eq, asc, count } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { assertOrgMember } from '../middleware/orgMembership.js'
import { validateUuid } from '../middleware/validateUuid.js'
import { z } from 'zod'

const router = Router()

// Drizzle returns camelCase; the client contract expects snake_case.
function mapOut(row: Record<string, any>) {
  return {
    ...row,
    user_id:         row.userId         ?? row.user_id,
    organization_id: row.organizationId ?? row.organization_id ?? null,
    is_default:      row.isDefault      ?? row.is_default      ?? false,
    sort_order:      row.sortOrder      ?? row.sort_order      ?? 0,
    created_at:      row.createdAt      ?? row.created_at,
  }
}

// Accept both snake_case (client) and camelCase (legacy) in the body.
// Note: the DB schema does not have `type`/`description` columns; we accept
// them for client compatibility but ignore them on persistence.
const PaymentMethodCreateSchema = z.object({
  name:            z.string().min(1).max(100),
  icon:            z.string().max(100).optional().nullable(),
  type:            z.string().max(50).optional().nullable(),
  description:     z.string().max(300).optional().nullable(),
  is_default:      z.boolean().optional(),
  isDefault:       z.boolean().optional(),
  sort_order:      z.number().int().optional(),
  sortOrder:       z.number().int().optional(),
  organization_id: z.string().uuid().optional().nullable(),
  organizationId:  z.string().uuid().optional().nullable(),
  user_id:         z.string().uuid().optional(),
  userId:          z.string().uuid().optional(),
})

const PaymentMethodPatchSchema = PaymentMethodCreateSchema.partial()

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500)
    const offset = Number(req.query.offset) || 0
    const whereClause = eq(paymentMethods.userId, req.userId!)
    const [rows, [{ total }]] = await Promise.all([
      db.select().from(paymentMethods)
        .where(whereClause)
        .orderBy(asc(paymentMethods.name))
        .limit(limit).offset(offset),
      db.select({ total: count() }).from(paymentMethods).where(whereClause),
    ])
    res.json({ data: rows.map(mapOut), total: Number(total), limit, offset })
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
        res.status(400).json({ error: 'Datos inválidos', details: err.issues }); return
      }
      throw err
    }
    const orgId = body.organization_id ?? body.organizationId ?? null
    if (orgId) {
      const ok = await assertOrgMember(req, res, orgId)
      if (!ok) return
    }
    const [row] = await db.insert(paymentMethods).values({
      name:           body.name,
      icon:           body.icon ?? null,
      isDefault:      body.is_default ?? body.isDefault ?? false,
      sortOrder:      body.sort_order ?? body.sortOrder ?? 0,
      organizationId: orgId,
      userId:         req.userId!,
    }).returning()
    res.status(201).json({ data: mapOut(row) })
  } catch (err) {
    console.error('[payment-methods POST /]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.patch('/:id', validateUuid('id'), authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = (await db.select({ id: paymentMethods.id }).from(paymentMethods)
      .where(and(eq(paymentMethods.id, req.params.id as string), eq(paymentMethods.userId, req.userId!))).limit(1))[0]
    if (!existing) { res.status(404).json({ error: 'Método de pago no encontrado' }); return }

    let body: z.infer<typeof PaymentMethodPatchSchema>
    try {
      body = PaymentMethodPatchSchema.parse(req.body)
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues }); return
      }
      throw err
    }
    const patch: Record<string, any> = {}
    if (body.name !== undefined) patch.name = body.name
    if (body.icon !== undefined) patch.icon = body.icon
    const isDefault = body.is_default ?? body.isDefault
    if (isDefault !== undefined) patch.isDefault = isDefault
    const sortOrder = body.sort_order ?? body.sortOrder
    if (sortOrder !== undefined) patch.sortOrder = sortOrder
    const orgId = body.organization_id ?? body.organizationId
    if (orgId !== undefined) {
      if (orgId) {
        const ok = await assertOrgMember(req, res, orgId)
        if (!ok) return
      }
      patch.organizationId = orgId ?? null
    }

    const [updated] = await db.update(paymentMethods).set(patch).where(eq(paymentMethods.id, req.params.id as string)).returning()
    res.json({ data: mapOut(updated) })
  } catch (err) {
    console.error('[payment-methods PATCH /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.delete('/:id', validateUuid('id'), authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = (await db.select({ id: paymentMethods.id }).from(paymentMethods)
      .where(and(eq(paymentMethods.id, req.params.id as string), eq(paymentMethods.userId, req.userId!))).limit(1))[0]
    if (!existing) { res.status(404).json({ error: 'Método de pago no encontrado' }); return }
    await db.delete(paymentMethods).where(eq(paymentMethods.id, req.params.id as string))
    res.json({ ok: true })
  } catch (err) {
    console.error('[payment-methods DELETE /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
