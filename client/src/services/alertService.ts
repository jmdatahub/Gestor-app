import { api } from '../lib/apiClient'

export type AlertSeverity = 'info' | 'warning' | 'critical'

export interface Alert {
  id: string; user_id: string; title: string; message: string | null
  severity: AlertSeverity; is_read?: boolean
  snoozed_until?: string | null; created_at: string; rule_id?: string | null
  // Extended fields (optional, used by alert engines)
  type?: string
  action_url?: string | null
  metadata?: Record<string, unknown> | null
}

export async function fetchAlerts(_userId: string): Promise<{ alerts: Alert[]; total: number }> {
  const { data, total } = await api.get<{ data: Alert[]; total: number }>('/api/v1/alerts')
  return { alerts: data, total: total ?? data.length }
}

export async function createAlert(alert: Omit<Alert, 'id' | 'created_at'>): Promise<Alert> {
  const { data } = await api.post<{ data: Alert }>('/api/v1/alerts', alert)
  return data
}

export async function markAlertRead(id: string): Promise<void> {
  await api.patch(`/api/v1/alerts/${id}`, { is_read: true })
}

export async function snoozeAlert(id: string, until: string): Promise<void> {
  await api.patch(`/api/v1/alerts/${id}`, { snoozed_until: until })
}

export async function deleteAlert(id: string): Promise<void> {
  await api.delete(`/api/v1/alerts/${id}`)
}

// ---- Backward-compat aliases & helpers ----
export async function getAlerts(_userId: string): Promise<Alert[]> {
  const { alerts } = await fetchAlerts(_userId)
  return alerts
}
export const markAsRead = markAlertRead

export async function markAllAsRead(_userId: string): Promise<void> {
  await api.patch('/api/v1/alerts/read-all', {})
}

export interface AlertStats {
  total: number; unread: number
  bySeverity: { info: number; warning: number; danger: number; critical?: number }
  thisWeek: number
}

export async function getAlertStats(_userId: string): Promise<AlertStats> {
  const { alerts } = await fetchAlerts(_userId)
  const unread = alerts.filter(a => !a.is_read).length
  const bySeverity = { info: 0, warning: 0, danger: 0, critical: 0 }
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
  let thisWeek = 0
  for (const a of alerts) {
    if (a.severity === 'info') bySeverity.info++
    else if (a.severity === 'warning') bySeverity.warning++
    else if (a.severity === 'critical') { bySeverity.critical++; bySeverity.danger++ }
    if (a.created_at > weekAgo) thisWeek++
  }
  return { total: alerts.length, unread, bySeverity, thisWeek }
}

export function getSeverityColor(severity: AlertSeverity): string {
  switch (severity) {
    case 'critical': return 'var(--danger)'
    case 'warning': return 'var(--warning)'
    default: return 'var(--primary)'
  }
}

export function getSeverityLabel(severity: AlertSeverity | undefined): string {
  switch (severity) {
    case 'critical': return 'Crítico'
    case 'warning': return 'Advertencia'
    default: return 'Informativo'
  }
}

export function getSeverityOrder(severity: AlertSeverity | undefined): number {
  switch (severity) {
    case 'critical': return 0
    case 'warning': return 1
    default: return 2
  }
}

export interface SnoozePreset { label: string; hours: number }

export const SNOOZE_PRESETS: SnoozePreset[] = [
  { label: '1 hora', hours: 1 },
  { label: '4 horas', hours: 4 },
  { label: '24 horas', hours: 24 },
  { label: '3 días', hours: 72 },
  { label: '1 semana', hours: 168 },
]

export function getSnoozeUntil(hours: number): string {
  return new Date(Date.now() + hours * 3600 * 1000).toISOString()
}

export function getAlertIcon(typeOrSeverity: string | undefined): string {
  switch (typeOrSeverity) {
    case 'critical': return '🔴'
    case 'warning': return '🟡'
    default: return '🔵'
  }
}

export function getAlertTypeLabel(typeOrSeverity: string | undefined): string {
  switch (typeOrSeverity) {
    case 'critical': return 'Crítico'
    case 'warning': return 'Advertencia'
    default: return 'Informativo'
  }
}

export async function hasRecentAlert(_userId: string, ruleIdOrType: string, windowHoursOrMs = 3600000): Promise<boolean> {
  const { alerts } = await fetchAlerts(_userId)
  // Heuristic: if number <= 168 treat as hours, else as ms
  const windowMs = windowHoursOrMs <= 168 ? windowHoursOrMs * 3600000 : windowHoursOrMs
  const cutoff = new Date(Date.now() - windowMs).toISOString()
  return alerts.some(a => (a.rule_id === ruleIdOrType || a.type === ruleIdOrType) && a.created_at > cutoff)
}

export async function hasRecentAlertForEntity(
  _userId: string,
  ruleIdOrType: string,
  _entityField: string,
  _entityValue: string,
  windowHoursOrMs = 3600000,
): Promise<boolean> {
  return hasRecentAlert(_userId, ruleIdOrType, windowHoursOrMs)
}
