/**
 * Unit tests for server/middleware/auth.ts
 * Tests the authMiddleware and optionalAuth functions in isolation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Response, NextFunction } from 'express'
import type { AuthRequest } from '../middleware/auth.js'
import jwt from 'jsonwebtoken'

// Set JWT_SECRET before importing the middleware
process.env.JWT_SECRET = 'test-middleware-secret'

// Import after env is set
const { authMiddleware, optionalAuth } = await import('../middleware/auth.js')

const SECRET = 'test-middleware-secret'

function makeToken(payload: object, secret = SECRET): string {
  return jwt.sign(payload, secret, { expiresIn: '1h' })
}

function makeRes(): { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> } & Partial<Response> {
  const json = vi.fn()
  const status = vi.fn().mockReturnValue({ json })
  return { status, json } as any
}

describe('authMiddleware', () => {
  it('returns 401 when no Authorization header', () => {
    const req = { headers: {} } as AuthRequest
    const res = makeRes()
    const next = vi.fn()

    authMiddleware(req, res as any, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when header does not start with Bearer', () => {
    const req = { headers: { authorization: 'Basic abc123' } } as AuthRequest
    const res = makeRes()
    const next = vi.fn()

    authMiddleware(req, res as any, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 for an invalid token', () => {
    const req = { headers: { authorization: 'Bearer not.valid.token' } } as AuthRequest
    const res = makeRes()
    const next = vi.fn()

    authMiddleware(req, res as any, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('calls next and sets userId for a valid token', () => {
    const token = makeToken({ sub: 'user-abc', email: 'a@b.com', role: 'member' })
    const req = { headers: { authorization: `Bearer ${token}` } } as AuthRequest
    const res = makeRes()
    const next = vi.fn()

    authMiddleware(req, res as any, next)

    expect(next).toHaveBeenCalledOnce()
    expect(req.userId).toBe('user-abc')
    expect(req.userEmail).toBe('a@b.com')
    expect(req.userRole).toBe('member')
  })

  it('returns 401 for a token signed with the wrong secret', () => {
    const token = makeToken({ sub: 'user-abc', email: 'a@b.com', role: 'member' }, 'wrong-secret')
    const req = { headers: { authorization: `Bearer ${token}` } } as AuthRequest
    const res = makeRes()
    const next = vi.fn()

    authMiddleware(req, res as any, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })
})

describe('optionalAuth', () => {
  it('calls next even with no token', () => {
    const req = { headers: {} } as AuthRequest
    const res = makeRes()
    const next = vi.fn()

    optionalAuth(req, res as any, next)

    expect(next).toHaveBeenCalledOnce()
    expect(req.userId).toBeUndefined()
  })

  it('sets userId when a valid token is provided', () => {
    const token = makeToken({ sub: 'user-xyz', email: 'x@y.com', role: 'admin' })
    const req = { headers: { authorization: `Bearer ${token}` } } as AuthRequest
    const res = makeRes()
    const next = vi.fn()

    optionalAuth(req, res as any, next)

    expect(next).toHaveBeenCalledOnce()
    expect(req.userId).toBe('user-xyz')
    expect(req.userRole).toBe('admin')
  })

  it('calls next without setting userId for invalid token', () => {
    const req = { headers: { authorization: 'Bearer bad-token' } } as AuthRequest
    const res = makeRes()
    const next = vi.fn()

    optionalAuth(req, res as any, next)

    expect(next).toHaveBeenCalledOnce()
    expect(req.userId).toBeUndefined()
  })
})
