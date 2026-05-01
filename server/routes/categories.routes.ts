import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { categories } from '../db/schema.js'
import { and, eq, isNull, asc } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { z } from 'zod'

const router = Router()

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
    const filter = orgId
      ? eq(categories.organizationId, orgId)
      : and(eq(categories.userId, req.userId!), isNull(categories.organizationId))
    const rows = await db.select().from(categories).where(filter).orderBy(asc(categories.name))
    res.json({ data: rows })
  } catch (err) {
    console.error('[categories GET /]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const row = (await db.select().from(categories)
      .where(and(eq(categories.id, req.params.id), eq(categories.userId, req.userId!))).limit(1))[0]
    if (!row) { res.status(404).json({ error: 'Categoría no encontrada' }); return }
    res.json({ data: row })
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
        res.status(400).json({ error: 'Datos inválidos', details: err.errors }); return
      }
      throw err
    }
    const [row] = await db.insert(categories).values({ ...body, userId: req.userId! }).returning()
    res.status(201).json({ data: row })
  } catch (err) {
    console.error('[categories POST /]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = (await db.select({ id: categories.id }).from(categories)
      .where(and(eq(categories.id, req.params.id), eq(categories.userId, req.userId!))).limit(1))[0]
    if (!existing) { res.status(404).json({ error: 'Categoría no encontrada' }); return }

    let body: z.infer<typeof CategoryPatchSchema>
    try {
      body = CategoryPatchSchema.parse(req.body)
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.errors }); return
      }
      throw err
    }
    const [updated] = await db.update(categories).set(body).where(eq(categories.id, req.params.id)).returning()
    res.json({ data: updated })
  } catch (err) {
    console.error('[categories PATCH /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = (await db.select({ id: categories.id }).from(categories)
      .where(and(eq(categories.id, req.params.id), eq(categories.userId, req.userId!))).limit(1))[0]
    if (!existing) { res.status(404).json({ error: 'Categoría no encontrada' }); return }
    await db.delete(categories).where(eq(categories.id, req.params.id))
    res.json({ ok: true })
  } catch (err) {
    console.error('[categories DELETE /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
