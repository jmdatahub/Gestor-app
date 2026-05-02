import dotenv from 'dotenv'
dotenv.config({ override: true })

import path from 'path'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { errorHandler } from './middleware/errorHandler.js'
import {
  apiLimiter,
  mutationLimiter,
  authLimiter,
  passwordLimiter,
  loginBlockMiddleware,
} from './middleware/rateLimiter.js'
import { requestLogger } from './middleware/requestLogger.js'
import { optionalAuth } from './middleware/auth.js'
import { logger } from './lib/logger.js'
import authRoutes from './routes/auth.routes.js'
import movementsRoutes from './routes/movements.routes.js'
import accountsRoutes from './routes/accounts.routes.js'
import categoriesRoutes from './routes/categories.routes.js'
import budgetsRoutes from './routes/budgets.routes.js'
import alertsRoutes from './routes/alerts.routes.js'
import debtsRoutes from './routes/debts.routes.js'
import savingsRoutes from './routes/savings.routes.js'
import investmentsRoutes from './routes/investments.routes.js'
import recurringRoutes from './routes/recurring.routes.js'
import organizationsRoutes from './routes/organizations.routes.js'
import profilesRoutes from './routes/profiles.routes.js'
import paymentMethodsRoutes from './routes/payment-methods.routes.js'
import providersRoutes from './routes/providers.routes.js'
import apiTokensRoutes from './routes/api-tokens.routes.js'
import adminRoutes from './routes/admin.routes.js'
import crmSyncRoutes from './routes/crm-sync.routes.js'
import notifyRoutes from './routes/notify.routes.js'
import telegramRoutes from './routes/telegram.routes.js'
import { setMyCommands } from './services/telegram.service.js'
import { processRecurringRules } from './jobs/recurringProcessor.js'
import { snapshotPreviousMonth } from './jobs/monthlySnapshotProcessor.js'

// ─── Global error handlers ────────────────────────────────────────────────────
// Catch unhandled promise rejections so they don't silently disappear.
process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled promise rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  })
  // Give the logger time to flush, then exit so the process manager restarts.
  setTimeout(() => process.exit(1), 100)
})

// Catch synchronous exceptions that bubble past all handlers.
process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught exception — shutting down', { message: err.message, stack: err.stack })
  setTimeout(() => process.exit(1), 100)
})

const isProduction = process.env.NODE_ENV === 'production'

if (isProduction && !process.env.JWT_SECRET) {
  logger.error('FATAL: JWT_SECRET must be set in production')
  process.exit(1)
}

const app = express()
const PORT = parseInt(process.env.SERVER_PORT || process.env.PORT || '3001')

app.set('trust proxy', 1)

// ─── Request logging + correlation ID ─────────────────────────────────────────
// Must be first so every request is logged, including those rejected by later
// middleware (rate limiter, auth, etc.).
app.use(requestLogger)

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',').map(s => s.trim()).filter(Boolean)

// ─── Core middleware ──────────────────────────────────────────────────────────
app.use(helmet({
  // helmet enables hidePoweredBy, noSniff, referrerPolicy, etc. by default.
  // We only override the options we need to tighten.
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc:      ["'self'"],
      scriptSrc:       ["'self'"],
      styleSrc:        ["'self'", "'unsafe-inline'"],
      imgSrc:          ["'self'", 'data:', 'blob:', 'https:'],
      fontSrc:         ["'self'", 'data:'],
      connectSrc:      ["'self'", 'ws:', 'wss:'],
      // Lock down potentially dangerous capabilities
      objectSrc:       ["'none'"],
      frameAncestors:  ["'none'"],
      baseUri:         ["'self'"],
      formAction:      ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
}))
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true)
    else cb(null, false)
  },
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))

// ─── Security.txt — RFC 9116 ─────────────────────────────────────────────────
// Served from the built static dir in production; this route covers dev mode
// and acts as a fallback so the file is always reachable.
app.get('/.well-known/security.txt', (_req, res) => {
  res.type('text/plain').send([
    'Contact: mailto:Adriansoulia@gmail.com',
    `Expires: ${new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()}`,
    'Preferred-Languages: es, en',
    'Canonical: https://gestor.app/.well-known/security.txt',
    'Policy: https://gestor.app/security-policy',
    '',
  ].join('\n'))
})

// ─── Health ───────────────────────────────────────────────────────────────────
// Mounted at both /api/health (canonical) and /api/v1/health (client alias)
app.get(['/api/health', '/api/v1/health'], async (_req, res) => {
  const mem = process.memoryUsage()
  const uptimeSec = process.uptime()

  let dbStatus: 'ok' | 'error' = 'error'
  let dbLatencyMs: number | null = null
  try {
    const { db } = await import('./db/connection.js')
    const { sql } = await import('drizzle-orm')
    const t0 = Date.now()
    await db.execute(sql`SELECT 1`)
    dbLatencyMs = Date.now() - t0
    dbStatus = 'ok'
  } catch {
    // dbStatus stays 'error'
  }

  const healthy = dbStatus === 'ok'
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version ?? '1.0.0',
    uptime: {
      seconds: Math.floor(uptimeSec),
      human: `${Math.floor(uptimeSec / 3600)}h ${Math.floor((uptimeSec % 3600) / 60)}m ${Math.floor(uptimeSec % 60)}s`,
    },
    db: { status: dbStatus, latencyMs: dbLatencyMs },
    memory: {
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
      rssMb: Math.round(mem.rss / 1024 / 1024),
      externalMb: Math.round(mem.external / 1024 / 1024),
    },
  })
})

// ─── Routes ───────────────────────────────────────────────────────────────────
// Auth routes — password endpoints get the strict limiter first, plus IP-block
// middleware on the login endpoint to stop brute-force attempts.
app.use('/api/auth/forgot-password', passwordLimiter)
app.use('/api/auth/reset-password', passwordLimiter)
app.use('/api/auth/change-password', passwordLimiter)
app.use('/api/auth/login', loginBlockMiddleware)
app.use('/api/auth', authLimiter, optionalAuth, authRoutes)

// All /api/v1/* routes — general rate limit (100 req/min) + mutation limit
// (30 non-GET req/min).  Both limiters are keyed by IP so they work without
// authentication context.
app.use('/api/v1', apiLimiter, mutationLimiter)

app.use('/api/v1/movements', movementsRoutes)
app.use('/api/v1/accounts', accountsRoutes)
app.use('/api/v1/categories', categoriesRoutes)
app.use('/api/v1/budgets', budgetsRoutes)
app.use('/api/v1/alerts', alertsRoutes)
app.use('/api/v1/alert-rules', alertsRoutes)
app.use('/api/v1/debts', debtsRoutes)
app.use('/api/v1/savings-goals', savingsRoutes)
app.use('/api/v1/investments', investmentsRoutes)
app.use('/api/v1/recurring-rules', recurringRoutes)
app.use('/api/v1/pending-movements', recurringRoutes) // TODO: unused, consider removing — client uses /api/v1/movements?status=pending
app.use('/api/v1/organizations', organizationsRoutes)
app.use('/api/v1/profiles', profilesRoutes)
app.use('/api/v1/payment-methods', paymentMethodsRoutes)
app.use('/api/v1/providers', providersRoutes)
app.use('/api/v1/api-tokens', apiTokensRoutes)
app.use('/api/v1/admin', adminRoutes)
app.use('/api/v1/notify', notifyRoutes)
app.use('/api/v1/telegram-webhook', telegramRoutes)
app.use('/api/crm-sync', crmSyncRoutes)

// ─── Static client (production) ──────────────────────────────────────────────
if (isProduction) {
  const clientDir = path.resolve(process.cwd(), 'dist/client')
  app.use(express.static(clientDir, { index: false }))
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next()
    res.sendFile(path.join(clientDir, 'index.html'))
  })
}

// ─── Error handler ────────────────────────────────────────────────────────────
app.use(errorHandler)

app.listen(PORT, () => {
  logger.info(`Gestor API running at http://localhost:${PORT}`, {
    port: PORT,
    env: process.env.NODE_ENV || 'development',
    cors: allowedOrigins.join(', '),
    health: `http://localhost:${PORT}/api/health`,
  })

  // ─── Register Telegram bot commands ─────────────────────────────────────
  setMyCommands().catch(err =>
    logger.error('[telegram] setMyCommands failed', { message: (err as Error).message })
  )

  // ─── Recurring rules processor ────────────────────────────────────────────
  // Run once on startup to catch up on any missed occurrences, then hourly.
  processRecurringRules().catch(err =>
    logger.error('[recurringProcessor] Startup run failed', { message: (err as Error).message })
  )
  setInterval(() => {
    processRecurringRules().catch(err =>
      logger.error('[recurringProcessor] Scheduled run failed', { message: (err as Error).message })
    )
  }, 3_600_000) // every hour

  // ─── Monthly snapshot processor ────────────────────────────────────────────
  // Snapshot previous month on startup (idempotent), then daily at midnight UTC.
  snapshotPreviousMonth().catch(err =>
    logger.error('[monthlySnapshot] Startup run failed', { message: (err as Error).message })
  )
  const _nowMs = Date.now()
  const _nextMidnightMs = new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + 1)
  ).getTime()
  setTimeout(() => {
    snapshotPreviousMonth().catch(err =>
      logger.error('[monthlySnapshot] Midnight run failed', { message: (err as Error).message })
    )
    setInterval(() => {
      snapshotPreviousMonth().catch(err =>
        logger.error('[monthlySnapshot] Daily run failed', { message: (err as Error).message })
      )
    }, 86_400_000) // every 24 hours
  }, _nextMidnightMs - _nowMs)
})
