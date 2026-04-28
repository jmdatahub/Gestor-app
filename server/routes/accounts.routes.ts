import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { accounts } from '../db/schema.js'
import { and, eq, isNull, asc } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'

const router = Router()

function userFilter(req: AuthRequest, orgId?: string | null) {
  if (orgId) return eq(accounts.organizationId, orgId)
  return and(eq(accounts.userId, req.userId!), isNull(accounts.organizationId))
}

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const orgId = req.query.org_id as string | undefined
  const rows = await db.select().from(accounts)
    .where(and(userFilter(req, orgId), isNull(accounts.deletedAt)))
    .orderBy(asc(accounts.createdAt))
  res.json({ data: rows })
})

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const row = (await db.select().from(accounts)
    .where(and(eq(accounts.id, req.params.id), eq(accounts.userId, req.userId!)))
    .limit(1))[0]
  if (!row) { res.status(404).json({ error: 'Cuenta no encontrada' }); return }
  res.json({ data: row })
})

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const [row] = await db.insert(accounts).values({ ...req.body, userId: req.userId! }).returning()
  res.status(201).json({ data: row })
})

router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const existing = (await db.select({ id: accounts.id }).from(accounts)
    .where(and(eq(accounts.id, req.params.id), eq(accounts.userId, req.userId!))).limit(1))[0]
  if (!existing) { res.status(404).json({ error: 'Cuenta no encontrada' }); return }
  const [updated] = await db.update(accounts).set(req.body).where(eq(accounts.id, req.params.id)).returning()
  res.json({ data: updated })
})

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const existing = (await db.select({ id: accounts.id }).from(accounts)
    .where(and(eq(accounts.id, req.params.id), eq(accounts.userId, req.userId!))).limit(1))[0]
  if (!existing) { res.status(404).json({ error: 'Cuenta no encontrada' }); return }
  await db.update(accounts).set({ deletedAt: new Date().toISOString() }).where(eq(accounts.id, req.params.id))
  res.json({ ok: true })
})

export default router
