import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { alerts, alertRules } from '../db/schema.js'
import { and, eq, desc, sql, count } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { z } from 'zod'

const router = Router()

// ── Field-name bridges ────────────────────────────────────────────────────────
function mapOutAlert(row: Record<string, any>) {
  return {
    ...row,
    user_id:    row.userId    ?? row.user_id,
    is_read:    row.isRead    ?? row.is_read    ?? false,
    created_at: row.createdAt ?? row.created_at,
  }
}

function mapOutAlertRule(row: Record<string, any>) {
  return {
    ...row,
    user_id:            row.userId           ?? row.user_id,
    is_active:          row.isActive         ?? row.is_active          ?? true,
    trigger_mode:       row.triggerMode      ?? row.trigger_mode       ?? 'repeat',
    last_triggered_at:  row.lastTriggeredAt  ?? row.last_triggered_at  ?? null,
    category_id:        row.categoryId       ?? row.category_id        ?? null,
    created_at:         row.createdAt        ?? row.created_at,
  }
}

// Accept both camelCase and snake_case from client, normalize to camelCase for Drizzle
function mapInAlert(body: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {}
  if (body.type    != null) out.type    = body.type
  if (body.title   != null) out.title   = body.title
  if (body.message != null) out.message = body.message
  const isRead = body.is_read ?? body.isRead
  if (isRead != null) out.isRead = isRead
  return out
}

function mapInAlertRule(body: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {}
  if (body.name      != null) out.name      = body.name
  if (body.type      != null) out.type      = body.type
  if (body.threshold != null) out.threshold = body.threshold
  if (body.conditions != null) out.condition = body.conditions
  const isActive = body.is_active ?? body.isActive
  if (isActive != null) out.isActive = isActive
  const catId = body.category_id ?? body.categoryId
  if (catId !== undefined) out.categoryId = catId ?? null
  const triggerMode = body.trigger_mode ?? body.triggerMode
  if (triggerMode != null) out.triggerMode = triggerMode
  if (body.severity  != null) out.severity  = body.severity
  if (body.period    != null) out.period    = body.period
  const lastTriggered = body.last_triggered_at ?? body.lastTriggeredAt
  if (lastTriggered != null) out.lastTriggeredAt = lastTriggered
  return out
}

const AlertCreateSchema = z.object({
  type:    z.string().min(1).max(60),
  title:   z.string().min(1).max(200),
  message: z.string().max(1000).optional().nullable(),
  isRead:  z.boolean().optional().default(false),
  is_read: z.boolean().optional(),
}).passthrough()

const AlertPatchSchema = AlertCreateSchema.partial()

const AlertRuleCreateSchema = z.object({
  name:             z.string().min(1).max(150),
  type:             z.string().min(1).max(60),
  threshold:        z.number().optional().nullable(),
  categoryId:       z.string().uuid().optional().nullable(),
  category_id:      z.string().uuid().optional().nullable(),
  isActive:         z.boolean().optional().default(true),
  is_active:        z.boolean().optional(),
  conditions:       z.record(z.string(), z.unknown()).optional().nullable(),
  severity:         z.string().optional().nullable(),
  trigger_mode:     z.string().optional().nullable(),
  triggerMode:      z.string().optional().nullable(),
  period:           z.string().optional().nullable(),
  last_triggered_at: z.string().optional().nullable(),
}).passthrough()

const AlertRulePatchSchema = AlertRuleCreateSchema.partial()

// ─── Alerts ───────────────────────────────────────────────────────────────────
router.get('/alerts', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200)
    const offset = Number(req.query.offset) || 0
    // Use a window function to get total count in a single round-trip
    const rows = await db
      .select({
        id: alerts.id,
        userId: alerts.userId,
        type: alerts.type,
        title: alerts.title,
        message: alerts.message,
        isRead: alerts.isRead,
        createdAt: alerts.createdAt,
        total: sql<number>`COUNT(*) OVER ()`.as('total'),
      })
      .from(alerts)
      .where(eq(alerts.userId, req.userId!))
      .orderBy(desc(alerts.createdAt))
      .limit(limit)
      .offset(offset)
    const total = rows.length > 0 ? Number(rows[0].total) : 0
    res.json({ data: rows.map(r => mapOutAlert(r as any)), total, limit, offset })
  } catch (err) {
    console.error('[alerts GET /alerts]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.post('/alerts', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    let body: z.infer<typeof AlertCreateSchema>
    try {
      body = AlertCreateSchema.parse(req.body)
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues }); return
      }
      throw err
    }
    const insertValues = mapInAlert(body as any)
    const [row] = await db.insert(alerts).values({ ...insertValues, userId: req.userId! } as any).returning()
    res.status(201).json({ data: mapOutAlert(row as any) })
  } catch (err) {
    console.error('[alerts POST /alerts]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// PATCH /api/v1/alerts/read-all — mark all alerts as read for the current user
router.patch('/alerts/read-all', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await db.update(alerts).set({ isRead: true }).where(eq(alerts.userId, req.userId!))
    res.json({ ok: true })
  } catch (err) {
    console.error('[alerts PATCH /alerts/read-all]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.patch('/alerts/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = (await db.select({ id: alerts.id }).from(alerts)
      .where(and(eq(alerts.id, req.params.id as string), eq(alerts.userId, req.userId!))).limit(1))[0]
    if (!existing) { res.status(404).json({ error: 'Alerta no encontrada' }); return }

    let body: z.infer<typeof AlertPatchSchema>
    try {
      body = AlertPatchSchema.parse(req.body)
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues }); return
      }
      throw err
    }
    const [updated] = await db.update(alerts).set(mapInAlert(body as any) as any).where(eq(alerts.id, req.params.id as string)).returning()
    res.json({ data: mapOutAlert(updated as any) })
  } catch (err) {
    console.error('[alerts PATCH /alerts/:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.delete('/alerts/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = (await db.select({ id: alerts.id }).from(alerts)
      .where(and(eq(alerts.id, req.params.id as string), eq(alerts.userId, req.userId!))).limit(1))[0]
    if (!existing) { res.status(404).json({ error: 'Alerta no encontrada' }); return }
    await db.delete(alerts).where(eq(alerts.id, req.params.id as string))
    res.json({ ok: true })
  } catch (err) {
    console.error('[alerts DELETE /alerts/:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// ─── Alert Rules ──────────────────────────────────────────────────────────────
router.get('/alert-rules', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500)
    const offset = Number(req.query.offset) || 0
    const whereClause = eq(alertRules.userId, req.userId!)
    const [rows, [{ total }]] = await Promise.all([
      db.select().from(alertRules)
        .where(whereClause)
        .limit(limit).offset(offset),
      db.select({ total: count() }).from(alertRules).where(whereClause),
    ])
    res.json({ data: rows.map(r => mapOutAlertRule(r as any)), total: Number(total), limit, offset })
  } catch (err) {
    console.error('[alerts GET /alert-rules]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.post('/alert-rules', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    let body: z.infer<typeof AlertRuleCreateSchema>
    try {
      body = AlertRuleCreateSchema.parse(req.body)
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues }); return
      }
      throw err
    }
    const insertValues = mapInAlertRule(body as any)
    const [row] = await db.insert(alertRules).values({ ...insertValues, userId: req.userId! } as any).returning()
    res.status(201).json({ data: mapOutAlertRule(row as any) })
  } catch (err) {
    console.error('[alerts POST /alert-rules]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.patch('/alert-rules/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = (await db.select({ id: alertRules.id }).from(alertRules)
      .where(and(eq(alertRules.id, req.params.id as string), eq(alertRules.userId, req.userId!))).limit(1))[0]
    if (!existing) { res.status(404).json({ error: 'Regla no encontrada' }); return }

    let body: z.infer<typeof AlertRulePatchSchema>
    try {
      body = AlertRulePatchSchema.parse(req.body)
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues }); return
      }
      throw err
    }
    const [updated] = await db.update(alertRules).set(mapInAlertRule(body as any) as any).where(eq(alertRules.id, req.params.id as string)).returning()
    res.json({ data: mapOutAlertRule(updated as any) })
  } catch (err) {
    console.error('[alerts PATCH /alert-rules/:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.delete('/alert-rules/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = (await db.select({ id: alertRules.id }).from(alertRules)
      .where(and(eq(alertRules.id, req.params.id as string), eq(alertRules.userId, req.userId!))).limit(1))[0]
    if (!existing) { res.status(404).json({ error: 'Regla no encontrada' }); return }
    await db.delete(alertRules).where(eq(alertRules.id, req.params.id as string))
    res.json({ ok: true })
  } catch (err) {
    console.error('[alerts DELETE /alert-rules/:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
