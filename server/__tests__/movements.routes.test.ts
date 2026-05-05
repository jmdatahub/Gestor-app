/**
 * Integration tests for GET /api/v1/movements
 * Requires valid JWT auth. All DB calls are mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import type { Application } from 'express'
import jwt from 'jsonwebtoken'

// ─── Set env ──────────────────────────────────────────────────────────────────
process.env.JWT_SECRET = 'test-movements-secret'

// ─── Mock DB ──────────────────────────────────────────────────────────────────
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
}

vi.mock('../db/connection.js', () => ({ db: mockDb }))

// ─── Import routes after mocks ────────────────────────────────────────────────
const movementsRouter = (await import('../routes/movements.routes.js')).default

function buildApp(): Application {
  const app = express()
  app.use(express.json())
  app.use('/api/v1/movements', movementsRouter)
  return app
}

function makeToken(userId = 'user-abc', role = 'member'): string {
  return jwt.sign(
    { sub: userId, email: 'user@example.com', role },
    'test-movements-secret',
    { expiresIn: '1h' },
  )
}

// ─── Drizzle chain helpers ────────────────────────────────────────────────────
// The GET handler uses .leftJoin twice (accounts + categories) for enriched
// rows; mirror that here so the awaited terminal (.offset) returns the rows.
function chainSelect(rows: object[]) {
  const chain: any = {}
  chain.from = vi.fn().mockReturnValue(chain)
  chain.leftJoin = vi.fn().mockReturnValue(chain)
  chain.where = vi.fn().mockReturnValue(chain)
  chain.orderBy = vi.fn().mockReturnValue(chain)
  chain.limit = vi.fn().mockReturnValue(chain)
  chain.offset = vi.fn().mockResolvedValue(rows)
  return chain
}

// The list endpoint runs two queries in Promise.all: the enriched rows and
// the count(). Build a paired mock that returns rows for the first call and
// the count for the second.
function chainCount(total: number) {
  const chain: any = {}
  chain.from = vi.fn().mockReturnValue(chain)
  chain.where = vi.fn().mockResolvedValue([{ total }])
  return chain
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/v1/movements', () => {
  let app: Application

  beforeEach(() => {
    vi.clearAllMocks()
    app = buildApp()
  })

  it('returns 401 when no Authorization header', async () => {
    const res = await request(app).get('/api/v1/movements')
    expect(res.status).toBe(401)
    expect(res.body.error).toBeTruthy()
  })

  it('returns 401 for an invalid token', async () => {
    const res = await request(app)
      .get('/api/v1/movements')
      .set('Authorization', 'Bearer not-valid-at-all')
    expect(res.status).toBe(401)
  })

  it('returns 200 with data array for a valid token', async () => {
    const rows = [
      {
        id: 'mov-1',
        userId: 'user-abc',
        date: '2025-01-15',
        kind: 'expense',
        amount: '50.00',
        description: 'Coffee',
        accountId: 'acc-1',
        categoryId: null,
        organizationId: null,
        isBusiness: false,
        taxRate: null,
        createdAt: '2025-01-15T10:00:00Z',
        deletedAt: null,
        status: 'confirmed',
      },
    ]
    mockDb.select.mockReturnValueOnce(chainSelect(rows))
    mockDb.select.mockReturnValueOnce(chainCount(rows.length))

    const res = await request(app)
      .get('/api/v1/movements')
      .set('Authorization', `Bearer ${makeToken()}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].id).toBe('mov-1')
    expect(res.body.limit).toBe(50)
    expect(res.body.offset).toBe(0)
  })

  it('returns empty array when no movements found', async () => {
    mockDb.select.mockReturnValueOnce(chainSelect([]))
    mockDb.select.mockReturnValueOnce(chainCount(0))

    const res = await request(app)
      .get('/api/v1/movements')
      .set('Authorization', `Bearer ${makeToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
  })

  it('respects the limit query param (capped at 500)', async () => {
    mockDb.select.mockReturnValueOnce(chainSelect([]))
    mockDb.select.mockReturnValueOnce(chainCount(0))

    const res = await request(app)
      .get('/api/v1/movements?limit=10&offset=5')
      .set('Authorization', `Bearer ${makeToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.limit).toBe(10)
    expect(res.body.offset).toBe(5)
  })

  it('returns 500 when the DB throws', async () => {
    const badChain: any = {
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockRejectedValue(new Error('DB down')),
    }
    mockDb.select.mockReturnValueOnce(badChain)

    const res = await request(app)
      .get('/api/v1/movements')
      .set('Authorization', `Bearer ${makeToken()}`)

    expect(res.status).toBe(500)
    expect(res.body.error).toMatch(/interno/i)
  })
})

// ─── Tests: mapOut helper (tested via the API response) ──────────────────────

describe('movements mapOut field aliases', () => {
  let app: Application

  beforeEach(() => {
    vi.clearAllMocks()
    app = buildApp()
  })

  it('exposes snake_case aliases alongside camelCase fields', async () => {
    const rows = [
      {
        id: 'mov-2',
        userId: 'user-abc',
        accountId: 'acc-2',
        categoryId: 'cat-1',
        organizationId: 'org-1',
        isBusiness: true,
        taxRate: '0.21',
        createdAt: '2025-01-01T00:00:00Z',
        deletedAt: null,
        date: '2025-01-01',
        kind: 'income',
        amount: '100.00',
        status: 'confirmed',
        description: null,
      },
    ]
    mockDb.select.mockReturnValueOnce(chainSelect(rows))
    mockDb.select.mockReturnValueOnce(chainCount(rows.length))

    const res = await request(app)
      .get('/api/v1/movements')
      .set('Authorization', `Bearer ${makeToken()}`)

    const item = res.body.data[0]
    // snake_case aliases must be present
    expect(item.user_id).toBe('user-abc')
    expect(item.account_id).toBe('acc-2')
    expect(item.category_id).toBe('cat-1')
    expect(item.organization_id).toBe('org-1')
    expect(item.is_business).toBe(true)
    expect(item.created_at).toBe('2025-01-01T00:00:00Z')
  })
})
