import type { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { logger } from '../lib/logger.js'
import { isTransientDbError } from '../db/connection.js'

const isProduction = process.env.NODE_ENV === 'production'

export function errorHandler(err: Error | ZodError, req: Request, res: Response, _next: NextFunction): void {
  const requestId = req.headers['x-request-id'] as string | undefined

  // ── Validation errors ──────────────────────────────────────────────────────
  if (err instanceof ZodError) {
    res.status(422).json({
      error: 'Error de validación',
      errors: err.issues.map(i => ({ field: i.path.join('.'), message: i.message })),
    })
    return
  }

  const message = err.message || 'Error desconocido'

  // ── Database connectivity errors ───────────────────────────────────────────
  // When the database drops mid-request we return 503 (Service Unavailable)
  // instead of 500, so upstreams / load-balancers can distinguish a transient
  // infrastructure failure from a true application bug.  We also log at warn
  // level (not error) to avoid flooding alerting thresholds during a DB blip.
  if (isTransientDbError(err)) {
    logger.warn('[db] Transient database error during request', {
      requestId,
      method: req.method,
      path: req.path,
      error: message,
    })
    res.status(503).json({
      error: 'Servicio temporalmente no disponible — inténtalo de nuevo en unos momentos',
      ...(isProduction ? {} : { message }),
    })
    return
  }

  // ── Generic server errors ──────────────────────────────────────────────────
  // Always log full details server-side (stack helps diagnosis in production too).
  logger.error(message, {
    requestId,
    method: req.method,
    path: req.path,
    // Stack trace is server-side only — never sent to the client
    stack: err.stack,
  })

  res.status(500).json({
    error: 'Error interno del servidor',
    // Expose message only in development; never expose stack to clients
    ...(isProduction ? {} : { message }),
  })
}
