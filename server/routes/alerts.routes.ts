import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { alerts, alertRules } from '../db/schema.js'
import { and, eq, desc, count } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'

const router = Router()

// ─── Alerts ───────────────────────────────────────────────────────────────────
router.get('/alerts', authMiddleware, async (req: AuthRequest, res: Response) => {
  const rows = await db.select().from(alerts)
    .where(eq(alerts.userId, req.userId!))
    .orderBy(desc(alerts.createdAt))
  const [{ value: total }] = await db.select({ value: count() }).from(alerts).where(eq(alerts.userId, req.userId!))
  res.json({ data: rows, total })
})

router.post('/alerts', authMiddleware, async (req: AuthRequest, res: Response) => {
  const [row] = await db.insert(alerts).values({ ...req.body, userId: req.userId! }).returning()
  res.status(201).json({ data: row })
})

router.patch('/alerts/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const existing = (await db.select({ id: alerts.id }).from(alerts)
    .where(and(eq(alerts.id, req.params.id), eq(alerts.userId, req.userId!))).limit(1))[0]
  if (!existing) { res.status(404).json({ error: 'Alerta no encontrada' }); return }
  const [updated] = await db.update(alerts).set(req.body).where(eq(alerts.id, req.params.id)).returning()
  res.json({ data: updated })
})

router.delete('/alerts/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const existing = (await db.select({ id: alerts.id }).from(alerts)
    .where(and(eq(alerts.id, req.params.id), eq(alerts.userId, req.userId!))).limit(1))[0]
  if (!existing) { res.status(404).json({ error: 'Alerta no encontrada' }); return }
  await db.delete(alerts).where(eq(alerts.id, req.params.id))
  res.json({ ok: true })
})

// ─── Alert Rules ──────────────────────────────────────────────────────────────
router.get('/alert-rules', authMiddleware, async (req: AuthRequest, res: Response) => {
  const rows = await db.select().from(alertRules)
    .where(eq(alertRules.userId, req.userId!))
  res.json({ data: rows })
})

router.post('/alert-rules', authMiddleware, async (req: AuthRequest, res: Response) => {
  const [row] = await db.insert(alertRules).values({ ...req.body, userId: req.userId! }).returning()
  res.status(201).json({ data: row })
})

router.patch('/alert-rules/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const existing = (await db.select({ id: alertRules.id }).from(alertRules)
    .where(and(eq(alertRules.id, req.params.id), eq(alertRules.userId, req.userId!))).limit(1))[0]
  if (!existing) { res.status(404).json({ error: 'Regla no encontrada' }); return }
  const [updated] = await db.update(alertRules).set(req.body).where(eq(alertRules.id, req.params.id)).returning()
  res.json({ data: updated })
})

router.delete('/alert-rules/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const existing = (await db.select({ id: alertRules.id }).from(alertRules)
    .where(and(eq(alertRules.id, req.params.id), eq(alertRules.userId, req.userId!))).limit(1))[0]
  if (!existing) { res.status(404).json({ error: 'Regla no encontrada' }); return }
  await db.delete(alertRules).where(eq(alertRules.id, req.params.id))
  res.json({ ok: true })
})

export default router
