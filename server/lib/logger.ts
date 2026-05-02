/**
 * Minimal structured logger.
 * Outputs JSON in production, human-readable in development.
 * No external dependencies — works with plain Node.js console.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }

const isProduction = process.env.NODE_ENV === 'production'
const minLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) ?? (isProduction ? 'info' : 'debug')

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[minLevel]
}

function formatDev(level: LogLevel, msg: string, meta?: Record<string, unknown>): string {
  const ts = new Date().toISOString()
  const prefix = { debug: '🔍', info: 'ℹ️ ', warn: '⚠️ ', error: '❌' }[level]
  const metaStr = meta && Object.keys(meta).length ? ' ' + JSON.stringify(meta) : ''
  return `${ts} ${prefix} [${level.toUpperCase()}] ${msg}${metaStr}`
}

function formatProd(level: LogLevel, msg: string, meta?: Record<string, unknown>): string {
  return JSON.stringify({ ts: new Date().toISOString(), level, msg, ...meta })
}

function write(level: LogLevel, msg: string, meta?: Record<string, unknown>): void {
  if (!shouldLog(level)) return
  const line = isProduction ? formatProd(level, msg, meta) : formatDev(level, msg, meta)
  if (level === 'error' || level === 'warn') {
    process.stderr.write(line + '\n')
  } else {
    process.stdout.write(line + '\n')
  }
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => write('debug', msg, meta),
  info:  (msg: string, meta?: Record<string, unknown>) => write('info',  msg, meta),
  warn:  (msg: string, meta?: Record<string, unknown>) => write('warn',  msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => write('error', msg, meta),
}
