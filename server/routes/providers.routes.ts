import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { providers } from '../db/schema.js'
import { and, eq, ilike, asc, count } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { z } from 'zod'

const router = Router()

const ProviderCreateSchema = z.object({
  name:        z.string().min(1).max(150),
  category:    z.string().max(80).optional().nullable(),
  website:     z.string().url().max(300).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  isActive:    z.boolean().optional().default(true),
}).strict()

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
    res.json({ data: rows, total: Number(total), limit, offset })
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
    const [row] = await db.insert(providers).values({ ...body, userId: req.userId! }).returning()
    res.status(201).json({ data: row })
  } catch (err) {
    console.error('[providers POST /]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
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
    const [updated] = await db.update(providers).set(body).where(eq(providers.id, req.params.id as string)).returning()
    res.json({ data: updated })
  } catch (err) {
    console.error('[providers PATCH /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
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
