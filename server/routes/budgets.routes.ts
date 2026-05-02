import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { budgets } from '../db/schema.js'
import { and, eq, count } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { z } from 'zod'

const router = Router()

// ── Field-name bridge (Drizzle camelCase → client snake_case) ─────────────────
function mapOut(row: Record<string, any>) {
  const monthlyLimit = row.monthlyLimit ?? row.monthly_limit ?? row.amount ?? 0
  return {
    ...row,
    user_id:       row.userId       ?? row.user_id,
    category_id:   row.categoryId   ?? row.category_id   ?? null,
    category_name: row.categoryName ?? row.category_name ?? '',
    monthly_limit: monthlyLimit != null ? parseFloat(String(monthlyLimit)) : 0,
    amount:        monthlyLimit != null ? parseFloat(String(monthlyLimit)) : 0,
    created_at:    row.createdAt    ?? row.created_at,
    updated_at:    row.updatedAt    ?? row.updated_at    ?? null,
  }
}

// Schema matches the actual DB table columns: categoryName, monthlyLimit, month
const BudgetCreateSchema = z.object({
  categoryName:   z.string().min(1).max(120),
  monthlyLimit:   z.number().nonnegative(),
  month:          z.string().regex(/^\d{4}-\d{2}$/, 'month must be YYYY-MM'),
  categoryId:     z.string().uuid().optional().nullable(),
  // Legacy / compatibility fields – accepted but ignored to avoid 400 errors
  amount:         z.number().nonnegative().optional(),
  category_name:  z.string().optional(),
  monthly_limit:  z.number().nonnegative().optional(),
  user_id:        z.string().optional(),
  organization_id: z.string().uuid().optional().nullable(),
}).passthrough()

// Derive values from either camelCase or snake_case aliases before saving
function normalizeBudgetBody(raw: z.infer<typeof BudgetCreateSchema>) {
  return {
    categoryName:  raw.categoryName || raw.category_name || '',
    monthlyLimit:  String(raw.monthlyLimit ?? raw.monthly_limit ?? raw.amount ?? 0),
    month:         raw.month,
    categoryId:    raw.categoryId ?? null,
  }
}

const BudgetPatchSchema = BudgetCreateSchema.partial()

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500)
    const offset = Number(req.query.offset) || 0
    // Filter by month if provided (format YYYY-MM)
    const monthFilter = typeof req.query.month === 'string' && /^\d{4}-\d{2}$/.test(req.query.month)
      ? req.query.month
      : null
    const whereClause = monthFilter
      ? and(eq(budgets.userId, req.userId!), eq(budgets.month, monthFilter))
      : eq(budgets.userId, req.userId!)
    const [rows, [{ total }]] = await Promise.all([
      db.select().from(budgets).where(whereClause).limit(limit).offset(offset),
      db.select({ total: count() }).from(budgets).where(whereClause),
    ])
    res.json({ data: rows.map(mapOut), total: Number(total), limit, offset })
  } catch (err) {
    console.error('[budgets GET /]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// TODO: unused, consider removing
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const row = (await db.select().from(budgets)
      .where(and(eq(budgets.id, req.params.id as string), eq(budgets.userId, req.userId!))).limit(1))[0]
    if (!row) { res.status(404).json({ error: 'Presupuesto no encontrado' }); return }
    res.json({ data: mapOut(row) })
  } catch (err) {
    console.error('[budgets GET /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    let raw: z.infer<typeof BudgetCreateSchema>
    try {
      raw = BudgetCreateSchema.parse(req.body)
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues }); return
      }
      throw err
    }
    const body = normalizeBudgetBody(raw)
    if (!body.categoryName) {
      res.status(400).json({ error: 'categoryName es obligatorio' }); return
    }
    const [row] = await db.insert(budgets).values({ ...body, userId: req.userId! }).returning()
    res.status(201).json({ data: mapOut(row) })
  } catch (err) {
    console.error('[budgets POST /]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = (await db.select({ id: budgets.id }).from(budgets)
      .where(and(eq(budgets.id, req.params.id as string), eq(budgets.userId, req.userId!))).limit(1))[0]
    if (!existing) { res.status(404).json({ error: 'Presupuesto no encontrado' }); return }

    let raw: z.infer<typeof BudgetPatchSchema>
    try {
      raw = BudgetPatchSchema.parse(req.body)
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues }); return
      }
      throw err
    }
    // Only pick recognized DB fields to avoid stray keys
    const patch: Record<string, unknown> = {}
    const normalized = normalizeBudgetBody(raw as z.infer<typeof BudgetCreateSchema>)
    if (raw.categoryName !== undefined || (raw as any).category_name !== undefined) patch.categoryName = normalized.categoryName
    if (raw.monthlyLimit !== undefined || (raw as any).monthly_limit !== undefined || (raw as any).amount !== undefined) patch.monthlyLimit = normalized.monthlyLimit
    if (raw.month !== undefined) patch.month = normalized.month
    if (raw.categoryId !== undefined) patch.categoryId = normalized.categoryId
    const [updated] = await db.update(budgets).set(patch).where(eq(budgets.id, req.params.id as string)).returning()
    res.json({ data: mapOut(updated) })
  } catch (err) {
    console.error('[budgets PATCH /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = (await db.select({ id: budgets.id }).from(budgets)
      .where(and(eq(budgets.id, req.params.id as string), eq(budgets.userId, req.userId!))).limit(1))[0]
    if (!existing) { res.status(404).json({ error: 'Presupuesto no encontrado' }); return }
    await db.delete(budgets).where(eq(budgets.id, req.params.id as string))
    res.json({ ok: true })
  } catch (err) {
    console.error('[budgets DELETE /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
