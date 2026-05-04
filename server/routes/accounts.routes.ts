import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { accounts, movements } from '../db/schema.js'
import { and, eq, isNull, asc, count, ilike, ne, inArray, sql } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { assertOrgMember } from '../middleware/orgMembership.js'
import { z } from 'zod'

// Sums all confirmed-or-otherwise movements for the given account ids and
// returns a per-account delta (income - expense - transfer_out + transfer_in)
// to add on top of the stored opening balance.
async function computeMovementDeltas(accountIds: string[]): Promise<Map<string, number>> {
  const deltas = new Map<string, number>()
  if (accountIds.length === 0) return deltas
  const rows = await db
    .select({
      accountId: movements.accountId,
      kind: movements.kind,
      total: sql<string>`COALESCE(SUM(${movements.amount}), 0)`,
    })
    .from(movements)
    .where(and(inArray(movements.accountId, accountIds), isNull(movements.deletedAt)))
    .groupBy(movements.accountId, movements.kind)
  for (const r of rows) {
    const amt = Number(r.total) || 0
    const prev = deltas.get(r.accountId) ?? 0
    if (r.kind === 'income' || r.kind === 'transfer_in') deltas.set(r.accountId, prev + amt)
    else if (r.kind === 'expense' || r.kind === 'transfer_out') deltas.set(r.accountId, prev - amt)
  }
  return deltas
}

// For each account id, returns how many active movements are attached directly
// to it. Combined with is_parent, this surfaces "pending reassignment" on the UI.
async function computeMovementCounts(accountIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (accountIds.length === 0) return counts
  const rows = await db
    .select({ accountId: movements.accountId, c: count() })
    .from(movements)
    .where(and(inArray(movements.accountId, accountIds), isNull(movements.deletedAt)))
    .groupBy(movements.accountId)
  for (const r of rows) counts.set(r.accountId, Number(r.c) || 0)
  return counts
}

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
  if (body.name        !== undefined) out.name            = typeof body.name === 'string' ? body.name.slice(0, 150) : body.name
  if (body.type        !== undefined) out.type            = body.type
  if (body.description !== undefined) out.description     = typeof body.description === 'string' ? body.description.slice(0, 500) : body.description
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

const AccountCreateSchema = z.object({
  name:              z.string().min(1).max(150),
  type:              z.string().max(50).optional(),
  description:       z.string().max(500).optional().nullable(),
  color:             z.string().max(30).optional().nullable(),
  icon:              z.string().max(50).optional().nullable(),
  currency:          z.string().max(10).optional(),
  balance:           z.string().or(z.number()).transform(String).optional(),
  is_active:         z.boolean().optional(),
  isActive:          z.boolean().optional(),
  parent_account_id: z.string().uuid().optional().nullable(),
  parentAccountId:   z.string().uuid().optional().nullable(),
  organization_id:   z.string().uuid().optional().nullable(),
  organizationId:    z.string().uuid().optional().nullable(),
})

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.query.org_id as string | undefined
    if (orgId) {
      const ok = await assertOrgMember(req, res, orgId)
      if (!ok) return
    }
    const limit = Math.min(Number(req.query.limit) || 200, 1000)
    const offset = Number(req.query.offset) || 0
    const whereClause = and(userFilter(req, orgId), isNull(accounts.deletedAt))
    const selectFields = {
      id:              accounts.id,
      name:            accounts.name,
      type:            accounts.type,
      description:     accounts.description,
      color:           accounts.color,
      icon:            accounts.icon,
      currency:        accounts.currency,
      balance:         accounts.balance,
      userId:          accounts.userId,
      organizationId:  accounts.organizationId,
      isActive:        accounts.isActive,
      parentAccountId: accounts.parentAccountId,
      createdAt:       accounts.createdAt,
      updatedAt:       accounts.updatedAt,
      deletedAt:       accounts.deletedAt,
      createdByEmail:  accounts.createdByEmail,
      updatedByEmail:  accounts.updatedByEmail,
    }
    const [rows, [{ total }]] = await Promise.all([
      db.select(selectFields).from(accounts)
        .where(whereClause)
        .orderBy(asc(accounts.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(accounts).where(whereClause),
    ])
    const ids = rows.map(r => r.id)
    const [deltas, counts] = await Promise.all([
      computeMovementDeltas(ids),
      computeMovementCounts(ids),
    ])
    const childCount = new Map<string, number>()
    for (const r of rows) {
      const p = (r as any).parentAccountId as string | null
      if (p) childCount.set(p, (childCount.get(p) ?? 0) + 1)
    }
    const enriched = rows.map(r => {
      const stored = Number(r.balance) || 0
      const delta = deltas.get(r.id) ?? 0
      const isParent = (childCount.get(r.id) ?? 0) > 0
      const movementCount = counts.get(r.id) ?? 0
      return {
        ...r,
        balance: (stored + delta).toFixed(2),
        is_parent: isParent,
        pending_movements_count: isParent ? movementCount : 0,
      }
    })
    res.json({ data: enriched.map(mapOut), total: Number(total), limit, offset })
  } catch (err) {
    console.error('[accounts GET /]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const row = (await db.select().from(accounts)
      .where(and(eq(accounts.id, id), eq(accounts.userId, req.userId!)))
      .limit(1))[0]
    if (!row) { res.status(404).json({ error: 'Cuenta no encontrada' }); return }
    const [deltas, counts, [{ children }]] = await Promise.all([
      computeMovementDeltas([id]),
      computeMovementCounts([id]),
      db.select({ children: count() }).from(accounts)
        .where(and(eq(accounts.parentAccountId, id), isNull(accounts.deletedAt))),
    ])
    const stored = Number((row as any).balance) || 0
    const delta = deltas.get(id) ?? 0
    const isParent = Number(children) > 0
    res.json({ data: mapOut({
      ...row,
      balance: (stored + delta).toFixed(2),
      is_parent: isParent,
      pending_movements_count: isParent ? (counts.get(id) ?? 0) : 0,
    }) })
  } catch (err) {
    console.error('[accounts GET /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    let parsed: z.infer<typeof AccountCreateSchema>
    try {
      parsed = AccountCreateSchema.parse(req.body)
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues }); return
      }
      throw err
    }
    const b = parsed
    const orgId = b.organization_id ?? b.organizationId ?? null
    // Org membership check when organization_id is provided
    if (orgId) {
      const ok = await assertOrgMember(req, res, orgId)
      if (!ok) return
    }
    // Duplicate name check (case-insensitive, same user/org scope)
    const dupFilter = orgId
      ? and(eq(accounts.organizationId, orgId), ilike(accounts.name, b.name), isNull(accounts.deletedAt))
      : and(eq(accounts.userId, req.userId!), isNull(accounts.organizationId), ilike(accounts.name, b.name), isNull(accounts.deletedAt))
    const duplicate = (await db.select({ id: accounts.id }).from(accounts).where(dupFilter).limit(1))[0]
    if (duplicate) {
      res.status(409).json({ error: 'Ya existe una cuenta con ese nombre' }); return
    }
    const actorEmail = req.userEmail ?? null
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
      createdByEmail:  actorEmail,
      updatedByEmail:  actorEmail,
    }).returning()
    res.status(201).json({ data: mapOut(row) })
  } catch (err) {
    console.error('[accounts POST /]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const existing = (await db.select({ id: accounts.id, name: accounts.name, organizationId: accounts.organizationId }).from(accounts)
      .where(and(eq(accounts.id, id), eq(accounts.userId, req.userId!), isNull(accounts.deletedAt))).limit(1))[0]
    if (!existing) { res.status(404).json({ error: 'Cuenta no encontrada' }); return }

    const patch = mapInPartial(req.body)

    // Duplicate name check on rename (case-insensitive, same user/org scope)
    if (patch.name !== undefined) {
      const orgId = existing.organizationId ?? null
      const dupFilterExcludingSelf = orgId
        ? and(eq(accounts.organizationId, orgId), ilike(accounts.name, patch.name as string), isNull(accounts.deletedAt), ne(accounts.id, id))
        : and(eq(accounts.userId, req.userId!), isNull(accounts.organizationId), ilike(accounts.name, patch.name as string), isNull(accounts.deletedAt), ne(accounts.id, id))
      const duplicate = (await db.select({ id: accounts.id }).from(accounts).where(dupFilterExcludingSelf).limit(1))[0]
      if (duplicate) {
        res.status(409).json({ error: 'Ya existe una cuenta con ese nombre' }); return
      }
    }

    const actorEmail = req.userEmail ?? null
    const [updated] = await db.update(accounts)
      .set({ ...patch, updatedByEmail: actorEmail } as any)
      .where(eq(accounts.id, id))
      .returning()
    res.json({ data: mapOut(updated) })
  } catch (err) {
    console.error('[accounts PATCH /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const existing = (await db.select({ id: accounts.id }).from(accounts)
      .where(and(eq(accounts.id, id), eq(accounts.userId, req.userId!), isNull(accounts.deletedAt))).limit(1))[0]
    if (!existing) { res.status(404).json({ error: 'Cuenta no encontrada' }); return }
    const actorEmail = req.userEmail ?? null
    await db.update(accounts).set({ deletedAt: new Date().toISOString(), updatedByEmail: actorEmail } as any).where(eq(accounts.id, id))
    res.json({ ok: true })
  } catch (err) {
    console.error('[accounts DELETE /:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
