import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { and, eq, isNull, desc, asc, sql } from 'drizzle-orm'
import type { PgTableWithColumns } from 'drizzle-orm/pg-core'

export interface CrudOptions {
  orgSupport?: boolean
  softDelete?: boolean
  defaultOrderBy?: 'created_at' | 'date' | 'name'
  defaultOrderDir?: 'asc' | 'desc'
}

// Generic CRUD router factory for tables with user_id (and optional organization_id)
export function createCrudRouter(
  table: PgTableWithColumns<any>,
  opts: CrudOptions = {}
) {
  const router = Router()
  const {
    orgSupport = true,
    softDelete = false,
    defaultOrderBy = 'created_at',
    defaultOrderDir = 'desc',
  } = opts

  function userFilter(req: AuthRequest, orgId?: string | null) {
    const userId = req.userId!
    if (orgSupport && orgId) {
      return eq((table as any).organizationId, orgId)
    }
    if (orgSupport) {
      return and(eq((table as any).userId, userId), isNull((table as any).organizationId))
    }
    return eq((table as any).userId, userId)
  }

  function softDeleteFilter() {
    return softDelete ? isNull((table as any).deletedAt) : undefined
  }

  // GET / — list
  router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    const limit = Math.min(Number(req.query.limit) || 100, 500)
    const offset = Number(req.query.offset) || 0
    const orgId = req.query.org_id as string | undefined

    const filters = [userFilter(req, orgId), softDeleteFilter()].filter(Boolean)
    const col = (table as any)[defaultOrderBy]
    const order = col ? (defaultOrderDir === 'desc' ? desc(col) : asc(col)) : undefined

    const q = db.select().from(table).where(and(...(filters as any[]))).limit(limit).offset(offset)
    const rows = order ? await q.orderBy(order) : await q
    res.json({ data: rows, limit, offset })
  })

  // GET /:id
  router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    const row = (await db.select().from(table)
      .where(and(eq((table as any).id, req.params.id), eq((table as any).userId, req.userId!)))
      .limit(1))[0]
    if (!row) { res.status(404).json({ error: 'No encontrado' }); return }
    res.json({ data: row })
  })

  // POST /
  router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    const [row] = await db.insert(table).values({ ...req.body, userId: req.userId! }).returning()
    res.status(201).json({ data: row })
  })

  // PATCH /:id
  router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    const existing = (await db.select({ id: (table as any).id }).from(table)
      .where(and(eq((table as any).id, req.params.id), eq((table as any).userId, req.userId!)))
      .limit(1))[0]
    if (!existing) { res.status(404).json({ error: 'No encontrado' }); return }
    const [updated] = await db.update(table).set(req.body).where(eq((table as any).id, req.params.id)).returning()
    res.json({ data: updated })
  })

  // DELETE /:id
  router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    const existing = (await db.select({ id: (table as any).id }).from(table)
      .where(and(eq((table as any).id, req.params.id), eq((table as any).userId, req.userId!)))
      .limit(1))[0]
    if (!existing) { res.status(404).json({ error: 'No encontrado' }); return }
    if (softDelete) {
      await db.update(table).set({ deletedAt: new Date().toISOString() }).where(eq((table as any).id, req.params.id))
    } else {
      await db.delete(table).where(eq((table as any).id, req.params.id))
    }
    res.json({ ok: true })
  })

  return router
}
