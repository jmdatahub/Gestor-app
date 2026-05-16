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
// max:            pool size cap — 10 is enough for a single API instance.
// connect_timeout: abort the initial TCP handshake after 10 s so we never
//                  block the startup health-check indefinitely.
// idle_timeout:   return a connection to the pool after 30 s of inactivity.
// max_lifetime:   recycle every connection after 30 min. Long-lived sockets
//                 to a remote VPS go stale (NAT timeouts, firewall idle drops)
//                 and surface as "connection terminated unexpectedly" the
//                 next time we use them. Recycling pre-empts that.
const client = postgres(connectionString, {
  prepare: false,
  max: 10,
  idle_timeout: 30,        // seconds — release idle connections back to pool
  connect_timeout: 10,     // seconds — abort if TCP handshake takes > 10 s
  max_lifetime: 60 * 30,   // seconds — recycle every connection after 30 min

  // ── Per-connection Postgres session parameters ─────────────────────────────
  // These are sent immediately after every new connection is established,
  // before any application query runs.
  connection: {
    // application_name shows up in pg_stat_activity, useful for debugging
    // which side of the deployment is holding a connection.
    application_name: 'gestor-app',
    // Abort any single statement that runs longer than 30 s.
    statement_timeout: 30_000,                    // ms → 30 s
    // Abort a transaction that has been idle (no SQL sent) for > 60 s.
    // Prevents ghost transactions from holding locks indefinitely.
    idle_in_transaction_session_timeout: 60_000,  // ms → 60 s
  },

  // Soft error handler — postgres-js emits these for non-fatal driver issues
  // (e.g. an idle connection was killed by the server). We log and let the
  // pool reconnect on the next use; throwing here would crash the process.
  onnotice: () => {},
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
  // postgres-js exposes the SQLSTATE on err.code for server-sent errors.
  const code = (err as { code?: string }).code?.toLowerCase() ?? ''
  // postgres-js / Node surface these as Error with specific message text.
  return (
    msg.includes('connection') ||      // connection lost / refused
    msg.includes('econnreset') ||
    msg.includes('econnrefused') ||
    msg.includes('etimedout') ||
    msg.includes('enetunreach') ||
    msg.includes('ehostunreach') ||
    msg.includes('socket') ||
    msg.includes('terminated') ||      // server closed connection
    msg.includes('too many clients') ||
    msg.includes('pool') ||
    msg.includes('write conn_ended') ||
    // postgres error codes — match either in the message or on err.code
    msg.includes('57p01') || code === '57p01' ||  // admin shutdown
    msg.includes('57p02') || code === '57p02' ||  // crash shutdown
    msg.includes('57p03') || code === '57p03' ||  // cannot connect now
    code === '08000' || code === '08003' ||       // connection exception / does_not_exist
    code === '08006' || code === '08001' ||       // connection_failure / sqlclient_unable_to_establish
    code === '40001' || code === '40p01'          // serialization / deadlock — safe to retry
  )
}

// ─── Generic retry helper for DB operations ──────────────────────────────────
// Wrap a DB call with retries on transient errors. Use for background jobs
// (recurring processor, snapshot job, etc.) where a single network blip
// shouldn't lose work. *Not* for HTTP request handlers — those should fail
// fast and let the client retry.
export async function withDbRetry<T>(
  operation: () => Promise<T>,
  options: { attempts?: number; baseDelayMs?: number; label?: string } = {},
): Promise<T> {
  const attempts = options.attempts ?? 3
  const baseDelayMs = options.baseDelayMs ?? 250
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation()
    } catch (err) {
      lastError = err
      if (attempt >= attempts || !isTransientDbError(err)) throw err
      // Exponential backoff with full jitter: avoids thundering-herd retries.
      const delay = Math.floor(Math.random() * baseDelayMs * 2 ** (attempt - 1))
      const { logger } = await import('../lib/logger.js')
      logger.warn('[db] Transient error — retrying', {
        label: options.label,
        attempt,
        nextDelayMs: delay,
        error: err instanceof Error ? err.message : String(err),
      })
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  throw lastError
}
