import { api } from '../lib/apiClient'

// ---- Types ----
export type AlertRuleType =
  | 'spending_exceeds'
  | 'balance_below'
  | 'income_below'
  | 'debt_due'
  | 'savings_goal_deadline'
  | 'recurring_unpaid'
  | 'investment_loss'
  // Extended rule types used by alertRuleEngine
  | 'category_exceeds'
  | 'savings_reaches'
  | 'investment_drops'
  | 'debt_due_soon'

export type AlertSeverity = 'info' | 'warning' | 'critical'
export type TriggerMode = 'once' | 'repeat'
export type AlertPeriod = 'current_month' | 'last_7_days' | 'last_30_days' | 'all_time'
export type ComparisonOperator = 'gte' | 'lte' | 'gt' | 'lt' | 'eq'

export interface AlertRuleCondition {
  operator: ComparisonOperator
  value: number
  category_id?: string | null
  account_id?: string | null
  savings_goal_id?: string | null
}

export interface AlertRule {
  id: string; user_id: string; name: string; rule_type?: string; threshold?: number | null
  is_active?: boolean; created_at: string; conditions?: unknown
  // Extended fields used by UI
  type?: AlertRuleType
  condition?: AlertRuleCondition
  severity?: AlertSeverity
  trigger_mode?: TriggerMode
  period?: AlertPeriod
  last_triggered_at?: string | null
}

// ---- Constants ----
export const alertRuleTypes: Array<{
  value: AlertRuleType; label: string; description: string; defaultValue: number; unit?: string
}> = [
  { value: 'spending_exceeds', label: 'Gasto excede', description: 'Alerta cuando el gasto mensual supera un límite', defaultValue: 1000, unit: '€' },
  { value: 'balance_below', label: 'Saldo bajo', description: 'Alerta cuando el saldo de una cuenta es bajo', defaultValue: 500, unit: '€' },
  { value: 'income_below', label: 'Ingreso bajo', description: 'Alerta cuando los ingresos del mes son bajos', defaultValue: 2000, unit: '€' },
  { value: 'debt_due', label: 'Deuda pendiente', description: 'Alerta sobre deudas próximas a vencer', defaultValue: 7, unit: ' días' },
  { value: 'savings_goal_deadline', label: 'Meta de ahorro', description: 'Alerta sobre metas de ahorro próximas', defaultValue: 30, unit: ' días' },
  { value: 'recurring_unpaid', label: 'Recurrente sin pagar', description: 'Alerta sobre pagos recurrentes pendientes', defaultValue: 3, unit: ' días' },
  { value: 'investment_loss', label: 'Pérdida de inversión', description: 'Alerta cuando una inversión pierde valor', defaultValue: 10, unit: '%' },
]

export const severityOptions: Array<{ value: AlertSeverity; label: string; color: string; icon: string }> = [
  { value: 'info', label: 'Informativo', color: 'var(--primary)', icon: 'ℹ️' },
  { value: 'warning', label: 'Advertencia', color: 'var(--warning)', icon: '⚠️' },
  { value: 'critical', label: 'Crítico', color: 'var(--danger)', icon: '🚨' },
]

export const triggerModeOptions: Array<{ value: TriggerMode; label: string; description: string }> = [
  { value: 'once', label: 'Una vez', description: 'Solo alerta la primera vez que se cumple la condición' },
  { value: 'repeat', label: 'Repetir', description: 'Alerta cada vez que se cumple la condición' },
]

export const periodOptions: Array<{ value: AlertPeriod; label: string }> = [
  { value: 'current_month', label: 'Mes actual' },
  { value: 'last_7_days', label: 'Últimos 7 días' },
  { value: 'last_30_days', label: 'Últimos 30 días' },
  { value: 'all_time', label: 'Todo el tiempo' },
]

export function ruleNeedsCategory(type: AlertRuleType): boolean {
  return type === 'spending_exceeds'
}

export function ruleNeedsAccount(type: AlertRuleType): boolean {
  return type === 'balance_below'
}

// ---- CRUD ----
export async function fetchAlertRules(_userId: string): Promise<AlertRule[]> {
  const { data } = await api.get<{ data: AlertRule[] }>('/api/v1/alert-rules')
  return data
}

export async function createAlertRule(rule: Omit<AlertRule, 'id' | 'created_at'>): Promise<AlertRule> {
  const { data } = await api.post<{ data: AlertRule }>('/api/v1/alert-rules', rule)
  return data
}

export async function updateAlertRule(id: string, updates: Partial<AlertRule>): Promise<AlertRule> {
  const { data } = await api.patch<{ data: AlertRule }>(`/api/v1/alert-rules/${id}`, updates)
  return data
}

export async function deleteAlertRule(id: string): Promise<void> {
  await api.delete(`/api/v1/alert-rules/${id}`)
}

// Backward-compat aliases
export const getAlertRules = fetchAlertRules

export async function markRuleTriggered(id: string): Promise<void> {
  await api.patch(`/api/v1/alert-rules/${id}`, { last_triggered_at: new Date().toISOString() })
}

export async function toggleAlertRule(id: string, isActive: boolean): Promise<AlertRule> {
  return updateAlertRule(id, { is_active: isActive })
}

export function getSeverityColor(severity: AlertSeverity | undefined): string {
  switch (severity) {
    case 'critical': return 'var(--danger)'
    case 'warning': return 'var(--warning)'
    default: return 'var(--primary)'
  }
}

export function getRuleDescription(rule: AlertRule): string {
  const typeConf = alertRuleTypes.find(t => t.value === rule.type || t.value === rule.rule_type)
  return typeConf?.description ?? rule.name
}

export function getRuleTypeIcon(ruleType: string | undefined): string {
  switch (ruleType) {
    case 'spending_exceeds': return '💸'
    case 'balance_below': return '🏦'
    case 'income_below': return '📉'
    case 'debt_due': case 'debt_due_soon': return '⏰'
    case 'savings_goal_deadline': case 'savings_reaches': return '🎯'
    case 'recurring_unpaid': return '🔁'
    case 'investment_loss': case 'investment_drops': return '📊'
    default: return '🔔'
  }
}

export function getPeriodLabel(period: AlertPeriod | string | undefined): string {
  return periodOptions.find(p => p.value === period)?.label ?? (period ?? '')
}

export function getTriggerModeLabel(mode: TriggerMode | string | undefined): string {
  return triggerModeOptions.find(t => t.value === mode)?.label ?? (mode ?? '')
}
