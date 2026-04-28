import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { organizations, organizationMembers, organizationInvitations, profiles } from '../db/schema.js'
import { and, eq, inArray } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'

const router = Router()

// GET /api/v1/organizations — user's orgs via organization_members
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const memberships = await db.select().from(organizationMembers)
    .where(eq(organizationMembers.userId, req.userId!))
  if (!memberships.length) { res.json({ data: [] }); return }
  const orgIds = memberships.map(m => m.orgId)
  const orgs = await db.select().from(organizations).where(inArray(organizations.id, orgIds))
  res.json({ data: orgs.map(org => ({
    ...org,
    role: memberships.find(m => m.orgId === org.id)?.role,
  })) })
})

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const [org] = await db.insert(organizations).values({ ...req.body, ownerId: req.userId! }).returning()
  await db.insert(organizationMembers).values({ orgId: org.id, userId: req.userId!, role: 'owner' })
  res.status(201).json({ data: org })
})

router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const member = (await db.select().from(organizationMembers)
    .where(and(eq(organizationMembers.orgId, req.params.id), eq(organizationMembers.userId, req.userId!)))
    .limit(1))[0]
  if (!member || !['owner', 'admin'].includes(member.role)) { res.status(403).json({ error: 'Sin permiso' }); return }
  const [updated] = await db.update(organizations).set(req.body).where(eq(organizations.id, req.params.id)).returning()
  res.json({ data: updated })
})

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const member = (await db.select().from(organizationMembers)
    .where(and(eq(organizationMembers.orgId, req.params.id), eq(organizationMembers.userId, req.userId!)))
    .limit(1))[0]
  if (!member || member.role !== 'owner') { res.status(403).json({ error: 'Solo el owner puede borrar' }); return }
  await db.update(organizations).set({ deletedAt: new Date().toISOString() }).where(eq(organizations.id, req.params.id))
  res.json({ ok: true })
})

// ─── Members ──────────────────────────────────────────────────────────────────
router.get('/:id/members', authMiddleware, async (req: AuthRequest, res: Response) => {
  const rows = await db.select().from(organizationMembers)
    .where(eq(organizationMembers.orgId, req.params.id))
  res.json({ data: rows })
})

router.delete('/:id/members/:userId', authMiddleware, async (req: AuthRequest, res: Response) => {
  await db.delete(organizationMembers)
    .where(and(eq(organizationMembers.orgId, req.params.id), eq(organizationMembers.userId, req.params.userId)))
  res.json({ ok: true })
})

router.patch('/:id/members/:userId', authMiddleware, async (req: AuthRequest, res: Response) => {
  await db.update(organizationMembers).set({ role: req.body.role })
    .where(and(eq(organizationMembers.orgId, req.params.id), eq(organizationMembers.userId, req.params.userId)))
  res.json({ ok: true })
})

// ─── Invitations ──────────────────────────────────────────────────────────────
router.get('/:id/invitations', authMiddleware, async (req: AuthRequest, res: Response) => {
  const rows = await db.select().from(organizationInvitations)
    .where(eq(organizationInvitations.orgId, req.params.id))
  res.json({ data: rows })
})

router.post('/:id/invitations', authMiddleware, async (req: AuthRequest, res: Response) => {
  const [row] = await db.insert(organizationInvitations)
    .values({ ...req.body, orgId: req.params.id, invitedBy: req.userId! }).returning()
  res.status(201).json({ data: row })
})

router.delete('/:id/invitations/:invId', authMiddleware, async (req: AuthRequest, res: Response) => {
  await db.delete(organizationInvitations).where(eq(organizationInvitations.id, req.params.invId))
  res.json({ ok: true })
})

// GET /api/v1/organizations/invitations/pending?email=... — for AppLayout invitation badge
router.get('/invitations/pending', authMiddleware, async (req: AuthRequest, res: Response) => {
  const email = req.query.email as string
  if (!email) { res.json({ data: [] }); return }
  const rows = await db.select().from(organizationInvitations)
    .where(eq(organizationInvitations.email, email))
  res.json({ data: rows })
})

export default router
