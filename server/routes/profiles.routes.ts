import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { profiles, users } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'

const router = Router()

// GET /api/v1/profiles/me
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  const row = (await db.select().from(profiles).where(eq(profiles.id, req.userId!)).limit(1))[0]
  res.json({ data: row || null })
})

router.patch('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  const existing = (await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.id, req.userId!)).limit(1))[0]
  if (!existing) {
    const [row] = await db.insert(profiles).values({ ...req.body, id: req.userId! }).returning()
    res.json({ data: row }); return
  }
  const [updated] = await db.update(profiles).set(req.body).where(eq(profiles.id, req.userId!)).returning()
  res.json({ data: updated })
})

// GET /api/v1/profiles — admin: list all (for AdminPanel)
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const rows = await db.select().from(profiles)
  res.json({ data: rows })
})

// GET /api/v1/profiles/:id
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const row = (await db.select().from(profiles).where(eq(profiles.id, req.params.id)).limit(1))[0]
  if (!row) { res.status(404).json({ error: 'Perfil no encontrado' }); return }
  res.json({ data: row })
})

export default router
