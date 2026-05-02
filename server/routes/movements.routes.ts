import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { movements, accounts } from '../db/schema.js'
import { eq, and, desc, gte, lte, isNull, sql, count } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { z } from 'zod'

// Max date allowed: today + 10 years
const MAX_DATE_YEARS_AHEAD = 10

const router = Router()

function mapOut(row: Record<string, any>) {
  return {
    ...row,
    user_id:         row.userId         ?? row.user_id,
    organization_id: row.organizationId ?? row.organization_id ?? null,
    account_id:      row.accountId      ?? row.account_id,
    category_id:     row.categoryId     ?? row.category_id     ?? null,
    is_business:     row.isBusiness     ?? row.is_business     ?? false,
    tax_rate:        row.taxRate        ?? row.tax_rate         ?? null,
    created_at:      row.createdAt      ?? row.created_at,
    deleted_at:      row.deletedAt      ?? row.deleted_at       ?? null,
  }
}

function mapIn(body: Record<string, any>) {
  const out: Record<string, any> = {}
  if (body.date        != null) out.date        = body.date
  if (body.kind        != null) out.kind        = body.kind
  if (body.amount      != null) out.amount      = String(body.amount)
  if (body.description != null) out.description = typeof body.description === 'string' ? body.description.slice(0, 500) : body.description
  if (body.status      != null) out.status      = body.status
  const acct = body.account_id ?? body.accountId; if (acct != null) out.accountId = acct
  const cat  = body.category_id ?? body.categoryId; if (cat  !== undefined) out.categoryId = cat ?? null
  const org  = body.organization_id ?? body.organizationId; if (org !== undefined) out.organizationId = org ?? null
  const biz  = body.is_business ?? body.isBusiness; if (biz  != null) out.isBusiness = biz
  return out
}

const TransferSchema = z.object({
  from_account_id: z.string().uuid(),
  to_account_id:   z.string().uuid(),
  amount:          z.number().positive(),
  date:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(
    (d) => {
      const max = new Date()
      max.setFullYear(max.getFullYear() + MAX_DATE_YEARS_AHEAD)
      return new Date(d) <= max
    },
    { message: `La fecha no puede ser más de ${MAX_DATE_YEARS_AHEAD} años en el futuro` }
  ),
  description:     z.string().max(500).optional().nullable(),
  org_id:          z.string().uuid().optional().nullable(),
}).strict()

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

    const [rows, [{ total }]] = await Promise.all([
      db.select().from(movements)
        .where(and(...conditions))
        .orderBy(desc(movements.date), desc(movements.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(movements).where(and(...conditions)),
    ])

    res.json({ data: rows.map(r => mapOut(r as any)), total: Number(total), limit, offset })
  } catch (err) {
    console.error('[movements GET /]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// GET /api/v1/movements/:id
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const row = (await db.select().from(movements)
      .where(and(eq(movements.id, req.params.id as string), eq(movements.userId, req.userId!)))
      .limit(1))[0]
    if (!row) { res.status(404).json({ error: 'Movimiento no encontrado' }); return }
    res.json({ data: mapOut(row as any) })
  } catch (err) {
    console.error('[movements GET /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// POST /api/v1/movements/transfer — creates a transfer_out + transfer_in pair
router.post('/transfer', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    let body: z.infer<typeof TransferSchema>
    try {
      body = TransferSchema.parse(req.body)
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: (err as z.ZodError).issues }); return
      }
      throw err
    }

    const { from_account_id, to_account_id, amount, date, description, org_id } = body

    if (from_account_id === to_account_id) {
      res.status(400).json({ error: 'La cuenta de origen y destino no pueden ser la misma' }); return
    }

    // Verify both accounts belong to the requesting user
    const [fromAccount, toAccount] = await Promise.all([
      db.select({ id: accounts.id }).from(accounts)
        .where(and(eq(accounts.id, from_account_id), eq(accounts.userId, req.userId!)))
        .limit(1),
      db.select({ id: accounts.id }).from(accounts)
        .where(and(eq(accounts.id, to_account_id), eq(accounts.userId, req.userId!)))
        .limit(1),
    ])

    if (!fromAccount[0]) { res.status(404).json({ error: 'Cuenta de origen no encontrada' }); return }
    if (!toAccount[0]) { res.status(404).json({ error: 'Cuenta de destino no encontrada' }); return }

    const orgId = org_id ?? null

    const [outRow, inRow] = await db.transaction(async (tx) => {
      return Promise.all([
        tx.insert(movements).values({
          userId:         req.userId!,
          accountId:      from_account_id,
          kind:           'transfer_out' as any,
          amount:         String(amount),
          date,
          description:    description ?? null,
          status:         'confirmed',
          organizationId: orgId,
        } as any).returning(),
        tx.insert(movements).values({
          userId:         req.userId!,
          accountId:      to_account_id,
          kind:           'transfer_in' as any,
          amount:         String(amount),
          date,
          description:    description ?? null,
          status:         'confirmed',
          organizationId: orgId,
        } as any).returning(),
      ])
    })

    res.status(201).json({ data: { out: mapOut(outRow[0] as any), in: mapOut(inRow[0] as any) } })
  } catch (err) {
    console.error('[movements POST /transfer]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// POST /api/v1/movements
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const mapped = mapIn(req.body)
    if (!mapped.accountId) { res.status(400).json({ error: 'account_id es requerido' }); return }
    if (!mapped.date || !mapped.kind || !mapped.amount) { res.status(400).json({ error: 'date, kind y amount son requeridos' }); return }

    // Validate amount is a valid positive number
    const amountNum = parseFloat(mapped.amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      res.status(400).json({ error: 'amount debe ser un número mayor que 0' }); return
    }
    // Income movements must have a positive amount (already ensured by > 0 above)
    // but reject negative values explicitly for clarity
    if (mapped.kind === 'income' && amountNum < 0) {
      res.status(400).json({ error: 'Los movimientos de ingreso deben tener un importe positivo' }); return
    }

    // Validate date is not more than 10 years in the future
    const movDate = new Date(mapped.date)
    const maxDate = new Date()
    maxDate.setFullYear(maxDate.getFullYear() + MAX_DATE_YEARS_AHEAD)
    if (movDate > maxDate) {
      res.status(400).json({ error: `La fecha no puede ser más de ${MAX_DATE_YEARS_AHEAD} años en el futuro` }); return
    }

    const [row] = await db.insert(movements).values({ ...mapped, userId: req.userId! } as any).returning()
    res.status(201).json({ data: mapOut(row as any) })
  } catch (err) {
    console.error('[movements POST /]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// PATCH /api/v1/movements/:id
router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = (await db.select({ id: movements.id, kind: movements.kind }).from(movements)
      .where(and(eq(movements.id, req.params.id as string), eq(movements.userId, req.userId!), isNull(movements.deletedAt)))
      .limit(1))[0]
    if (!existing) { res.status(404).json({ error: 'Movimiento no encontrado' }); return }

    const patch = mapIn(req.body)

    // Validate amount if being updated
    if (patch.amount !== undefined) {
      const amountNum = parseFloat(patch.amount)
      if (isNaN(amountNum) || amountNum <= 0) {
        res.status(400).json({ error: 'amount debe ser un número mayor que 0' }); return
      }
    }

    // Validate date if being updated
    if (patch.date !== undefined) {
      const movDate = new Date(patch.date)
      const maxDate = new Date()
      maxDate.setFullYear(maxDate.getFullYear() + MAX_DATE_YEARS_AHEAD)
      if (movDate > maxDate) {
        res.status(400).json({ error: `La fecha no puede ser más de ${MAX_DATE_YEARS_AHEAD} años en el futuro` }); return
      }
    }

    const [updated] = await db.update(movements).set(patch as any).where(eq(movements.id, req.params.id as string)).returning()
    res.json({ data: mapOut(updated as any) })
  } catch (err) {
    console.error('[movements PATCH /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// DELETE /api/v1/movements/:id (soft delete)
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = (await db.select({ id: movements.id }).from(movements)
      .where(and(eq(movements.id, req.params.id as string), eq(movements.userId, req.userId!)))
      .limit(1))[0]
    if (!existing) { res.status(404).json({ error: 'Movimiento no encontrado' }); return }

    await db.update(movements).set({ deletedAt: new Date().toISOString() }).where(eq(movements.id, req.params.id as string))
    res.json({ ok: true })
  } catch (err) {
    console.error('[movements DELETE /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
