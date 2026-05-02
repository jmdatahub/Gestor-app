import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schema.js'

// ─── Connection-string validation ────────────────────────────────────────────
// Fail loudly with a clear message rather than a cryptic driver error.
const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required.')
}

// A minimal structural check: must look like postgres[ql]://…
const DB_URL_RE = /^postgre(?:s|sql):\/\/.+/i
if (!DB_URL_RE.test(connectionString)) {
  throw new Error(
    `DATABASE_URL is malformed — expected a postgres:// or postgresql:// URI, got: "${connectionString.slice(0, 40)}…"`
  )
}

// ─── Connection pool ──────────────────────────────────────────────────────────
// max: 10 in all environments — 1 was too small for production.
// connect_timeout: abort the initial TCP handshake after 10 s so we never
//   block the startup health-check indefinitely.
// idle_timeout: return a connection to the pool after 30 s of inactivity
//   (postgres-js option, distinct from the server-side idle-in-transaction
//   timeout set via connection_timeout_params below).
const client = postgres(connectionString, {
  prepare: false,
  max: 10,
  idle_timeout: 30,      // seconds — release idle connections back to pool
  connect_timeout: 10,   // seconds — abort if TCP handshake takes > 10 s

  // ── Per-connection Postgres session parameters ─────────────────────────────
  // These are sent immediately after every new connection is established,
  // before any application query runs.
  connection: {
    // Abort any single statement that runs longer than 30 s.
    statement_timeout: 30_000,                    // ms → 30 s
    // Abort a transaction that has been idle (no SQL sent) for > 60 s.
    // Prevents ghost transactions from holding locks indefinitely.
    idle_in_transaction_session_timeout: 60_000,  // ms → 60 s
  },
})

export const db = drizzle(client, { schema })

// ─── Startup ping with retry ──────────────────────────────────────────────────
// Call this once from server/index.ts before starting to accept requests.
// Retries up to `maxAttempts` times with exponential back-off so that a brief
// database restart during deployment does not abort the whole server start.
export async function checkDatabaseConnection(maxAttempts = 3): Promise<void> {
  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Use the raw client for the ping so we bypass any Drizzle caching.
      await client`SELECT 1`
      return // success
    } catch (err) {
      lastError = err
      if (attempt < maxAttempts) {
        const delayMs = attempt * 1000 // 1 s, 2 s, …
        // We deliberately import logger lazily here to avoid a circular-dep
        // risk (connection.ts ← logger, logger ← connection.ts would be bad).
        const { logger } = await import('../lib/logger.js')
        logger.warn(`[db] Connection attempt ${attempt}/${maxAttempts} failed — retrying in ${delayMs}ms`, {
          error: lastError instanceof Error ? lastError.message : String(lastError),
        })
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }
  }
  throw new Error(
    `[db] Could not connect to the database after ${maxAttempts} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  )
}

// ─── DB error classification ──────────────────────────────────────────────────
// Returns true for transient errors where a single retry is worth attempting
// (lost connection, server restart, pool exhaustion, etc.).
export function isTransientDbError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const msg = err.message.toLowerCase()
  // postgres-js surfaces these as Error with specific message text.
  return (
    msg.includes('connection') ||      // connection lost / refused
    msg.includes('econnreset') ||
    msg.includes('econnrefused') ||
    msg.includes('socket') ||
    msg.includes('terminated') ||      // server closed connection
    msg.includes('too many clients') ||
    msg.includes('pool') ||
    // postgres error codes surfaced in message by postgres-js
    msg.includes('57p01') ||           // admin shutdown
    msg.includes('57p02') ||           // crash shutdown
    msg.includes('57p03')              // cannot connect now
  )
}
