import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { apiTokens } from '../db/schema.js'
import { and, eq, desc, count } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { validateUuid } from '../middleware/validateUuid.js'
import crypto from 'crypto'
import { z } from 'zod'

const router = Router()

// Drizzle returns camelCase; the client contract expects snake_case.
function mapOut(row: Record<string, any>) {
  return {
    ...row,
    user_id:         row.userId         ?? row.user_id,
    organization_id: row.organizationId ?? row.organization_id ?? null,
    token_hash:      row.tokenHash      ?? row.token_hash      ?? null,
    last_used_at:    row.lastUsedAt     ?? row.last_used_at    ?? null,
    expires_at:      row.expiresAt      ?? row.expires_at      ?? null,
    created_at:      row.createdAt      ?? row.created_at,
  }
}

const TokenCreateSchema = z.object({
  name:            z.string().min(1).max(100),
  scopes:          z.array(z.string().max(80)).optional().default([]),
  organization_id: z.string().uuid().optional().nullable(),
  organizationId:  z.string().uuid().optional().nullable(),
})

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500)
    const offset = Number(req.query.offset) || 0
    const whereClause = eq(apiTokens.userId, req.userId!)
    const [rows, [{ total }]] = await Promise.all([
      db.select().from(apiTokens)
        .where(whereClause)
        .orderBy(desc(apiTokens.createdAt))
        .limit(limit).offset(offset),
      db.select({ total: count() }).from(apiTokens).where(whereClause),
    ])
    res.json({ data: rows.map(mapOut), total: Number(total), limit, offset })
  } catch (err) {
    console.error('[api-tokens GET /]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    let body: z.infer<typeof TokenCreateSchema>
    try {
      body = TokenCreateSchema.parse(req.body)
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues }); return
      }
      throw err
    }
    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
    const orgId = body.organization_id ?? body.organizationId ?? null
    const [row] = await db.insert(apiTokens)
      .values({ name: body.name, scopes: body.scopes, organizationId: orgId, userId: req.userId!, tokenHash }).returning()
    res.status(201).json({ data: { ...mapOut(row), token: rawToken } })
  } catch (err) {
    console.error('[api-tokens POST /]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.patch('/:id', validateUuid('id'), authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = (await db.select({ id: apiTokens.id }).from(apiTokens)
      .where(and(eq(apiTokens.id, req.params.id as string), eq(apiTokens.userId, req.userId!))).limit(1))[0]
    if (!existing) { res.status(404).json({ error: 'Token no encontrado' }); return }
    const [updated] = await db.update(apiTokens).set({ scopes: req.body.scopes }).where(eq(apiTokens.id, req.params.id as string)).returning()
    res.json({ data: mapOut(updated) })
  } catch (err) {
    console.error('[api-tokens PATCH /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.delete('/:id', validateUuid('id'), authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = (await db.select({ id: apiTokens.id }).from(apiTokens)
      .where(and(eq(apiTokens.id, req.params.id as string), eq(apiTokens.userId, req.userId!))).limit(1))[0]
    if (!existing) { res.status(404).json({ error: 'Token no encontrado' }); return }
    await db.delete(apiTokens).where(eq(apiTokens.id, req.params.id as string))
    res.json({ ok: true })
  } catch (err) {
    console.error('[api-tokens DELETE /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
