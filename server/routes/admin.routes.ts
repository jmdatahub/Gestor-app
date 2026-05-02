import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { profiles, organizations, organizationMembers, users } from '../db/schema.js'
import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { sendWelcomeEmail } from '../services/email.service.js'

const router = Router()

/**
 * Resolves the current user's super-admin flag from `profiles.is_super_admin`.
 * Used as gate for all routes in this file (and as the response of /me).
 */
async function getIsSuperAdmin(userId: string): Promise<boolean> {
  const row = (await db
    .select({ isSuperAdmin: profiles.isSuperAdmin })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1))[0]
  return !!row?.isSuperAdmin
}

async function requireSuperAdmin(req: AuthRequest, res: Response): Promise<boolean> {
  const ok = await getIsSuperAdmin(req.userId!)
  if (!ok) {
    res.status(403).json({ error: 'No tienes permisos de administrador' })
    return false
  }
  return true
}

/** Writes a one-line audit entry to stdout so it appears in server logs. */
function auditLog(actorId: string, actorEmail: string | undefined, action: string, target: string) {
  console.info(`[ADMIN AUDIT] actor=${actorId} email=${actorEmail ?? 'unknown'} action=${action} target=${target} ts=${new Date().toISOString()}`)
}

// GET /api/v1/admin/me — devuelve el flag de super-admin del usuario actual
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const isSuperAdmin = await getIsSuperAdmin(req.userId!)
    res.json({ data: { is_super_admin: isSuperAdmin } })
  } catch (err) {
    console.error('[admin GET /me]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// GET /api/v1/admin/organizations — lista todas las orgs activas con member_count
router.get('/organizations', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!(await requireSuperAdmin(req, res))) return
    const rows = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        description: organizations.description,
        parent_id: organizations.parentId,
        created_at: organizations.createdAt,
        deleted_at: organizations.deletedAt,
        member_count: sql<number>`(SELECT COUNT(*)::int FROM ${organizationMembers} WHERE ${organizationMembers.orgId} = ${organizations.id})`,
      })
      .from(organizations)
      .where(isNull(organizations.deletedAt))
    res.json({ data: rows })
  } catch (err) {
    console.error('[admin GET /organizations]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// GET /api/v1/admin/organizations/deleted — papelera de orgs
router.get('/organizations/deleted', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!(await requireSuperAdmin(req, res))) return
    const rows = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        description: organizations.description,
        parent_id: organizations.parentId,
        created_at: organizations.createdAt,
        deleted_at: organizations.deletedAt,
      })
      .from(organizations)
      .where(isNotNull(organizations.deletedAt))
    res.json({ data: rows })
  } catch (err) {
    console.error('[admin GET /organizations/deleted]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// PATCH /api/v1/admin/organizations/:id
router.patch('/organizations/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!(await requireSuperAdmin(req, res))) return
    const orgId = String(req.params.id)
    const { name, slug, description, parent_id } = req.body || {}
    const updates: Record<string, unknown> = {}
    if (name !== undefined) updates.name = name
    if (slug !== undefined) updates.slug = slug
    if (description !== undefined) updates.description = description
    if (parent_id !== undefined) updates.parentId = parent_id
    const [updated] = await db
      .update(organizations)
      .set(updates)
      .where(eq(organizations.id, orgId))
      .returning()
    if (!updated) { res.status(404).json({ error: 'Organización no encontrada' }); return }
    auditLog(req.userId!, req.userEmail, 'UPDATE_ORGANIZATION', orgId)
    res.json({ data: updated })
  } catch (err) {
    console.error('[admin PATCH /organizations/:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// DELETE /api/v1/admin/organizations/:id — soft delete
router.delete('/organizations/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!(await requireSuperAdmin(req, res))) return
    const orgId = String(req.params.id)
    await db
      .update(organizations)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(organizations.id, orgId))
    auditLog(req.userId!, req.userEmail, 'SOFT_DELETE_ORGANIZATION', orgId)
    res.json({ ok: true })
  } catch (err) {
    console.error('[admin DELETE /organizations/:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// POST /api/v1/admin/organizations/:id/restore
router.post('/organizations/:id/restore', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!(await requireSuperAdmin(req, res))) return
    const orgId = String(req.params.id)
    await db
      .update(organizations)
      .set({ deletedAt: null })
      .where(eq(organizations.id, orgId))
    auditLog(req.userId!, req.userEmail, 'RESTORE_ORGANIZATION', orgId)
    res.json({ ok: true })
  } catch (err) {
    console.error('[admin POST /organizations/:id/restore]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// DELETE /api/v1/admin/organizations/:id/permanent — hard delete
router.delete('/organizations/:id/permanent', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!(await requireSuperAdmin(req, res))) return
    const orgId = String(req.params.id)
    await db.delete(organizations).where(eq(organizations.id, orgId))
    auditLog(req.userId!, req.userEmail, 'PERMANENT_DELETE_ORGANIZATION', orgId)
    res.json({ ok: true })
  } catch (err) {
    console.error('[admin DELETE /organizations/:id/permanent]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// POST /api/v1/admin/organizations/purge — elimina las soft-deleted con > 7 días
router.post('/organizations/purge', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!(await requireSuperAdmin(req, res))) return
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const deleted = await db
      .delete(organizations)
      .where(and(isNotNull(organizations.deletedAt), sql`${organizations.deletedAt} < ${cutoff}`))
      .returning({ id: organizations.id })
    auditLog(req.userId!, req.userEmail, 'PURGE_ORGANIZATIONS', `count=${deleted.length}`)
    res.json({ ok: true, purged: deleted.length })
  } catch (err) {
    console.error('[admin POST /organizations/purge]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// PATCH /api/v1/admin/users/:id/suspend — suspend/unsuspend user
router.patch('/users/:id/suspend', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!(await requireSuperAdmin(req, res))) return
    const targetId = String(req.params.id)
    const { suspended } = req.body || {}
    const isSuspended = suspended === true || suspended === 'true'
    const [updated] = await db
      .update(profiles)
      .set({ isSuspended })
      .where(eq(profiles.id, targetId))
      .returning({ id: profiles.id })
    if (!updated) { res.status(404).json({ error: 'Usuario no encontrado' }); return }
    auditLog(req.userId!, req.userEmail, isSuspended ? 'SUSPEND_USER' : 'UNSUSPEND_USER', targetId)
    res.json({ ok: true })
  } catch (err) {
    console.error('[admin PATCH /users/:id/suspend]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// PATCH /api/v1/admin/users/:id/approve — approve pending user (set isActive = true)
router.patch('/users/:id/approve', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!(await requireSuperAdmin(req, res))) return
    const targetId = String(req.params.id)
    const [updated] = await db
      .update(users)
      .set({ isActive: true })
      .where(eq(users.id, targetId))
      .returning({ id: users.id, email: users.email, name: users.name })
    if (!updated) { res.status(404).json({ error: 'Usuario no encontrado' }); return }
    auditLog(req.userId!, req.userEmail, 'APPROVE_USER', targetId)
    // Send welcome email to the newly approved user (non-blocking)
    sendWelcomeEmail(updated.email, updated.name || '')
      .catch(err => console.warn('[admin/approve] welcome email failed:', err))
    res.json({ ok: true, user: { id: updated.id, email: updated.email } })
  } catch (err) {
    console.error('[admin PATCH /users/:id/approve]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// PATCH /api/v1/admin/users/:id/reject — reject pending user (set isActive = false)
router.patch('/users/:id/reject', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!(await requireSuperAdmin(req, res))) return
    const targetId = String(req.params.id)
    const [updated] = await db
      .update(users)
      .set({ isActive: false })
      .where(eq(users.id, targetId))
      .returning({ id: users.id, email: users.email })
    if (!updated) { res.status(404).json({ error: 'Usuario no encontrado' }); return }
    auditLog(req.userId!, req.userEmail, 'REJECT_USER', targetId)
    res.json({ ok: true, user: updated })
  } catch (err) {
    console.error('[admin PATCH /users/:id/reject]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// DELETE /api/v1/admin/users/:id — delete user (reject / hard delete)
router.delete('/users/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!(await requireSuperAdmin(req, res))) return
    const targetId = String(req.params.id)
    // Prevent self-deletion
    if (targetId === req.userId) {
      res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' })
      return
    }
    await db.delete(users).where(eq(users.id, targetId))
    auditLog(req.userId!, req.userEmail, 'DELETE_USER', targetId)
    res.json({ ok: true })
  } catch (err) {
    console.error('[admin DELETE /users/:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
