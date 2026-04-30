import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { accounts } from '../db/schema.js'
import { and, eq, isNull, asc } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'

const router = Router()

// Drizzle returns camelCase; the client contract expects snake_case.
// These helpers bridge the gap without changing the schema or client types.
function mapOut(row: Record<string, any>) {
  return {
    ...row,
    user_id:           row.userId          ?? row.user_id,
    organization_id:   row.organizationId  ?? row.organization_id  ?? null,
    is_active:         row.isActive        ?? row.is_active        ?? true,
    parent_account_id: row.parentAccountId ?? row.parent_account_id ?? null,
    created_at:        row.createdAt       ?? row.created_at,
    updated_at:        row.updatedAt       ?? row.updated_at,
    deleted_at:        row.deletedAt       ?? row.deleted_at       ?? null,
    created_by_email:  row.createdByEmail  ?? row.created_by_email ?? null,
    updated_by_email:  row.updatedByEmail  ?? row.updated_by_email ?? null,
  }
}

// For PATCH: map only the fields present in the body (partial update)
function mapInPartial(body: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {}
  if (body.name        !== undefined) out.name            = body.name
  if (body.type        !== undefined) out.type            = body.type
  if (body.description !== undefined) out.description     = body.description
  if (body.color       !== undefined) out.color           = body.color
  if (body.icon        !== undefined) out.icon            = body.icon
  if (body.currency    !== undefined) out.currency        = body.currency
  if (body.balance     !== undefined) out.balance         = body.balance
  const isActive = body.is_active ?? body.isActive
  if (isActive !== undefined) out.isActive = isActive
  const parentId = body.parent_account_id ?? body.parentAccountId
  if (parentId !== undefined) out.parentAccountId = parentId ?? null
  const orgId = body.organization_id ?? body.organizationId
  if (orgId !== undefined) out.organizationId = orgId ?? null
  return out
}

function userFilter(req: AuthRequest, orgId?: string | null) {
  if (orgId) return eq(accounts.organizationId, orgId)
  return and(eq(accounts.userId, req.userId!), isNull(accounts.organizationId))
}

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const orgId = req.query.org_id as string | undefined
  const rows = await db.select().from(accounts)
    .where(and(userFilter(req, orgId), isNull(accounts.deletedAt)))
    .orderBy(asc(accounts.createdAt))
  res.json({ data: rows.map(mapOut) })
})

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string
  const row = (await db.select().from(accounts)
    .where(and(eq(accounts.id, id), eq(accounts.userId, req.userId!)))
    .limit(1))[0]
  if (!row) { res.status(404).json({ error: 'Cuenta no encontrada' }); return }
  res.json({ data: mapOut(row) })
})

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const b = req.body
  const [row] = await db.insert(accounts).values({
    name:            b.name,
    type:            b.type            ?? 'general',
    description:     b.description     ?? null,
    color:           b.color           ?? null,
    icon:            b.icon            ?? null,
    currency:        b.currency        ?? 'EUR',
    balance:         b.balance         ?? '0',
    userId:          req.userId!,
    isActive:        b.is_active       ?? b.isActive       ?? true,
    parentAccountId: b.parent_account_id ?? b.parentAccountId ?? null,
    organizationId:  b.organization_id ?? b.organizationId  ?? null,
  }).returning()
  res.status(201).json({ data: mapOut(row) })
})

router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string
  const existing = (await db.select({ id: accounts.id }).from(accounts)
    .where(and(eq(accounts.id, id), eq(accounts.userId, req.userId!))).limit(1))[0]
  if (!existing) { res.status(404).json({ error: 'Cuenta no encontrada' }); return }
  const [updated] = await db.update(accounts)
    .set(mapInPartial(req.body) as any)
    .where(eq(accounts.id, id))
    .returning()
  res.json({ data: mapOut(updated) })
})

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string
  const existing = (await db.select({ id: accounts.id }).from(accounts)
    .where(and(eq(accounts.id, id), eq(accounts.userId, req.userId!))).limit(1))[0]
  if (!existing) { res.status(404).json({ error: 'Cuenta no encontrada' }); return }
  await db.update(accounts).set({ deletedAt: new Date().toISOString() }).where(eq(accounts.id, id))
  res.json({ ok: true })
})

export default router
