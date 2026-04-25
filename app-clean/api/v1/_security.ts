import type { VercelResponse } from '@vercel/node'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Standard security headers applied to every API response */
export function applySecurityHeaders(res: VercelResponse): void {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()')
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none'"
  )
}

/** Allowed origin for CORS on internal (frontend-facing) endpoints */
export function getAllowedOrigin(): string {
  const site = process.env.VITE_SITE_URL || process.env.VERCEL_URL
  if (site) return site.startsWith('http') ? site : `https://${site}`
  return '*'
}

/** Returns true when the string is a valid UUID v4 */
export function isValidUUID(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

/** Clamps a string to maxLen chars, returns empty string for non-strings */
export function sanitizeString(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return ''
  return value.slice(0, maxLen)
}

/**
 * Returns a generic error message safe to send to the client.
 * Keeps DB error codes out of API responses in production.
 */
export function safeErrorMessage(code?: string): string {
  if (process.env.NODE_ENV !== 'production') {
    // In development return a hint about the code for debugging
    return code ? `Database error (code: ${code})` : 'Database error'
  }
  return 'An unexpected error occurred. Please try again.'
}
