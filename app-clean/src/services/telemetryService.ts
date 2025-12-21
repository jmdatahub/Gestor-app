/**
 * Telemetry Service - Registro local de eventos para diagnóstico
 * 
 * Almacena los últimos 50 eventos en localStorage para debug.
 * No envía datos a ningún servidor externo.
 */

const STORAGE_KEY = 'app_telemetry'
const MAX_EVENTS = 50

export interface TelemetryEvent {
  ts: string  // ISO timestamp
  actionName: string
  ok: boolean
  code: string
  durationMs: number
  errorMessage?: string
}

/**
 * Log a telemetry event
 */
export function logEvent(event: Omit<TelemetryEvent, 'ts'>): void {
  try {
    const events = getEvents()
    
    const newEvent: TelemetryEvent = {
      ts: new Date().toISOString(),
      ...event
    }
    
    // Add to beginning (most recent first)
    events.unshift(newEvent)
    
    // Keep only last MAX_EVENTS
    const trimmed = events.slice(0, MAX_EVENTS)
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch (err) {
    // Silently fail - telemetry should never break the app
    console.warn('[Telemetry] Failed to log event:', err)
  }
}

/**
 * Get all logged events
 */
export function getEvents(): TelemetryEvent[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    return JSON.parse(stored) as TelemetryEvent[]
  } catch {
    return []
  }
}

/**
 * Clear all events
 */
export function clearEvents(): void {
  localStorage.removeItem(STORAGE_KEY)
}

/**
 * Get summary stats
 */
export function getStats(): {
  totalEvents: number
  successCount: number
  errorCount: number
  errorRate: string
  avgDurationMs: number
  lastError: TelemetryEvent | null
} {
  const events = getEvents()
  
  if (events.length === 0) {
    return {
      totalEvents: 0,
      successCount: 0,
      errorCount: 0,
      errorRate: '0%',
      avgDurationMs: 0,
      lastError: null
    }
  }
  
  const successCount = events.filter(e => e.ok).length
  const errorCount = events.filter(e => !e.ok).length
  const totalDuration = events.reduce((sum, e) => sum + e.durationMs, 0)
  const lastError = events.find(e => !e.ok) || null
  
  return {
    totalEvents: events.length,
    successCount,
    errorCount,
    errorRate: `${Math.round((errorCount / events.length) * 100)}%`,
    avgDurationMs: Math.round(totalDuration / events.length),
    lastError
  }
}

/**
 * Generate a diagnostic report for support
 */
export function generateReport(): string {
  const stats = getStats()
  const events = getEvents()
  const errors = events.filter(e => !e.ok).slice(0, 10)
  
  const report = {
    generatedAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href,
    stats,
    recentErrors: errors.map(e => ({
      ts: e.ts,
      action: e.actionName,
      code: e.code,
      message: e.errorMessage
    }))
  }
  
  return JSON.stringify(report, null, 2)
}

/**
 * Copy diagnostic report to clipboard
 */
export async function copyReportToClipboard(): Promise<boolean> {
  try {
    const report = generateReport()
    await navigator.clipboard.writeText(report)
    return true
  } catch {
    console.error('[Telemetry] Failed to copy report')
    return false
  }
}
