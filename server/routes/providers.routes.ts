import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { providers } from '../db/schema.js'
import { and, eq, ilike, asc, count } from 'drizzle-orm'
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
    usage_count:     row.usageCount     ?? row.usage_count     ?? 0,
    last_used_at:    row.lastUsedAt     ?? row.last_used_at    ?? null,
    created_at:      row.createdAt      ?? row.created_at,
  }
}

// Accept both snake_case and camelCase. The DB schema does not have
// `category`/`website`/`description`/`isActive` columns; we accept them for
// client compatibility but ignore them on persistence.
const ProviderCreateSchema = z.object({
  name:            z.string().min(1).max(150),
  category:        z.string().max(80).optional().nullable(),
  website:         z.string().max(300).optional().nullable(),
  description:     z.string().max(500).optional().nullable(),
  is_active:       z.boolean().optional(),
  isActive:        z.boolean().optional(),
  usage_count:     z.number().int().optional(),
  usageCount:      z.number().int().optional(),
  last_used_at:    z.string().optional().nullable(),
  lastUsedAt:      z.string().optional().nullable(),
  organization_id: z.string().uuid().optional().nullable(),
  organizationId:  z.string().uuid().optional().nullable(),
})

const ProviderPatchSchema = ProviderCreateSchema.partial()

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query.q as string | undefined
    const limit = Math.min(Number(req.query.limit) || 200, 1000)
    const offset = Number(req.query.offset) || 0
    const filter = q
      ? and(eq(providers.userId, req.userId!), ilike(providers.name, `%${q}%`))
      : eq(providers.userId, req.userId!)
    const [rows, [{ total }]] = await Promise.all([
      db.select().from(providers).where(filter).orderBy(asc(providers.name)).limit(limit).offset(offset),
      db.select({ total: count() }).from(providers).where(filter),
    ])
    res.json({ data: rows.map(mapOut), total: Number(total), limit, offset })
  } catch (err) {
    console.error('[providers GET /]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    let body: z.infer<typeof ProviderCreateSchema>
    try {
      body = ProviderCreateSchema.parse(req.body)
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
    const [row] = await db.insert(providers).values({
      name:           body.name,
      organizationId: orgId,
      userId:         req.userId!,
    }).returning()
    res.status(201).json({ data: mapOut(row) })
  } catch (err) {
    console.error('[providers POST /]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.patch('/:id', validateUuid('id'), authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = (await db.select({ id: providers.id }).from(providers)
      .where(and(eq(providers.id, req.params.id as string), eq(providers.userId, req.userId!))).limit(1))[0]
    if (!existing) { res.status(404).json({ error: 'Proveedor no encontrado' }); return }

    let body: z.infer<typeof ProviderPatchSchema>
    try {
      body = ProviderPatchSchema.parse(req.body)
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues }); return
      }
      throw err
    }
    const patch: Record<string, any> = {}
    if (body.name !== undefined) patch.name = body.name
    const lastUsedAt = body.last_used_at ?? body.lastUsedAt
    if (lastUsedAt !== undefined) patch.lastUsedAt = lastUsedAt
    const usageCount = body.usage_count ?? body.usageCount
    if (usageCount !== undefined) patch.usageCount = usageCount
    const orgId = body.organization_id ?? body.organizationId
    if (orgId !== undefined) {
      if (orgId) {
        const ok = await assertOrgMember(req, res, orgId)
        if (!ok) return
      }
      patch.organizationId = orgId ?? null
    }

    const [updated] = await db.update(providers).set(patch).where(eq(providers.id, req.params.id as string)).returning()
    res.json({ data: mapOut(updated) })
  } catch (err) {
    console.error('[providers PATCH /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.delete('/:id', validateUuid('id'), authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = (await db.select({ id: providers.id }).from(providers)
      .where(and(eq(providers.id, req.params.id as string), eq(providers.userId, req.userId!))).limit(1))[0]
    if (!existing) { res.status(404).json({ error: 'Proveedor no encontrado' }); return }
    await db.delete(providers).where(eq(providers.id, req.params.id as string))
    res.json({ ok: true })
  } catch (err) {
    console.error('[providers DELETE /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
