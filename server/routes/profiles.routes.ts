import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { profiles, users } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { z } from 'zod'

const router = Router()

// Drizzle returns camelCase; the client contract expects snake_case.
function mapProfileOut(row: Record<string, any> | null | undefined) {
  if (!row) return null
  return {
    ...row,
    display_name:    row.displayName    ?? row.display_name    ?? null,
    avatar_url:      row.avatarUrl      ?? row.avatar_url      ?? null,
    avatar_type:     row.avatarType     ?? row.avatar_type     ?? null,
    is_suspended:    row.isSuspended    ?? row.is_suspended    ?? false,
    is_super_admin:  row.isSuperAdmin   ?? row.is_super_admin  ?? false,
    telegram_chat_id: row.telegramChatId ?? row.telegram_chat_id ?? null,
    onboarding_done: row.onboardingDone ?? row.onboarding_done ?? false,
    created_at:      row.createdAt      ?? row.created_at,
    updated_at:      row.updatedAt      ?? row.updated_at,
  }
}

// Allowlist of fields a user may set on their own profile.
// Critically excludes: id, isSuperAdmin, email (managed by auth), telegramChatId (managed by bot).
const ProfilePatchSchema = z.object({
  name:            z.string().max(120).optional(),
  // displayName / avatarType are used by the ProfileSettings UI
  displayName:     z.string().max(120).optional().nullable(),
  avatarType:      z.string().max(200).optional().nullable(),
  // Only allow https:// avatar URLs to prevent javascript: / data: URL injection
  avatarUrl:       z.string().url().max(500).refine(
    v => v == null || v.startsWith('https://'),
    { message: 'avatarUrl must use https://' }
  ).optional().nullable(),
  bio:             z.string().max(500).optional().nullable(),
  phone:           z.string().max(30).optional().nullable(),
  timezone:        z.string().max(50).optional().nullable(),
  locale:          z.string().max(10).optional().nullable(),
  currency:        z.string().max(10).optional().nullable(),
  theme:           z.string().max(20).optional().nullable(),
  onboardingDone:  z.boolean().optional(),
}).strict()

// Safe subset of profile fields returned to admin list — excludes telegramChatId and other sensitive fields
const SAFE_PROFILE_FIELDS = {
  id:           profiles.id,
  email:        profiles.email,
  displayName:  profiles.displayName,
  avatarUrl:    profiles.avatarUrl,
  isSuspended:  profiles.isSuspended,
  isSuperAdmin: profiles.isSuperAdmin,
  createdAt:    profiles.createdAt,
} as const

// GET /api/v1/profiles/me
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const row = (await db.select().from(profiles).where(eq(profiles.id, req.userId!)).limit(1))[0]
    res.json({ data: mapProfileOut(row) })
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
        res.status(400).json({ error: 'Datos inválidos', details: err.issues }); return
      }
      throw err
    }

    const existing = (await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.id, req.userId!)).limit(1))[0]
    if (!existing) {
      const [row] = await db.insert(profiles).values({ ...updates, id: req.userId! }).returning()
      res.json({ data: mapProfileOut(row) }); return
    }
    const [updated] = await db.update(profiles).set(updates).where(eq(profiles.id, req.userId!)).returning()
    res.json({ data: mapProfileOut(updated) })
  } catch (err) {
    console.error('[profiles PATCH /me]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// GET /api/v1/profiles — admin only: list all (for AdminPanel) with pagination
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Only super-admins may list all profiles
    const self = (await db.select({ isSuperAdmin: profiles.isSuperAdmin }).from(profiles).where(eq(profiles.id, req.userId!)).limit(1))[0]
    if (!self?.isSuperAdmin) {
      res.status(403).json({ error: 'No tienes permisos de administrador' }); return
    }
    const limit = Math.min(Number(req.query.limit) || 100, 500)
    const offset = Number(req.query.offset) || 0
    // Join with users table to get isActive (approval status) — never expose
    // telegramChatId, passwordHash, or reset tokens to the list endpoint.
    const rows = await db
      .select({
        id:           profiles.id,
        email:        profiles.email,
        displayName:  profiles.displayName,
        avatarUrl:    profiles.avatarUrl,
        isSuspended:  profiles.isSuspended,
        isSuperAdmin: profiles.isSuperAdmin,
        createdAt:    profiles.createdAt,
        isActive:     users.isActive,
      })
      .from(profiles)
      .leftJoin(users, eq(users.id, profiles.id))
      .limit(limit)
      .offset(offset)
    // Map to snake_case expected by the frontend
    const data = rows.map(r => ({
      id:             r.id,
      email:          r.email,
      display_name:   r.displayName,
      avatar_url:     r.avatarUrl,
      is_suspended:   r.isSuspended,
      is_super_admin: r.isSuperAdmin,
      is_approved:    r.isActive ?? true,
      created_at:     r.createdAt,
    }))
    res.json({ data, limit, offset })
  } catch (err) {
    console.error('[profiles GET /]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// GET /api/v1/profiles/:id — own profile or admin
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const targetId = String(req.params.id)
    // Allow users to fetch their own profile; admins can fetch any
    if (targetId !== req.userId) {
      const self = (await db.select({ isSuperAdmin: profiles.isSuperAdmin }).from(profiles).where(eq(profiles.id, req.userId!)).limit(1))[0]
      if (!self?.isSuperAdmin) {
        res.status(403).json({ error: 'No tienes permisos para ver este perfil' }); return
      }
    }
    const row = (await db.select().from(profiles).where(eq(profiles.id, targetId)).limit(1))[0]
    if (!row) { res.status(404).json({ error: 'Perfil no encontrado' }); return }
    res.json({ data: mapProfileOut(row) })
  } catch (err) {
    console.error('[profiles GET /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// PATCH /api/v1/profiles/:id — admin only: update is_suspended / is_approved flags
// NOTE: Sensitive actions like full user delete must go through /api/v1/admin/users/:id
router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const self = (await db.select({ isSuperAdmin: profiles.isSuperAdmin }).from(profiles).where(eq(profiles.id, req.userId!)).limit(1))[0]
    if (!self?.isSuperAdmin) {
      res.status(403).json({ error: 'No tienes permisos de administrador' }); return
    }
    const targetId = String(req.params.id)
    // Only allow toggling suspension and approval — never allow setting isSuperAdmin via this endpoint
    const AdminProfilePatchSchema = z.object({
      is_suspended: z.boolean().optional(),
      is_approved:  z.boolean().optional(),
    }).strict()

    let updates: z.infer<typeof AdminProfilePatchSchema>
    try {
      updates = AdminProfilePatchSchema.parse(req.body)
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues }); return
      }
      throw err
    }

    const dbUpdates: Record<string, unknown> = {}
    if (updates.is_suspended !== undefined) dbUpdates.isSuspended = updates.is_suspended

    if (Object.keys(dbUpdates).length === 0) {
      res.status(400).json({ error: 'No hay campos válidos para actualizar' }); return
    }

    const [updated] = await db
      .update(profiles)
      .set(dbUpdates)
      .where(eq(profiles.id, targetId))
      .returning({ id: profiles.id })
    if (!updated) { res.status(404).json({ error: 'Perfil no encontrado' }); return }

    console.info(`[ADMIN AUDIT] actor=${req.userId} action=PATCH_PROFILE target=${targetId} fields=${Object.keys(dbUpdates).join(',')} ts=${new Date().toISOString()}`)
    res.json({ ok: true })
  } catch (err) {
    console.error('[profiles PATCH /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// DELETE /api/v1/profiles/:id — admin only: hard-delete user record
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const self = (await db.select({ isSuperAdmin: profiles.isSuperAdmin }).from(profiles).where(eq(profiles.id, req.userId!)).limit(1))[0]
    if (!self?.isSuperAdmin) {
      res.status(403).json({ error: 'No tienes permisos de administrador' }); return
    }
    const targetId = String(req.params.id)
    if (targetId === req.userId) {
      res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' }); return
    }
    // Delete user record — cascades to profile via FK
    await db.delete(users).where(eq(users.id, targetId))
    console.info(`[ADMIN AUDIT] actor=${req.userId} action=DELETE_USER target=${targetId} ts=${new Date().toISOString()}`)
    res.json({ ok: true })
  } catch (err) {
    console.error('[profiles DELETE /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
