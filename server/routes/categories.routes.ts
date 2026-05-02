import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { categories, movements } from '../db/schema.js'
import { and, eq, isNull, asc, count, ne, ilike } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { assertOrgMember } from '../middleware/orgMembership.js'
import { z } from 'zod'

const router = Router()

// ── Field-name bridge (Drizzle camelCase → client snake_case) ─────────────────
function mapOut(row: Record<string, any>) {
  return {
    ...row,
    user_id:          row.userId         ?? row.user_id,
    organization_id:  row.organizationId ?? row.organization_id ?? null,
    is_hidden:        row.isHidden       ?? row.is_hidden        ?? false,
    usage_count:      row.usageCount     ?? row.usage_count      ?? 0,
    last_used_at:     row.lastUsedAt     ?? row.last_used_at     ?? null,
    created_at:       row.createdAt      ?? row.created_at,
    deleted_at:       row.deletedAt      ?? row.deleted_at       ?? null,
    created_by_email: row.createdByEmail ?? row.created_by_email ?? null,
    updated_by_email: row.updatedByEmail ?? row.updated_by_email ?? null,
  }
}

const CategoryCreateSchema = z.object({
  name:           z.string().min(1).max(100),
  kind:           z.enum(['income', 'expense']),
  color:          z.string().max(30).optional().nullable(),
  icon:           z.string().max(50).optional().nullable(),
  description:    z.string().max(300).optional().nullable(),
  organizationId: z.string().uuid().optional().nullable(),
}).strict()

const CategoryPatchSchema = CategoryCreateSchema.partial()

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.query.org_id as string | undefined
    if (orgId) {
      const ok = await assertOrgMember(req, res, orgId)
      if (!ok) return
    }
    const filter = orgId
      ? eq(categories.organizationId, orgId)
      : and(eq(categories.userId, req.userId!), isNull(categories.organizationId))
    const limit = Math.min(Number(req.query.limit) || 200, 1000)
    const offset = Number(req.query.offset) || 0
    const [rows, [{ total }]] = await Promise.all([
      db.select().from(categories).where(filter)
        .orderBy(asc(categories.name))
        .limit(limit).offset(offset),
      db.select({ total: count() }).from(categories).where(filter),
    ])
    res.json({ data: rows.map(mapOut), total: Number(total), limit, offset })
  } catch (err) {
    console.error('[categories GET /]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// Check how many movements reference a category (for safe-delete warning)
router.get('/:id/usage', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = (await db.select({ id: categories.id }).from(categories)
      .where(and(eq(categories.id, req.params.id as string), eq(categories.userId, req.userId!))).limit(1))[0]
    if (!existing) { res.status(404).json({ error: 'Categoría no encontrada' }); return }

    const [result] = await db.select({ count: count() }).from(movements)
      .where(and(eq(movements.categoryId, req.params.id as string), isNull(movements.deletedAt)))
    res.json({ count: Number(result?.count ?? 0) })
  } catch (err) {
    console.error('[categories GET /:id/usage]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const row = (await db.select().from(categories)
      .where(and(eq(categories.id, req.params.id as string), eq(categories.userId, req.userId!))).limit(1))[0]
    if (!row) { res.status(404).json({ error: 'Categoría no encontrada' }); return }
    res.json({ data: mapOut(row) })
  } catch (err) {
    console.error('[categories GET /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    let body: z.infer<typeof CategoryCreateSchema>
    try {
      body = CategoryCreateSchema.parse(req.body)
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues }); return
      }
      throw err
    }
    // Org membership check when organizationId is provided
    if (body.organizationId) {
      const ok = await assertOrgMember(req, res, body.organizationId)
      if (!ok) return
    }
    // Duplicate name check (case-insensitive, same kind, same user/org scope)
    const orgFilter = body.organizationId
      ? eq(categories.organizationId, body.organizationId)
      : and(eq(categories.userId, req.userId!), isNull(categories.organizationId))
    const duplicate = (await db.select({ id: categories.id }).from(categories)
      .where(and(orgFilter, ilike(categories.name, body.name), eq(categories.kind, body.kind))).limit(1))[0]
    if (duplicate) {
      res.status(409).json({ error: `Ya existe una categoría de ${body.kind === 'expense' ? 'gasto' : 'ingreso'} con ese nombre` }); return
    }
    const [row] = await db.insert(categories).values({ ...body, userId: req.userId! }).returning()
    res.status(201).json({ data: mapOut(row) })
  } catch (err) {
    console.error('[categories POST /]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = (await db.select({ id: categories.id }).from(categories)
      .where(and(eq(categories.id, req.params.id as string), eq(categories.userId, req.userId!), isNull(categories.deletedAt))).limit(1))[0]
    if (!existing) { res.status(404).json({ error: 'Categoría no encontrada' }); return }

    let body: z.infer<typeof CategoryPatchSchema>
    try {
      body = CategoryPatchSchema.parse(req.body)
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues }); return
      }
      throw err
    }
    // Duplicate name check on rename
    if (body.name || body.kind) {
      const current = (await db.select({ name: categories.name, kind: categories.kind, organizationId: categories.organizationId }).from(categories).where(eq(categories.id, req.params.id as string)).limit(1))[0]
      const checkName = body.name ?? current.name
      const checkKind = body.kind ?? current.kind
      const orgFilter = current.organizationId
        ? eq(categories.organizationId, current.organizationId)
        : and(eq(categories.userId, req.userId!), isNull(categories.organizationId))
      const duplicate = (await db.select({ id: categories.id }).from(categories)
        .where(and(orgFilter, ilike(categories.name, checkName), eq(categories.kind, checkKind), ne(categories.id, req.params.id as string))).limit(1))[0]
      if (duplicate) {
        res.status(409).json({ error: `Ya existe una categoría de ${checkKind === 'expense' ? 'gasto' : 'ingreso'} con ese nombre` }); return
      }
    }
    const [updated] = await db.update(categories).set(body).where(eq(categories.id, req.params.id as string)).returning()
    res.json({ data: mapOut(updated) })
  } catch (err) {
    console.error('[categories PATCH /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = (await db.select({ id: categories.id }).from(categories)
      .where(and(eq(categories.id, req.params.id as string), eq(categories.userId, req.userId!))).limit(1))[0]
    if (!existing) { res.status(404).json({ error: 'Categoría no encontrada' }); return }
    await db.delete(categories).where(eq(categories.id, req.params.id as string))
    res.json({ ok: true })
  } catch (err) {
    console.error('[categories DELETE /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
