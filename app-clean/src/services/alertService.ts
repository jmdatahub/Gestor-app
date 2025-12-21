import { supabase } from '../lib/supabaseClient'

// Types
export interface Alert {
  id: string
  user_id: string
  type: 'spending_limit' | 'rule_pending' | 'savings_goal_progress' | 'investment_drop' | 'debt_due' | 'general'
  title: string
  message: string
  is_read: boolean
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface CreateAlertInput {
  user_id: string
  type: Alert['type']
  title: string
  message: string
  metadata?: Record<string, unknown> | null
}

// Get all alerts for user
export async function getAlerts(userId: string): Promise<Alert[]> {
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching alerts:', error)
    throw error
  }
  return data || []
}

// Get unread count
export async function getUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('alerts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)

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
      is_read: false
    }])
    .select()
    .single()

  if (error) {
    console.error('Error creating alert:', error)
    throw error
  }
  return data
}

// Check if similar alert exists recently (to avoid duplicates)
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
