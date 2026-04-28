import dotenv from 'dotenv'
dotenv.config({ override: true })

import path from 'path'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { errorHandler } from './middleware/errorHandler.js'
import { optionalAuth } from './middleware/auth.js'
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

const isProduction = process.env.NODE_ENV === 'production'

if (isProduction && !process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET must be set in production')
  process.exit(1)
}

const app = express()
const PORT = parseInt(process.env.SERVER_PORT || process.env.PORT || '3001')

app.set('trust proxy', 1)

// ─── Rate limiting ────────────────────────────────────────────────────────────
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false })
const passwordLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false })

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',').map(s => s.trim()).filter(Boolean)

// ─── Core middleware ──────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      fontSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", 'ws:', 'wss:'],
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

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), env: process.env.NODE_ENV || 'development' })
})

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, optionalAuth, authRoutes)
app.use('/api/auth/change-password', passwordLimiter)

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
app.use('/api/v1/pending-movements', recurringRoutes)
app.use('/api/v1/organizations', organizationsRoutes)
app.use('/api/v1/profiles', profilesRoutes)
app.use('/api/v1/payment-methods', paymentMethodsRoutes)
app.use('/api/v1/providers', providersRoutes)
app.use('/api/v1/api-tokens', apiTokensRoutes)

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
  console.log(`\n🚀 Gestor API running at http://localhost:${PORT}`)
  console.log(`📊 Health: http://localhost:${PORT}/api/health`)
  console.log(`🌍 Env: ${process.env.NODE_ENV || 'development'}`)
  console.log(`🛡️  CORS: ${allowedOrigins.join(', ')}`)
})
