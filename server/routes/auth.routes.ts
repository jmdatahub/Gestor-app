import { Router } from 'express'
import type { Request, Response } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { db } from '../db/connection.js'
import { users } from '../db/schema.js'
import { eq, sql } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { sendPasswordResetEmail, sendPasswordChangedEmail } from '../services/email.service.js'

const router = Router()

const JWT_SECRET = process.env.JWT_SECRET || ''
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d'

function signToken(user: { id: string; email: string; role: string }): string {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY } as Parameters<typeof jwt.sign>[2],
  )
}

// GET /api/auth/me
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest
  const user = (await db.select({
    id: users.id, email: users.email, name: users.name, role: users.role, avatarUrl: users.avatarUrl,
  }).from(users).where(eq(users.id, authReq.userId!)).limit(1))[0]
  if (!user) { res.status(404).json({ error: 'Usuario no encontrado' }); return }
  res.json({ user })
})

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {}
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    res.status(400).json({ error: 'Email y contraseña requeridos' }); return
  }
  const user = (await db.select().from(users).where(sql`LOWER(${users.email}) = LOWER(${email})`).limit(1))[0]
  if (!user || !user.passwordHash) { res.status(401).json({ error: 'Credenciales inválidas' }); return }
  if (user.isActive === false) { res.status(403).json({ error: 'Cuenta desactivada' }); return }
  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) { res.status(401).json({ error: 'Credenciales inválidas' }); return }
  await db.update(users).set({ lastActiveAt: new Date().toISOString() }).where(eq(users.id, user.id))
  const token = signToken({ id: user.id, email: user.email, role: user.role || 'member' })
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, avatarUrl: user.avatarUrl } })
})

// POST /api/auth/logout (stateless)
router.post('/logout', (_req: Request, res: Response) => {
  res.json({ ok: true })
})

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body ?? {}
  if (typeof email !== 'string' || !email) { res.status(400).json({ error: 'Email requerido' }); return }
  const user = (await db.select().from(users).where(sql`LOWER(${users.email}) = LOWER(${email})`).limit(1))[0]
  if (!user) { res.json({ ok: true }); return }
  const token = crypto.randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString()
  await db.update(users).set({ passwordResetToken: token, passwordResetExpires: expires }).where(eq(users.id, user.id))
  await sendPasswordResetEmail(user.email, user.name || '', token)
  res.json({ ok: true })
})

// POST /api/auth/reset-password
router.post('/reset-password', async (req: Request, res: Response) => {
  const { token, password } = req.body ?? {}
  if (typeof token !== 'string' || typeof password !== 'string' || password.length < 8) {
    res.status(400).json({ error: 'Token y contraseña (mínimo 8 chars) requeridos' }); return
  }
  const user = (await db.select().from(users).where(eq(users.passwordResetToken, token)).limit(1))[0]
  if (!user || !user.passwordResetExpires || new Date(user.passwordResetExpires) < new Date()) {
    res.status(400).json({ error: 'Token inválido o caducado' }); return
  }
  const hash = await bcrypt.hash(password, 10)
  await db.update(users).set({ passwordHash: hash, passwordResetToken: null, passwordResetExpires: null }).where(eq(users.id, user.id))
  await sendPasswordChangedEmail(user.email, user.name || '')
  res.json({ ok: true })
})

// POST /api/auth/change-password
router.post('/change-password', authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest
  const { currentPassword, newPassword } = req.body ?? {}
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || newPassword.length < 8) {
    res.status(400).json({ error: 'Contraseñas requeridas (nueva mínimo 8 chars)' }); return
  }
  const user = (await db.select().from(users).where(eq(users.id, authReq.userId!)).limit(1))[0]
  if (!user || !user.passwordHash) { res.status(404).json({ error: 'Usuario no encontrado' }); return }
  const ok = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!ok) { res.status(401).json({ error: 'Contraseña actual incorrecta' }); return }
  const hash = await bcrypt.hash(newPassword, 10)
  await db.update(users).set({ passwordHash: hash }).where(eq(users.id, user.id))
  await sendPasswordChangedEmail(user.email, user.name || '')
  res.json({ ok: true })
})

export default router
