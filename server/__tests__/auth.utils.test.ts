/**
 * Tests for authentication utilities:
 * - JWT sign / verify via the auth middleware
 * - bcrypt hashing (that bcrypt is called, not hash value comparison)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'

const TEST_SECRET = 'test-jwt-secret-for-unit-tests'

// ─── JWT helpers (mirror the logic in auth.routes.ts) ────────────────────────

function signToken(
  user: { id: string; email: string; role: string },
  secret: string,
  expiresIn: string = '7d',
): string {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    secret,
    { expiresIn } as Parameters<typeof jwt.sign>[2],
  )
}

function verifyToken(
  token: string,
  secret: string,
): { userId: string; userEmail: string; userRole: string } | null {
  try {
    const decoded = jwt.verify(token, secret) as {
      sub: string
      email: string
      role: string
    }
    if (!decoded.sub) return null
    return {
      userId: decoded.sub,
      userEmail: decoded.email,
      userRole: decoded.role || 'member',
    }
  } catch {
    return null
  }
}

// ─── JWT tests ────────────────────────────────────────────────────────────────

describe('JWT utilities', () => {
  const sampleUser = {
    id: 'user-uuid-123',
    email: 'user@example.com',
    role: 'member',
  }

  it('creates a token that can be decoded', () => {
    const token = signToken(sampleUser, TEST_SECRET)
    expect(typeof token).toBe('string')
    expect(token.split('.').length).toBe(3) // header.payload.signature
  })

  it('verifyToken returns correct user fields', () => {
    const token = signToken(sampleUser, TEST_SECRET)
    const result = verifyToken(token, TEST_SECRET)
    expect(result).not.toBeNull()
    expect(result!.userId).toBe(sampleUser.id)
    expect(result!.userEmail).toBe(sampleUser.email)
    expect(result!.userRole).toBe(sampleUser.role)
  })

  it('verifyToken returns null for an invalid token', () => {
    const result = verifyToken('not.a.real.token', TEST_SECRET)
    expect(result).toBeNull()
  })

  it('verifyToken returns null when signed with a different secret', () => {
    const token = signToken(sampleUser, 'other-secret')
    const result = verifyToken(token, TEST_SECRET)
    expect(result).toBeNull()
  })

  it('verifyToken returns null for an expired token', () => {
    const token = signToken(sampleUser, TEST_SECRET, '-1s') // already expired
    const result = verifyToken(token, TEST_SECRET)
    expect(result).toBeNull()
  })

  it('encodes role as "member" by default when role field present', () => {
    const token = signToken({ id: 'x', email: 'a@b.com', role: 'admin' }, TEST_SECRET)
    const result = verifyToken(token, TEST_SECRET)
    expect(result!.userRole).toBe('admin')
  })
})

// ─── bcrypt tests ─────────────────────────────────────────────────────────────

describe('bcrypt hashing', () => {
  it('bcrypt.hash is called and returns a string starting with $2', async () => {
    const hashSpy = vi.spyOn(bcrypt, 'hash')
    const hash = await bcrypt.hash('myPassword123', 10)
    expect(hashSpy).toHaveBeenCalledOnce()
    expect(typeof hash).toBe('string')
    expect(hash.startsWith('$2')).toBe(true)
    hashSpy.mockRestore()
  })

  it('bcrypt.compare returns true for correct password', async () => {
    const hash = await bcrypt.hash('correctPassword', 10)
    const ok = await bcrypt.compare('correctPassword', hash)
    expect(ok).toBe(true)
  })

  it('bcrypt.compare returns false for wrong password', async () => {
    const hash = await bcrypt.hash('correctPassword', 10)
    const ok = await bcrypt.compare('wrongPassword', hash)
    expect(ok).toBe(false)
  })

  it('two hashes of the same password are different (salted)', async () => {
    const hash1 = await bcrypt.hash('samePassword', 10)
    const hash2 = await bcrypt.hash('samePassword', 10)
    expect(hash1).not.toBe(hash2)
  })
})
