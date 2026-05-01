import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { apiTokens } from '../db/schema.js'
import { and, eq, desc } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import crypto from 'crypto'
import { z } from 'zod'

const router = Router()

const TokenCreateSchema = z.object({
  name:           z.string().min(1).max(100),
  scopes:         z.array(z.string().max(80)).optional().default([]),
  organizationId: z.string().uuid().optional().nullable(),
}).strict()

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const rows = await db.select().from(apiTokens)
      .where(eq(apiTokens.userId, req.userId!))
      .orderBy(desc(apiTokens.createdAt))
    res.json({ data: rows })
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
        res.status(400).json({ error: 'Datos inválidos', details: err.errors }); return
      }
      throw err
    }
    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
    const [row] = await db.insert(apiTokens)
      .values({ name: body.name, scopes: body.scopes, organizationId: body.organizationId ?? null, userId: req.userId!, token: rawToken, tokenHash }).returning()
    res.status(201).json({ data: row })
  } catch (err) {
    console.error('[api-tokens POST /]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const existing = (await db.select({ id: apiTokens.id }).from(apiTokens)
    .where(and(eq(apiTokens.id, req.params.id), eq(apiTokens.userId, req.userId!))).limit(1))[0]
  if (!existing) { res.status(404).json({ error: 'Token no encontrado' }); return }
  const [updated] = await db.update(apiTokens).set({ scopes: req.body.scopes }).where(eq(apiTokens.id, req.params.id)).returning()
  res.json({ data: updated })
})

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const existing = (await db.select({ id: apiTokens.id }).from(apiTokens)
    .where(and(eq(apiTokens.id, req.params.id), eq(apiTokens.userId, req.userId!))).limit(1))[0]
  if (!existing) { res.status(404).json({ error: 'Token no encontrado' }); return }
  await db.delete(apiTokens).where(eq(apiTokens.id, req.params.id))
  res.json({ ok: true })
})

export default router
