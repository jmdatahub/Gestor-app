import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { organizations, organizationMembers, organizationInvitations } from '../db/schema.js'
import { and, eq, inArray, count } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { z } from 'zod'

const router = Router()

const OrgCreateSchema = z.object({
  name:        z.string().min(1).max(150),
  slug:        z.string().min(1).max(80).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().max(500).optional().nullable(),
  parentId:    z.string().uuid().optional().nullable(),
}).strict()

const OrgPatchSchema = OrgCreateSchema.partial()

const InvitationCreateSchema = z.object({
  email: z.string().email().max(200),
  role:  z.enum(['admin', 'member', 'viewer']).optional().default('member'),
}).strict()

const ADMIN_ROLES = ['owner', 'admin'] as const

/** Verify the caller is a member of the org and return their membership row. Returns 403 if not. */
async function requireMembership(
  req: AuthRequest, res: Response, orgId: string, requiredRoles?: string[],
): Promise<{ orgId: string; userId: string; role: string } | null> {
  const member = (await db.select().from(organizationMembers)
    .where(and(eq(organizationMembers.orgId, orgId), eq(organizationMembers.userId, req.userId!)))
    .limit(1))[0]
  if (!member) { res.status(403).json({ error: 'No eres miembro de esta organización' }); return null }
  if (requiredRoles && !requiredRoles.includes(member.role)) {
    res.status(403).json({ error: 'Sin permiso' }); return null
  }
  return member
}

// GET /api/v1/organizations — user's orgs via organization_members (single JOIN query)
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500)
    const offset = Number(req.query.offset) || 0
    const memberWhere = eq(organizationMembers.userId, req.userId!)
    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          ownerId: organizations.ownerId,
          createdAt: organizations.createdAt,
          updatedAt: organizations.updatedAt,
          parentId: organizations.parentId,
          description: organizations.description,
          deletedAt: organizations.deletedAt,
          role: organizationMembers.role,
        })
        .from(organizationMembers)
        .innerJoin(organizations, eq(organizations.id, organizationMembers.orgId))
        .where(memberWhere)
        .limit(limit).offset(offset),
      db.select({ total: count() }).from(organizationMembers).where(memberWhere),
    ])
    res.json({ data: rows, total: Number(total), limit, offset })
  } catch (err) {
    console.error('[orgs GET /]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    let body: z.infer<typeof OrgCreateSchema>
    try {
      body = OrgCreateSchema.parse(req.body)
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues }); return
      }
      throw err
    }
    const [org] = await db.insert(organizations).values({ ...body, ownerId: req.userId! }).returning()
    await db.insert(organizationMembers).values({ orgId: org.id, userId: req.userId!, role: 'owner' })
    res.status(201).json({ data: org })
  } catch (err) {
    console.error('[orgs POST /]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const member = await requireMembership(req, res, req.params.id as string, [...ADMIN_ROLES])
    if (!member) return

    let body: z.infer<typeof OrgPatchSchema>
    try {
      body = OrgPatchSchema.parse(req.body)
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues }); return
      }
      throw err
    }
    const [updated] = await db.update(organizations).set(body).where(eq(organizations.id, req.params.id as string)).returning()
    res.json({ data: updated })
  } catch (err) {
    console.error('[orgs PATCH /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const member = await requireMembership(req, res, req.params.id as string, ['owner'])
    if (!member) return
    await db.update(organizations).set({ deletedAt: new Date().toISOString() }).where(eq(organizations.id, req.params.id as string))
    res.json({ ok: true })
  } catch (err) {
    console.error('[orgs DELETE /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// ─── Members ──────────────────────────────────────────────────────────────────
router.get('/:id/members', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Only members of the org may list its members
    const self = await requireMembership(req, res, req.params.id as string)
    if (!self) return
    const limit = Math.min(Number(req.query.limit) || 100, 500)
    const offset = Number(req.query.offset) || 0
    const membersWhere = eq(organizationMembers.orgId, req.params.id as string)
    const [rows, [{ total }]] = await Promise.all([
      db.select().from(organizationMembers)
        .where(membersWhere)
        .limit(limit).offset(offset),
      db.select({ total: count() }).from(organizationMembers).where(membersWhere),
    ])
    res.json({ data: rows, total: Number(total), limit, offset })
  } catch (err) {
    console.error('[orgs GET /:id/members]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.delete('/:id/members/:userId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Only owner/admin can remove members (or a member can remove themselves)
    const self = await requireMembership(req, res, req.params.id as string)
    if (!self) return
    const isSelf = req.params.userId as string === req.userId
    if (!isSelf && !ADMIN_ROLES.includes(self.role as any)) {
      res.status(403).json({ error: 'Sin permiso para eliminar miembros' }); return
    }
    await db.delete(organizationMembers)
      .where(and(eq(organizationMembers.orgId, req.params.id as string), eq(organizationMembers.userId, req.params.userId as string)))
    res.json({ ok: true })
  } catch (err) {
    console.error('[orgs DELETE /:id/members/:userId]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.patch('/:id/members/:userId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Only owner/admin can change roles
    const self = await requireMembership(req, res, req.params.id as string, [...ADMIN_ROLES])
    if (!self) return

    const RoleSchema = z.object({ role: z.enum(['owner', 'admin', 'member', 'viewer']) }).strict()
    let body: z.infer<typeof RoleSchema>
    try {
      body = RoleSchema.parse(req.body)
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues }); return
      }
      throw err
    }
    await db.update(organizationMembers).set({ role: body.role })
      .where(and(eq(organizationMembers.orgId, req.params.id as string), eq(organizationMembers.userId, req.params.userId as string)))
    res.json({ ok: true })
  } catch (err) {
    console.error('[orgs PATCH /:id/members/:userId]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// ─── Invitations ──────────────────────────────────────────────────────────────
router.get('/:id/invitations', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Only members may view invitations
    const self = await requireMembership(req, res, req.params.id as string, [...ADMIN_ROLES])
    if (!self) return
    const limit = Math.min(Number(req.query.limit) || 100, 500)
    const offset = Number(req.query.offset) || 0
    const invWhere = eq(organizationInvitations.orgId, req.params.id as string)
    const [rows, [{ total }]] = await Promise.all([
      db.select().from(organizationInvitations)
        .where(invWhere)
        .limit(limit).offset(offset),
      db.select({ total: count() }).from(organizationInvitations).where(invWhere),
    ])
    res.json({ data: rows, total: Number(total), limit, offset })
  } catch (err) {
    console.error('[orgs GET /:id/invitations]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.post('/:id/invitations', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const self = await requireMembership(req, res, req.params.id as string, [...ADMIN_ROLES])
    if (!self) return

    let body: z.infer<typeof InvitationCreateSchema>
    try {
      body = InvitationCreateSchema.parse(req.body)
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues }); return
      }
      throw err
    }
    const [row] = await db.insert(organizationInvitations)
      .values({ ...body, orgId: req.params.id as string, invitedBy: req.userId! }).returning()
    res.status(201).json({ data: row })
  } catch (err) {
    console.error('[orgs POST /:id/invitations]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.delete('/:id/invitations/:invId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Only admin/owner of the org can revoke invitations
    const self = await requireMembership(req, res, req.params.id as string, [...ADMIN_ROLES])
    if (!self) return
    await db.delete(organizationInvitations).where(
      and(
        eq(organizationInvitations.id, req.params.invId as string),
        eq(organizationInvitations.orgId, req.params.id as string),
      )
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('[orgs DELETE /:id/invitations/:invId]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// GET /api/v1/organizations/invitations/pending?email=... — for AppLayout invitation badge
router.get('/invitations/pending', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const email = req.query.email as string
    if (!email) { res.json({ data: [] }); return }
    const rows = await db.select().from(organizationInvitations)
      .where(eq(organizationInvitations.email, email))
      .limit(50)
    res.json({ data: rows })
  } catch (err) {
    console.error('[orgs GET /invitations/pending]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// POST /api/v1/organizations/invitations/:id/accept — accept an invitation by its ID
router.post('/invitations/:id/accept', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const invId = req.params.id as string
    const invitation = (await db.select().from(organizationInvitations)
      .where(eq(organizationInvitations.id, invId)).limit(1))[0]
    if (!invitation) { res.status(404).json({ error: 'Invitación no encontrada' }); return }

    // Insert member + delete invitation atomically so neither can succeed without the other
    await db.transaction(async (tx) => {
      await tx.insert(organizationMembers)
        .values({ orgId: invitation.orgId, userId: req.userId!, role: invitation.role })
        .onConflictDoNothing()
      await tx.delete(organizationInvitations).where(eq(organizationInvitations.id, invId))
    })

    res.json({ ok: true })
  } catch (err) {
    console.error('[orgs POST /invitations/:id/accept]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// POST /api/v1/organizations/invitations/:id/decline — decline an invitation by its ID
router.post('/invitations/:id/decline', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const invId = req.params.id as string
    const invitation = (await db.select({ id: organizationInvitations.id }).from(organizationInvitations)
      .where(eq(organizationInvitations.id, invId)).limit(1))[0]
    if (!invitation) { res.status(404).json({ error: 'Invitación no encontrada' }); return }

    await db.delete(organizationInvitations).where(eq(organizationInvitations.id, invId))
    res.json({ ok: true })
  } catch (err) {
    console.error('[orgs POST /invitations/:id/decline]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// DELETE /api/v1/organizations/invitations/:invId — cancel an invitation by ID (single-arg form)
router.delete('/invitations/:invId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const invId = req.params.invId as string
    // Only the inviting org's admin/owner may cancel — verify caller is a member of the org
    const invitation = (await db.select({ orgId: organizationInvitations.orgId }).from(organizationInvitations)
      .where(eq(organizationInvitations.id, invId)).limit(1))[0]
    if (!invitation) { res.status(404).json({ error: 'Invitación no encontrada' }); return }

    const self = await requireMembership(req, res, invitation.orgId, [...ADMIN_ROLES])
    if (!self) return

    await db.delete(organizationInvitations).where(eq(organizationInvitations.id, invId))
    res.json({ ok: true })
  } catch (err) {
    console.error('[orgs DELETE /invitations/:invId]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// GET /api/v1/organizations/:id — fetch a single organization by ID (member access required)
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Run membership check and org fetch in parallel
    const [self, row] = await Promise.all([
      requireMembership(req, res, req.params.id as string),
      db.select().from(organizations).where(eq(organizations.id, req.params.id as string)).limit(1).then(r => r[0]),
    ])
    if (!self) return  // requireMembership already sent 403
    if (!row) { res.status(404).json({ error: 'Organización no encontrada' }); return }
    res.json({ data: row })
  } catch (err) {
    console.error('[orgs GET /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
