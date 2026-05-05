import type { Request, Response, NextFunction, RequestHandler } from 'express'

/**
 * Validates that a route parameter looks like a UUID (v1-v5).
 * If not, returns 400 instead of letting Postgres throw `invalid input syntax for type uuid`
 * (which currently surfaces as a 500 to the client).
 *
 * Usage:
 *   router.get('/:id', validateUuid('id'), authMiddleware, handler)
 *   router.delete('/:id/members/:userId', validateUuid('id', 'userId'), ...)
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function validateUuid(...paramNames: string[]): RequestHandler {
  // Default to validating `id` if no param names are provided
  const names = paramNames.length > 0 ? paramNames : ['id']
  return function validateUuidMiddleware(req: Request, res: Response, next: NextFunction): void {
    for (const name of names) {
      const value = (req.params as Record<string, unknown>)[name]
      if (typeof value !== 'string' || !UUID_RE.test(value)) {
        res.status(400).json({ error: `Parámetro '${name}' inválido (se esperaba UUID)` })
        return
      }
    }
    next()
  }
}

export default validateUuid
