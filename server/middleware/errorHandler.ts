import type { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'

export function errorHandler(err: Error | ZodError, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(422).json({
      error: 'Error de validación',
      errors: err.issues.map(i => ({ field: i.path.join('.'), message: i.message })),
    })
    return
  }

  const message = err.message || 'Error desconocido'
  console.error('❌', message, err.stack)

  res.status(500).json({
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? message : undefined,
  })
}
