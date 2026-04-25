import { supabase } from '../lib/supabaseClient'

// Types
export type AlertSeverity = 'info' | 'warning' | 'danger'

export interface Alert {
  id: string
  user_id: string
  type: 'spending_limit' | 'rule_pending' | 'savings_goal_progress' | 'investment_drop' | 'debt_due' | 'general'
  title: string
  message: string
  is_read: boolean
  severity: AlertSeverity
  snoozed_until: string | null
  action_url: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface CreateAlertInput {
  user_id: string
  type: Alert['type']
  title: string
  message: string
  severity?: AlertSeverity
  action_url?: string | null
  metadata?: Record<string, unknown> | null
}

// Get all alerts for user (excluding currently snoozed)
export async function getAlerts(userId: string): Promise<Alert[]> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('user_id', userId)
    .or(`snoozed_until.is.null,snoozed_until.lte.${now}`)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching alerts:', error)
    throw error
  }
  return data || []
}

// Get unread count (excluding snoozed)
export async function getUnreadCount(userId: string): Promise<number> {
  const now = new Date().toISOString()
  const { count, error } = await supabase
    .from('alerts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)
    .or(`snoozed_until.is.null,snoozed_until.lte.${now}`)

  if (error) {
    console.error('Error counting unread alerts:', error)
    return 0
  }
  return count || 0
}

// Create alert
export async function createAlert(input: CreateAlertInput): Promise<Alert> {
  const { data, error } = await supabase
    .from('alerts')
    .insert([{
      ...input,
      is_read: false,
      severity: input.severity ?? 'info',
    }])
    .select()
    .single()

  if (error) {
    console.error('Error creating alert:', error)
    throw error
  }
  return data
}

// Check if similar alert exists recently (deduplication)
export async function hasRecentAlert(
  userId: string,
  type: string,
  daysBack: number = 3
): Promise<boolean> {
  const date = new Date()
  date.setDate(date.getDate() - daysBack)

  const { data, error } = await supabase
    .from('alerts')
    .select('id')
    .eq('user_id', userId)
    .eq('type', type)
    .gte('created_at', date.toISOString())
    .limit(1)

  if (error) {
    console.error('Error checking recent alerts:', error)
    return false
  }
  return (data?.length || 0) > 0
}

// Check if similar alert for a specific entity exists recently
export async function hasRecentAlertForEntity(
  userId: string,
  type: string,
  entityKey: string,
  entityId: string,
  daysBack: number = 3
): Promise<boolean> {
  const date = new Date()
  date.setDate(date.getDate() - daysBack)

  const { data, error } = await supabase
    .from('alerts')
    .select('id, metadata')
    .eq('user_id', userId)
    .eq('type', type)
    .gte('created_at', date.toISOString())

  if (error) return false

  return (data || []).some(
    (a) => (a.metadata as Record<string, unknown>)?.[entityKey] === entityId
  )
}

// Mark as read
export async function markAsRead(alertId: string): Promise<void> {
  const { error } = await supabase
    .from('alerts')
    .update({ is_read: true })
    .eq('id', alertId)

  if (error) {
    console.error('Error marking alert as read:', error)
    throw error
  }
}

// Mark all as read
export async function markAllAsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('alerts')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false)

  if (error) {
    console.error('Error marking all alerts as read:', error)
    throw error
  }
}

// Snooze an alert until a future datetime
export async function snoozeAlert(alertId: string, until: Date): Promise<void> {
  const { error } = await supabase
    .from('alerts')
    .update({ snoozed_until: until.toISOString() })
    .eq('id', alertId)

  if (error) {
    console.error('Error snoozing alert:', error)
    throw error
  }
}

// Remove snooze (wake up alert immediately)
export async function unsnoozeAlert(alertId: string): Promise<void> {
  const { error } = await supabase
    .from('alerts')
    .update({ snoozed_until: null })
    .eq('id', alertId)

  if (error) {
    console.error('Error unsnoozing alert:', error)
    throw error
  }
}

// Delete alert
export async function deleteAlert(alertId: string): Promise<void> {
  const { error } = await supabase
    .from('alerts')
    .delete()
    .eq('id', alertId)

  if (error) {
    console.error('Error deleting alert:', error)
    throw error
  }
}

// Get alert statistics for a user
export async function getAlertStats(userId: string): Promise<{
  total: number
  unread: number
  bySeverity: { info: number; warning: number; danger: number }
  thisWeek: number
}> {
  const now = new Date().toISOString()
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data } = await supabase
    .from('alerts')
    .select('severity, is_read, created_at, snoozed_until')
    .eq('user_id', userId)
    .or(`snoozed_until.is.null,snoozed_until.lte.${now}`)

  const alerts = data || []
  return {
    total: alerts.length,
    unread: alerts.filter(a => !a.is_read).length,
    bySeverity: {
      info: alerts.filter(a => a.severity === 'info').length,
      warning: alerts.filter(a => a.severity === 'warning').length,
      danger: alerts.filter(a => a.severity === 'danger').length,
    },
    thisWeek: alerts.filter(a => a.created_at >= weekAgo).length,
  }
}

// Alert type icons (for UI)
export function getAlertIcon(type: Alert['type']): string {
  switch (type) {
    case 'spending_limit': return '💸'
    case 'rule_pending': return '⏳'
    case 'savings_goal_progress': return '🎯'
    case 'investment_drop': return '📉'
    case 'debt_due': return '⚠️'
    default: return '🔔'
  }
}

// Alert type labels
export function getAlertTypeLabel(type: Alert['type']): string {
  switch (type) {
    case 'spending_limit': return 'Gasto'
    case 'rule_pending': return 'Pendiente'
    case 'savings_goal_progress': return 'Ahorro'
    case 'investment_drop': return 'Inversión'
    case 'debt_due': return 'Deuda'
    default: return 'General'
  }
}

// Severity helpers
export function getSeverityColor(severity: AlertSeverity): string {
  switch (severity) {
    case 'danger': return '#ef4444'
    case 'warning': return '#f59e0b'
    case 'info': return '#3b82f6'
  }
}

export function getSeverityLabel(severity: AlertSeverity): string {
  switch (severity) {
    case 'danger': return 'Crítico'
    case 'warning': return 'Advertencia'
    case 'info': return 'Información'
  }
}

export function getSeverityOrder(severity: AlertSeverity): number {
  switch (severity) {
    case 'danger': return 0
    case 'warning': return 1
    case 'info': return 2
  }
}

// Snooze duration presets
export const SNOOZE_PRESETS = [
  { label: '1 hora', hours: 1 },
  { label: '8 horas', hours: 8 },
  { label: '1 día', hours: 24 },
  { label: '3 días', hours: 72 },
  { label: '1 semana', hours: 168 },
] as const

export function getSnoozeUntil(hours: number): Date {
  const d = new Date()
  d.setTime(d.getTime() + hours * 60 * 60 * 1000)
  return d
}
