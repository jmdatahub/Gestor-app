import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { movements } from '../db/schema.js'
import { eq, and, desc, gte, lte, isNull, sql } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'

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
  if (body.description != null) out.description = body.description
  if (body.status      != null) out.status      = body.status
  const acct = body.account_id ?? body.accountId; if (acct != null) out.accountId = acct
  const cat  = body.category_id ?? body.categoryId; if (cat  !== undefined) out.categoryId = cat ?? null
  const org  = body.organization_id ?? body.organizationId; if (org !== undefined) out.organizationId = org ?? null
  const biz  = body.is_business ?? body.isBusiness; if (biz  != null) out.isBusiness = biz
  return out
}

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

    res.json({ data: rows.map(r => mapOut(r as any)), limit, offset })
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

// POST /api/v1/movements
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const mapped = mapIn(req.body)
    if (!mapped.accountId) { res.status(400).json({ error: 'account_id es requerido' }); return }
    if (!mapped.date || !mapped.kind || !mapped.amount) { res.status(400).json({ error: 'date, kind y amount son requeridos' }); return }
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
    const existing = (await db.select({ id: movements.id }).from(movements)
      .where(and(eq(movements.id, req.params.id as string), eq(movements.userId, req.userId!)))
      .limit(1))[0]
    if (!existing) { res.status(404).json({ error: 'Movimiento no encontrado' }); return }
    const [updated] = await db.update(movements).set(mapIn(req.body) as any).where(eq(movements.id, req.params.id as string)).returning()
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
