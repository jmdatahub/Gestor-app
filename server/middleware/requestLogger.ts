/**
 * Request logging middleware.
 *
 * - Attaches a unique `X-Request-Id` to every request (correlation ID).
 * - Logs method, path, status code, and response time on completion.
 * - Emits a WARN when a request exceeds SLOW_REQUEST_THRESHOLD_MS (default 2000 ms).
 */

import type { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'
import { logger } from '../lib/logger.js'

const SLOW_REQUEST_THRESHOLD_MS = parseInt(process.env.SLOW_REQUEST_THRESHOLD_MS ?? '2000', 10)

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID()
  const start = Date.now()

  // Make the ID available downstream for error handlers / route controllers
  req.headers['x-request-id'] = requestId
  res.setHeader('X-Request-Id', requestId)

  const { method, path: reqPath } = req

  res.on('finish', () => {
    const durationMs = Date.now() - start
    const status = res.statusCode

    const meta: Record<string, unknown> = {
      requestId,
      method,
      path: reqPath,
      status,
      durationMs,
    }

    if (durationMs > SLOW_REQUEST_THRESHOLD_MS) {
      logger.warn(`SLOW REQUEST ${method} ${reqPath} — ${durationMs}ms`, meta)
    } else if (status >= 500) {
      logger.error(`${method} ${reqPath} ${status} (${durationMs}ms)`, meta)
    } else if (status >= 400) {
      logger.warn(`${method} ${reqPath} ${status} (${durationMs}ms)`, meta)
    } else {
      logger.info(`${method} ${reqPath} ${status} (${durationMs}ms)`, meta)
    }
  })

  next()
}
