import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { profiles, organizations, organizationMembers, users } from '../db/schema.js'
import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'

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

// GET /api/v1/admin/me — devuelve el flag de super-admin del usuario actual
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  const isSuperAdmin = await getIsSuperAdmin(req.userId!)
  res.json({ data: { is_super_admin: isSuperAdmin } })
})

// GET /api/v1/admin/organizations — lista todas las orgs activas con member_count
router.get('/organizations', authMiddleware, async (req: AuthRequest, res: Response) => {
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
})

// GET /api/v1/admin/organizations/deleted — papelera de orgs
router.get('/organizations/deleted', authMiddleware, async (req: AuthRequest, res: Response) => {
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
})

// PATCH /api/v1/admin/organizations/:id
router.patch('/organizations/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!(await requireSuperAdmin(req, res))) return
  const { name, slug, description, parent_id } = req.body || {}
  const updates: Record<string, unknown> = {}
  if (name !== undefined) updates.name = name
  if (slug !== undefined) updates.slug = slug
  if (description !== undefined) updates.description = description
  if (parent_id !== undefined) updates.parentId = parent_id
  const [updated] = await db
    .update(organizations)
    .set(updates)
    .where(eq(organizations.id, req.params.id))
    .returning()
  if (!updated) { res.status(404).json({ error: 'Organización no encontrada' }); return }
  res.json({ data: updated })
})

// DELETE /api/v1/admin/organizations/:id — soft delete
router.delete('/organizations/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!(await requireSuperAdmin(req, res))) return
  await db
    .update(organizations)
    .set({ deletedAt: new Date().toISOString() })
    .where(eq(organizations.id, req.params.id))
  res.json({ ok: true })
})

// POST /api/v1/admin/organizations/:id/restore
router.post('/organizations/:id/restore', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!(await requireSuperAdmin(req, res))) return
  await db
    .update(organizations)
    .set({ deletedAt: null })
    .where(eq(organizations.id, req.params.id))
  res.json({ ok: true })
})

// DELETE /api/v1/admin/organizations/:id/permanent — hard delete
router.delete('/organizations/:id/permanent', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!(await requireSuperAdmin(req, res))) return
  await db.delete(organizations).where(eq(organizations.id, req.params.id))
  res.json({ ok: true })
})

// POST /api/v1/admin/organizations/purge — elimina las soft-deleted con > 30 días
router.post('/organizations/purge', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!(await requireSuperAdmin(req, res))) return
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const deleted = await db
    .delete(organizations)
    .where(and(isNotNull(organizations.deletedAt), sql`${organizations.deletedAt} < ${cutoff}`))
    .returning({ id: organizations.id })
  res.json({ ok: true, purged: deleted.length })
})

// PATCH /api/v1/admin/users/:id/approve — approve pending user (set isActive = true)
router.patch('/users/:id/approve', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!(await requireSuperAdmin(req, res))) return
  const [updated] = await db
    .update(users)
    .set({ isActive: true })
    .where(eq(users.id, req.params.id))
    .returning({ id: users.id, email: users.email })
  if (!updated) { res.status(404).json({ error: 'Usuario no encontrado' }); return }
  res.json({ ok: true, user: updated })
})

// DELETE /api/v1/admin/users/:id — delete user (reject / hard delete)
router.delete('/users/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!(await requireSuperAdmin(req, res))) return
  await db.delete(users).where(eq(users.id, req.params.id))
  res.json({ ok: true })
})

export default router
