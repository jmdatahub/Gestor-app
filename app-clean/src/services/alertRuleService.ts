import { supabase } from '../lib/supabaseClient'

// ==============================================
// TYPES
// ==============================================
export type AlertRuleType = 
  | 'spending_exceeds'      // Gastos del mes superan X
  | 'income_below'          // Ingresos del mes por debajo de X
  | 'balance_below'         // Balance por debajo de X
  | 'category_exceeds'      // Gasto en categoría supera X
  | 'savings_reaches'       // Ahorro alcanza X% del objetivo
  | 'investment_drops'      // Inversión baja X%
  | 'debt_due_soon'         // Deuda vence en X días

export type ComparisonOperator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq'

export type AlertSeverity = 'info' | 'warning' | 'danger'

export type TriggerMode = 'once' | 'repeat'

export type AlertPeriod = 'current_month' | 'previous_month' | 'accumulated' | 'custom'

export interface AlertRuleCondition {
  operator: ComparisonOperator
  value: number
  category_id?: string  // For category-specific rules
  account_id?: string   // For account-specific rules
  savings_goal_id?: string // For savings goal rules
}

export interface AlertRule {
  id: string
  user_id: string
  name: string
  type: AlertRuleType
  condition: AlertRuleCondition
  severity: AlertSeverity
  trigger_mode: TriggerMode
  period: AlertPeriod
  trigger_percentage?: number | null
  description?: string | null
  is_active: boolean
  last_triggered_at: string | null
  created_at: string
}

export interface CreateAlertRuleInput {
  user_id: string
  name: string
  type: AlertRuleType
  condition: AlertRuleCondition
  severity?: AlertSeverity
  trigger_mode?: TriggerMode
  period?: AlertPeriod
  trigger_percentage?: number | null
  description?: string | null
  is_active?: boolean
}

// ==============================================
// CRUD OPERATIONS
// ==============================================

export async function getAlertRules(userId: string): Promise<AlertRule[]> {
  const { data, error } = await supabase
    .from('alert_rules')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching alert rules:', error)
    throw error
  }
  return data || []
}

export async function createAlertRule(input: CreateAlertRuleInput): Promise<AlertRule> {
  // Build insert object - only include fields that exist
  // This makes it backwards compatible with tables that don't have new columns yet
  const insertData: Record<string, unknown> = {
    user_id: input.user_id,
    name: input.name,
    type: input.type,
    condition: input.condition,
    is_active: input.is_active ?? true,
  }

  // Add optional new fields only if provided
  if (input.severity) insertData.severity = input.severity
  if (input.trigger_mode) insertData.trigger_mode = input.trigger_mode
  if (input.period) insertData.period = input.period
  if (input.trigger_percentage !== undefined) insertData.trigger_percentage = input.trigger_percentage
  if (input.description) insertData.description = input.description

  console.log('[AlertRuleService] Creating rule with data:', insertData)

  const { data, error } = await supabase
    .from('alert_rules')
    .insert([insertData])
    .select()
    .single()

  if (error) {
    console.error('[AlertRuleService] Error creating alert rule:', error)
    // If error mentions unknown column, try with basic fields only
    if (error.message?.includes('column') || error.code === '42703') {
      console.log('[AlertRuleService] Retrying with basic fields only...')
      const basicInsert = {
        user_id: input.user_id,
        name: input.name,
        type: input.type,
        condition: input.condition,
        is_active: input.is_active ?? true,
      }
      const { data: retryData, error: retryError } = await supabase
        .from('alert_rules')
        .insert([basicInsert])
        .select()
        .single()
      
      if (retryError) {
        console.error('[AlertRuleService] Retry also failed:', retryError)
        throw retryError
      }
      return retryData as AlertRule
    }
    throw error
  }
  return data as AlertRule
}

export async function updateAlertRule(
  ruleId: string, 
  updates: Partial<Pick<AlertRule, 'name' | 'condition' | 'is_active'>>
): Promise<void> {
  const { error } = await supabase
    .from('alert_rules')
    .update(updates)
    .eq('id', ruleId)

  if (error) {
    console.error('Error updating alert rule:', error)
    throw error
  }
}

export async function toggleAlertRule(ruleId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('alert_rules')
    .update({ is_active: isActive })
    .eq('id', ruleId)

  if (error) {
    console.error('Error toggling alert rule:', error)
    throw error
  }
}

export async function deleteAlertRule(ruleId: string): Promise<void> {
  const { error } = await supabase
    .from('alert_rules')
    .delete()
    .eq('id', ruleId)

  if (error) {
    console.error('Error deleting alert rule:', error)
    throw error
  }
}

export async function markRuleTriggered(ruleId: string): Promise<void> {
  const { error } = await supabase
    .from('alert_rules')
    .update({ last_triggered_at: new Date().toISOString() })
    .eq('id', ruleId)

  if (error) {
    console.error('Error marking rule triggered:', error)
  }
}

// ==============================================
// LABELS AND HELPERS
// ==============================================

export function getRuleTypeLabel(type: AlertRuleType): string {
  switch (type) {
    case 'spending_exceeds': return 'Gastos superan'
    case 'income_below': return 'Ingresos por debajo de'
    case 'balance_below': return 'Balance por debajo de'
    case 'category_exceeds': return 'Categoría supera'
    case 'savings_reaches': return 'Ahorro alcanza'
    case 'investment_drops': return 'Inversión baja'
    case 'debt_due_soon': return 'Deuda vence en'
    default: return type
  }
}

export function getRuleTypeIcon(type: AlertRuleType): string {
  switch (type) {
    case 'spending_exceeds': return '💸'
    case 'income_below': return '📉'
    case 'balance_below': return '⚠️'
    case 'category_exceeds': return '📊'
    case 'savings_reaches': return '🎯'
    case 'investment_drops': return '📈'
    case 'debt_due_soon': return '📅'
    default: return '🔔'
  }
}

export function getOperatorLabel(op: ComparisonOperator): string {
  switch (op) {
    case 'gt': return 'mayor que'
    case 'gte': return 'mayor o igual a'
    case 'lt': return 'menor que'
    case 'lte': return 'menor o igual a'
    case 'eq': return 'igual a'
    default: return op
  }
}

export function getRuleDescription(rule: AlertRule): string {
  const { type, condition } = rule
  const value = condition.value
  
  switch (type) {
    case 'spending_exceeds':
      return `Cuando los gastos del mes superen ${value}€`
    case 'income_below':
      return `Cuando los ingresos del mes sean menores a ${value}€`
    case 'balance_below':
      return `Cuando el balance sea menor a ${value}€`
    case 'category_exceeds':
      return `Cuando el gasto en la categoría supere ${value}€`
    case 'savings_reaches':
      return `Cuando el ahorro alcance el ${value}% del objetivo`
    case 'investment_drops':
      return `Cuando una inversión baje más del ${value}%`
    case 'debt_due_soon':
      return `Cuando una deuda venza en los próximos ${value} días`
    default:
      return `Condición: ${getOperatorLabel(condition.operator)} ${value}`
  }
}

// ==============================================
// RULE TYPE OPTIONS
// ==============================================
export const alertRuleTypes: { value: AlertRuleType; label: string; unit: string; defaultValue: number }[] = [
  { value: 'spending_exceeds', label: 'Gastos superan', unit: '€', defaultValue: 1000 },
  { value: 'income_below', label: 'Ingresos por debajo de', unit: '€', defaultValue: 500 },
  { value: 'balance_below', label: 'Balance por debajo de', unit: '€', defaultValue: 100 },
  { value: 'category_exceeds', label: 'Categoría supera', unit: '€', defaultValue: 200 },
  { value: 'savings_reaches', label: 'Ahorro alcanza', unit: '%', defaultValue: 50 },
  { value: 'investment_drops', label: 'Inversión baja', unit: '%', defaultValue: 10 },
  { value: 'debt_due_soon', label: 'Deuda vence en', unit: 'días', defaultValue: 7 },
]

// ==============================================
// SEVERITY OPTIONS
// ==============================================
export const severityOptions: { value: AlertSeverity; label: string; color: string; icon: string }[] = [
  { value: 'info', label: 'Información', color: '#3b82f6', icon: 'ℹ️' },
  { value: 'warning', label: 'Advertencia', color: '#f59e0b', icon: '⚠️' },
  { value: 'danger', label: 'Crítico', color: '#ef4444', icon: '🚨' },
]

export function getSeverityLabel(severity: AlertSeverity): string {
  const option = severityOptions.find(o => o.value === severity)
  return option?.label ?? severity
}

export function getSeverityColor(severity: AlertSeverity): string {
  const option = severityOptions.find(o => o.value === severity)
  return option?.color ?? '#6b7280'
}

// ==============================================
// TRIGGER MODE OPTIONS
// ==============================================
export const triggerModeOptions: { value: TriggerMode; label: string; description: string }[] = [
  { value: 'once', label: 'Una vez', description: 'Se dispara solo la primera vez que se cumple' },
  { value: 'repeat', label: 'Repetir', description: 'Se dispara cada vez que se cumple' },
]

export function getTriggerModeLabel(mode: TriggerMode): string {
  const option = triggerModeOptions.find(o => o.value === mode)
  return option?.label ?? mode
}

// ==============================================
// PERIOD OPTIONS
// ==============================================
export const periodOptions: { value: AlertPeriod; label: string }[] = [
  { value: 'current_month', label: 'Mes actual' },
  { value: 'previous_month', label: 'Mes anterior' },
  { value: 'accumulated', label: 'Acumulado total' },
]

export function getPeriodLabel(period: AlertPeriod): string {
  const option = periodOptions.find(o => o.value === period)
  return option?.label ?? period
}

// ==============================================
// RULE NEEDS CONTEXT
// ==============================================
export function ruleNeedsCategory(type: AlertRuleType): boolean {
  return type === 'category_exceeds'
}

export function ruleNeedsAccount(type: AlertRuleType): boolean {
  return type === 'balance_below'
}

export function ruleNeedsSavingsGoal(type: AlertRuleType): boolean {
  return type === 'savings_reaches'
}

