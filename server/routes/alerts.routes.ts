import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { alerts, alertRules } from '../db/schema.js'
import { and, eq, desc, sql } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { z } from 'zod'

const router = Router()

const AlertCreateSchema = z.object({
  type:    z.string().min(1).max(60),
  title:   z.string().min(1).max(200),
  message: z.string().max(1000).optional().nullable(),
  isRead:  z.boolean().optional().default(false),
}).strict()

const AlertPatchSchema = AlertCreateSchema.partial()

const AlertRuleCreateSchema = z.object({
  name:        z.string().min(1).max(150),
  type:        z.string().min(1).max(60),
  threshold:   z.number().optional().nullable(),
  categoryId:  z.string().uuid().optional().nullable(),
  isActive:    z.boolean().optional().default(true),
  conditions:  z.record(z.unknown()).optional().nullable(),
}).strict()

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
    res.json({ data: rows, total, limit, offset })
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
        res.status(400).json({ error: 'Datos inválidos', details: err.errors }); return
      }
      throw err
    }
    const [row] = await db.insert(alerts).values({ ...body, userId: req.userId! }).returning()
    res.status(201).json({ data: row })
  } catch (err) {
    console.error('[alerts POST /alerts]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.patch('/alerts/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = (await db.select({ id: alerts.id }).from(alerts)
      .where(and(eq(alerts.id, req.params.id), eq(alerts.userId, req.userId!))).limit(1))[0]
    if (!existing) { res.status(404).json({ error: 'Alerta no encontrada' }); return }

    let body: z.infer<typeof AlertPatchSchema>
    try {
      body = AlertPatchSchema.parse(req.body)
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.errors }); return
      }
      throw err
    }
    const [updated] = await db.update(alerts).set(body).where(eq(alerts.id, req.params.id)).returning()
    res.json({ data: updated })
  } catch (err) {
    console.error('[alerts PATCH /alerts/:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.delete('/alerts/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = (await db.select({ id: alerts.id }).from(alerts)
      .where(and(eq(alerts.id, req.params.id), eq(alerts.userId, req.userId!))).limit(1))[0]
    if (!existing) { res.status(404).json({ error: 'Alerta no encontrada' }); return }
    await db.delete(alerts).where(eq(alerts.id, req.params.id))
    res.json({ ok: true })
  } catch (err) {
    console.error('[alerts DELETE /alerts/:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// ─── Alert Rules ──────────────────────────────────────────────────────────────
router.get('/alert-rules', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const rows = await db.select().from(alertRules)
      .where(eq(alertRules.userId, req.userId!))
    res.json({ data: rows })
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
        res.status(400).json({ error: 'Datos inválidos', details: err.errors }); return
      }
      throw err
    }
    const [row] = await db.insert(alertRules).values({ ...body, userId: req.userId! }).returning()
    res.status(201).json({ data: row })
  } catch (err) {
    console.error('[alerts POST /alert-rules]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.patch('/alert-rules/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = (await db.select({ id: alertRules.id }).from(alertRules)
      .where(and(eq(alertRules.id, req.params.id), eq(alertRules.userId, req.userId!))).limit(1))[0]
    if (!existing) { res.status(404).json({ error: 'Regla no encontrada' }); return }

    let body: z.infer<typeof AlertRulePatchSchema>
    try {
      body = AlertRulePatchSchema.parse(req.body)
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.errors }); return
      }
      throw err
    }
    const [updated] = await db.update(alertRules).set(body).where(eq(alertRules.id, req.params.id)).returning()
    res.json({ data: updated })
  } catch (err) {
    console.error('[alerts PATCH /alert-rules/:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.delete('/alert-rules/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = (await db.select({ id: alertRules.id }).from(alertRules)
      .where(and(eq(alertRules.id, req.params.id), eq(alertRules.userId, req.userId!))).limit(1))[0]
    if (!existing) { res.status(404).json({ error: 'Regla no encontrada' }); return }
    await db.delete(alertRules).where(eq(alertRules.id, req.params.id))
    res.json({ ok: true })
  } catch (err) {
    console.error('[alerts DELETE /alert-rules/:id]', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
