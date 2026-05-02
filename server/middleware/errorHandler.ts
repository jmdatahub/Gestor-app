import type { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { logger } from '../lib/logger.js'

const isProduction = process.env.NODE_ENV === 'production'

export function errorHandler(err: Error | ZodError, req: Request, res: Response, _next: NextFunction): void {
  const requestId = req.headers['x-request-id'] as string | undefined

  if (err instanceof ZodError) {
    res.status(422).json({
      error: 'Error de validación',
      errors: err.issues.map(i => ({ field: i.path.join('.'), message: i.message })),
    })
    return
  }

  const message = err.message || 'Error desconocido'

  // Always log full details server-side (stack helps diagnosis in production too)
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
