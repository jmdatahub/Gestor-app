export interface TelemetryEvent {
  actionName: string; ok: boolean; code: string; durationMs: number; errorMessage?: string
}

export interface TelemetryStats {
  total: number; ok: number; failed: number; avgDurationMs: number
  // Compat aliases
  totalEvents?: number; successCount?: number; errorCount?: number
}

const MAX_EVENTS = 500
const STORAGE_KEY = 'telemetry_events'

export function getEvents(): TelemetryEvent[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

export function logEvent(event: TelemetryEvent) {
  try {
    const events = getEvents()
    events.push(event)
    if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
  } catch { /* storage full, ignore */ }
}

export function getRecentEvents(n = 50): TelemetryEvent[] {
  return getEvents().slice(-n)
}

export function clearEvents() { localStorage.removeItem(STORAGE_KEY) }

export function getStats(): TelemetryStats {
  const events = getEvents()
  const ok = events.filter(e => e.ok).length
  const failed = events.length - ok
  const avgDurationMs = events.length
    ? Math.round(events.reduce((s, e) => s + e.durationMs, 0) / events.length)
    : 0
  return { total: events.length, ok, failed, avgDurationMs, totalEvents: events.length, successCount: ok, errorCount: failed }
}

export async function copyReportToClipboard(): Promise<boolean> {
  try {
    const report = JSON.stringify({ stats: getStats(), events: getRecentEvents(50) }, null, 2)
    await navigator.clipboard.writeText(report)
    return true
  } catch { return false }
}
