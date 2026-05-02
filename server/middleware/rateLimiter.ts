/**
 * Centralised rate-limiting configuration.
 *
 * Limiters (applied in server/index.ts):
 *  - apiLimiter        → all /api/v1/* routes:   100 req / 1 min / IP
 *  - mutationLimiter   → POST/PATCH/PUT/DELETE on /api/v1/*: 30 req / 1 min / IP
 *  - authLimiter       → /api/auth/* general:    100 req / 15 min / IP
 *  - passwordLimiter   → forgot/reset/change:     10 req / 60 min / IP
 *
 * IP-based brute-force protection:
 *  - loginFailureTracker  → tracks failed logins in-memory; blocks IP after
 *    MAX_LOGIN_FAILURES consecutive failures within FAILURE_WINDOW_MS.
 *    Automatically expires entries to avoid unbounded memory growth.
 */

import rateLimit from 'express-rate-limit'
import type { Request, Response, NextFunction } from 'express'
import { logger } from '../lib/logger.js'

// ─── Standard API limiter ────────────────────────────────────────────────────
/** 100 requests per minute per IP — applied to all authenticated API routes */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones, inténtalo más tarde' },
})

// ─── Mutation limiter ────────────────────────────────────────────────────────
/** 30 mutations (POST/PATCH/PUT/DELETE) per minute per IP */
export const mutationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS',
  message: { error: 'Demasiadas modificaciones, inténtalo más tarde' },
})

// ─── Auth limiter ─────────────────────────────────────────────────────────────
/** 100 requests per 15-minute window per IP — general auth routes */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de autenticación, inténtalo más tarde' },
})

// ─── Password-reset limiter ───────────────────────────────────────────────────
/** 10 requests per hour per IP — forgot-password, reset-password, change-password */
export const passwordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos, inténtalo en una hora' },
})

// ─── IP-based login-failure tracker ─────────────────────────────────────────
const MAX_LOGIN_FAILURES = 10        // failures before temp-block
const FAILURE_WINDOW_MS  = 15 * 60 * 1000  // 15-minute rolling window
const BLOCK_DURATION_MS  = 30 * 60 * 1000  // 30-minute block after threshold

interface FailureEntry {
  count:     number
  firstSeen: number
  blockedAt: number | null
}

const failureMap = new Map<string, FailureEntry>()

// Sweep stale entries every 5 minutes to bound memory usage
setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of failureMap) {
    const expiry = entry.blockedAt
      ? entry.blockedAt + BLOCK_DURATION_MS
      : entry.firstSeen + FAILURE_WINDOW_MS
    if (now > expiry) failureMap.delete(ip)
  }
}, 5 * 60 * 1000)

/** Call after a failed login attempt. Returns true if the IP is now blocked. */
export function recordLoginFailure(ip: string): boolean {
  const now = Date.now()
  let entry = failureMap.get(ip)

  if (!entry || now - entry.firstSeen > FAILURE_WINDOW_MS) {
    // Reset window
    entry = { count: 1, firstSeen: now, blockedAt: null }
  } else {
    entry.count += 1
  }

  if (entry.count >= MAX_LOGIN_FAILURES && !entry.blockedAt) {
    entry.blockedAt = now
    logger.warn(`[security] Login IP blocked after ${MAX_LOGIN_FAILURES} failures`, { ip })
  }

  failureMap.set(ip, entry)
  return entry.blockedAt !== null && now - entry.blockedAt < BLOCK_DURATION_MS
}

/** Call after a successful login to clear failure history for this IP. */
export function clearLoginFailures(ip: string): void {
  failureMap.delete(ip)
}

/** Express middleware — rejects requests from temporarily-blocked IPs. */
export function loginBlockMiddleware(req: Request, res: Response, next: NextFunction): void {
  const ip = (req.ip ?? req.socket.remoteAddress ?? 'unknown').replace(/^::ffff:/, '')
  const entry = failureMap.get(ip)
  if (
    entry?.blockedAt != null &&
    Date.now() - entry.blockedAt < BLOCK_DURATION_MS
  ) {
    const retryAfter = Math.ceil((BLOCK_DURATION_MS - (Date.now() - entry.blockedAt)) / 1000)
    res.set('Retry-After', String(retryAfter))
    res.status(429).json({
      error: 'Demasiados intentos fallidos. Inténtalo más tarde.',
      retryAfterSeconds: retryAfter,
    })
    return
  }
  next()
}
