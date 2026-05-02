/**
 * Integration tests for POST /api/auth/register and POST /api/auth/login
 * All DB calls and email/telegram services are mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import type { Application } from 'express'
import bcrypt from 'bcrypt'

// ─── Set env before anything imports JWT_SECRET ──────────────────────────────
process.env.JWT_SECRET = 'test-routes-secret'
process.env.JWT_EXPIRY = '1h'

// ─── Mock the DB module ───────────────────────────────────────────────────────
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
}

vi.mock('../db/connection.js', () => ({ db: mockDb }))

// ─── Mock email + telegram services ──────────────────────────────────────────
vi.mock('../services/email.service.js', () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordChangedEmail: vi.fn().mockResolvedValue(undefined),
  sendNewUserNotificationEmail: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../services/telegram.service.js', () => ({
  sendTelegramMessage: vi.fn().mockResolvedValue(undefined),
  setMyCommands: vi.fn().mockResolvedValue(undefined),
}))

// ─── Import route after mocks are in place ────────────────────────────────────
const authRouter = (await import('../routes/auth.routes.js')).default

function buildApp(): Application {
  const app = express()
  app.use(express.json())
  app.use('/api/auth', authRouter)
  return app
}

// ─── Helper: chain drizzle-style select builder ──────────────────────────────
function chainSelect(rows: object[]) {
  const chain: any = {}
  chain.from = vi.fn().mockReturnValue(chain)
  chain.where = vi.fn().mockReturnValue(chain)
  chain.limit = vi.fn().mockResolvedValue(rows)
  return chain
}

function chainInsert(returning: object[]) {
  const chain: any = {}
  chain.values = vi.fn().mockReturnValue(chain)
  chain.returning = vi.fn().mockResolvedValue(returning)
  chain.onConflictDoNothing = vi.fn().mockResolvedValue(undefined)
  return chain
}

function chainUpdate() {
  const chain: any = {}
  chain.set = vi.fn().mockReturnValue(chain)
  chain.where = vi.fn().mockResolvedValue([])
  return chain
}

// ─── Tests: POST /api/auth/register ──────────────────────────────────────────

describe('POST /api/auth/register', () => {
  let app: Application

  beforeEach(() => {
    vi.clearAllMocks()
    app = buildApp()
  })

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ password: 'password123' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/email/i)
  })

  it('returns 400 when password is shorter than 8 chars', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'user@example.com', password: 'short' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/8/i)
  })

  it('returns 409 when email already exists', async () => {
    // First select (check existing) returns a row
    mockDb.select.mockReturnValueOnce(chainSelect([{ id: 'existing-user' }]))

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'existing@example.com', password: 'password123' })

    expect(res.status).toBe(409)
    expect(res.body.error).toMatch(/ya existe/i)
  })

  it('returns 201 with pending:true for a new valid registration', async () => {
    // select existing → empty (not found)
    mockDb.select
      .mockReturnValueOnce(chainSelect([]))       // check duplicate
      .mockReturnValueOnce(chainSelect([]))       // get admin profile

    const newUser = { id: 'new-user-uuid', email: 'new@example.com', name: 'New User' }
    // insert user
    mockDb.insert.mockReturnValueOnce(chainInsert([newUser]))
    // insert profile (onConflictDoNothing)
    mockDb.insert.mockReturnValueOnce({
      values: vi.fn().mockReturnValue({ onConflictDoNothing: vi.fn().mockResolvedValue(undefined) }),
    })

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'new@example.com', password: 'password123', name: 'New User' })

    expect(res.status).toBe(201)
    expect(res.body.ok).toBe(true)
    expect(res.body.pending).toBe(true)
  })
})

// ─── Tests: POST /api/auth/login ──────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  let app: Application

  beforeEach(() => {
    vi.clearAllMocks()
    app = buildApp()
  })

  it('returns 400 when email or password is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@example.com' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBeTruthy()
  })

  it('returns 401 when user is not found', async () => {
    mockDb.select.mockReturnValueOnce(chainSelect([]))

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'password123' })

    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/credenciales/i)
  })

  it('returns 401 when password is wrong', async () => {
    const realHash = await bcrypt.hash('correctPassword', 10)
    const user = {
      id: 'user-id',
      email: 'user@example.com',
      name: 'User',
      role: 'member',
      avatarUrl: null,
      isActive: true,
      passwordHash: realHash,
    }
    mockDb.select.mockReturnValueOnce(chainSelect([user]))

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: 'wrongPassword' })

    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/credenciales/i)
  })

  it('returns 403 when account is inactive', async () => {
    const realHash = await bcrypt.hash('password123', 10)
    const user = {
      id: 'user-id',
      email: 'user@example.com',
      name: 'User',
      role: 'member',
      avatarUrl: null,
      isActive: false,
      passwordHash: realHash,
    }
    mockDb.select.mockReturnValueOnce(chainSelect([user]))

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: 'password123' })

    expect(res.status).toBe(403)
    expect(res.body.error).toMatch(/desactivada/i)
  })

  it('returns 200 with token and user for correct credentials', async () => {
    const realHash = await bcrypt.hash('password123', 10)
    const user = {
      id: 'user-id-abc',
      email: 'user@example.com',
      name: 'Real User',
      role: 'member',
      avatarUrl: null,
      isActive: true,
      passwordHash: realHash,
    }
    mockDb.select.mockReturnValueOnce(chainSelect([user]))
    mockDb.update.mockReturnValueOnce(chainUpdate())

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: 'password123' })

    expect(res.status).toBe(200)
    expect(res.body.token).toBeTruthy()
    expect(typeof res.body.token).toBe('string')
    expect(res.body.user.id).toBe('user-id-abc')
    expect(res.body.user.email).toBe('user@example.com')
    // password hash must NOT be leaked
    expect(res.body.user.passwordHash).toBeUndefined()
  })
})

// ─── Tests: POST /api/auth/logout ─────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  it('always returns 200 ok (stateless)', async () => {
    const app = buildApp()
    const res = await request(app).post('/api/auth/logout')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})
