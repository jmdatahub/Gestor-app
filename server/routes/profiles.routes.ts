import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { profiles, users } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { z } from 'zod'

const router = Router()

// Allowlist of fields a user may set on their own profile.
// Critically excludes: id, isSuperAdmin, email (managed by auth), telegramChatId (managed by bot).
const ProfilePatchSchema = z.object({
  name:            z.string().max(120).optional(),
  avatarUrl:       z.string().url().max(500).optional().nullable(),
  bio:             z.string().max(500).optional().nullable(),
  phone:           z.string().max(30).optional().nullable(),
  timezone:        z.string().max(50).optional().nullable(),
  locale:          z.string().max(10).optional().nullable(),
  currency:        z.string().max(10).optional().nullable(),
  theme:           z.string().max(20).optional().nullable(),
  onboardingDone:  z.boolean().optional(),
}).strict()

// GET /api/v1/profiles/me
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const row = (await db.select().from(profiles).where(eq(profiles.id, req.userId!)).limit(1))[0]
    res.json({ data: row || null })
  } catch (err) {
    console.error('[profiles GET /me]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.patch('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    let updates: z.infer<typeof ProfilePatchSchema>
    try {
      updates = ProfilePatchSchema.parse(req.body)
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.errors }); return
      }
      throw err
    }

    const existing = (await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.id, req.userId!)).limit(1))[0]
    if (!existing) {
      const [row] = await db.insert(profiles).values({ ...updates, id: req.userId! }).returning()
      res.json({ data: row }); return
    }
    const [updated] = await db.update(profiles).set(updates).where(eq(profiles.id, req.userId!)).returning()
    res.json({ data: updated })
  } catch (err) {
    console.error('[profiles PATCH /me]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// GET /api/v1/profiles — admin only: list all (for AdminPanel)
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Only super-admins may list all profiles
    const self = (await db.select({ isSuperAdmin: profiles.isSuperAdmin }).from(profiles).where(eq(profiles.id, req.userId!)).limit(1))[0]
    if (!self?.isSuperAdmin) {
      res.status(403).json({ error: 'No tienes permisos de administrador' }); return
    }
    const limit = Math.min(Number(req.query.limit) || 100, 500)
    const offset = Number(req.query.offset) || 0
    const rows = await db.select().from(profiles).limit(limit).offset(offset)
    res.json({ data: rows, limit, offset })
  } catch (err) {
    console.error('[profiles GET /]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// GET /api/v1/profiles/:id — own profile or admin
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const targetId = req.params.id
    // Allow users to fetch their own profile; admins can fetch any
    if (targetId !== req.userId) {
      const self = (await db.select({ isSuperAdmin: profiles.isSuperAdmin }).from(profiles).where(eq(profiles.id, req.userId!)).limit(1))[0]
      if (!self?.isSuperAdmin) {
        res.status(403).json({ error: 'No tienes permisos para ver este perfil' }); return
      }
    }
    const row = (await db.select().from(profiles).where(eq(profiles.id, targetId)).limit(1))[0]
    if (!row) { res.status(404).json({ error: 'Perfil no encontrado' }); return }
    res.json({ data: row })
  } catch (err) {
    console.error('[profiles GET /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
