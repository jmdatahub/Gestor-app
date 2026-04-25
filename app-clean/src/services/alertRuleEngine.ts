/**
 * alertRuleEngine — evaluates user-defined alert_rules against live data.
 *
 * Each rule type maps to a query + comparison. When the condition is met and
 * the dedup window allows it, a new alert is created.
 */
import { supabase } from '../lib/supabaseClient'
import { createAlert, hasRecentAlert } from './alertService'
import {
  getAlertRules,
  markRuleTriggered,
  type AlertRule,
  type ComparisonOperator,
} from './alertRuleService'

// Entry point: evaluate all active rules for a user
export async function evaluateAlertRules(userId: string): Promise<void> {
  try {
    const rules = await getAlertRules(userId)
    const active = rules.filter(r => r.is_active)
    await Promise.all(active.map(rule => evaluateRule(userId, rule)))
  } catch (error) {
    console.error('[alertRuleEngine] Error evaluating rules:', error)
  }
}

async function evaluateRule(userId: string, rule: AlertRule): Promise<void> {
  try {
    // Respect trigger_mode=once: skip if already triggered at least once
    if (rule.trigger_mode === 'once' && rule.last_triggered_at) return

    // Dedup window: 24h for repeat rules (prevents spam on every page load)
    const dedupHours = rule.trigger_mode === 'repeat' ? 24 : 0
    if (dedupHours > 0) {
      const dedupDate = new Date()
      dedupDate.setHours(dedupDate.getHours() - dedupHours)
      if (rule.last_triggered_at && new Date(rule.last_triggered_at) > dedupDate) return
    }

    let actualValue: number | null = null

    switch (rule.type) {
      case 'spending_exceeds':
        actualValue = await getMonthlyExpenses(userId, rule)
        break
      case 'income_below':
        actualValue = await getMonthlyIncome(userId, rule)
        break
      case 'balance_below':
        actualValue = await getAccountBalance(userId, rule)
        break
      case 'category_exceeds':
        actualValue = await getCategoryExpenses(userId, rule)
        break
      case 'savings_reaches':
        actualValue = await getSavingsProgress(userId, rule)
        break
      case 'investment_drops':
        actualValue = await getInvestmentDrop(userId, rule)
        break
      case 'debt_due_soon':
        actualValue = await getDaysUntilDebt(userId, rule)
        break
    }

    if (actualValue === null) return

    const triggered = compare(actualValue, rule.condition.operator, rule.condition.value)
    if (!triggered) return

    // Avoid creating duplicate alerts of 'general' type within 24h for the same rule
    const recentKey = `rule_${rule.id}`
    if (await hasRecentAlert(userId, 'general', 1)) {
      // Check specifically for this rule in metadata
      const { data } = await supabase
        .from('alerts')
        .select('id, metadata')
        .eq('user_id', userId)
        .eq('type', 'general')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      const alreadyFired = (data || []).some(
        a => (a.metadata as Record<string, unknown>)?.rule_id === rule.id
      )
      if (alreadyFired) return
    }

    await createAlert({
      user_id: userId,
      type: 'general',
      title: rule.name,
      message: buildRuleMessage(rule, actualValue),
      severity: rule.severity || 'info',
      metadata: { rule_id: rule.id, actual_value: actualValue },
    })

    await markRuleTriggered(rule.id)
  } catch (err) {
    console.error(`[alertRuleEngine] Error evaluating rule ${rule.id}:`, err)
  }
}

// ─── Data fetchers ────────────────────────────────────────────────────────────

async function getMonthlyExpenses(userId: string, rule: AlertRule): Promise<number | null> {
  const { start, end } = getPeriodDates(rule.period)
  const { data } = await supabase
    .from('movements')
    .select('amount')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .eq('status', 'confirmed')
    .gte('date', start)
    .lte('date', end)

  return data ? data.reduce((s, m) => s + m.amount, 0) : null
}

async function getMonthlyIncome(userId: string, rule: AlertRule): Promise<number | null> {
  const { start, end } = getPeriodDates(rule.period)
  const { data } = await supabase
    .from('movements')
    .select('amount')
    .eq('user_id', userId)
    .eq('type', 'income')
    .eq('status', 'confirmed')
    .gte('date', start)
    .lte('date', end)

  return data ? data.reduce((s, m) => s + m.amount, 0) : null
}

async function getAccountBalance(userId: string, rule: AlertRule): Promise<number | null> {
  const accountId = rule.condition.account_id
  if (!accountId) {
    // Sum all accounts
    const { data } = await supabase
      .from('accounts')
      .select('balance')
      .eq('user_id', userId)
    return data ? data.reduce((s, a) => s + (a.balance || 0), 0) : null
  }

  const { data } = await supabase
    .from('accounts')
    .select('balance')
    .eq('id', accountId)
    .single()

  return data ? (data.balance || 0) : null
}

async function getCategoryExpenses(userId: string, rule: AlertRule): Promise<number | null> {
  const categoryId = rule.condition.category_id
  if (!categoryId) return null

  const { start, end } = getPeriodDates(rule.period)
  const { data } = await supabase
    .from('movements')
    .select('amount')
    .eq('user_id', userId)
    .eq('category_id', categoryId)
    .eq('type', 'expense')
    .eq('status', 'confirmed')
    .gte('date', start)
    .lte('date', end)

  return data ? data.reduce((s, m) => s + m.amount, 0) : null
}

async function getSavingsProgress(userId: string, rule: AlertRule): Promise<number | null> {
  const goalId = rule.condition.savings_goal_id
  let query = supabase
    .from('savings_goals')
    .select('current_amount, target_amount')
    .eq('user_id', userId)
    .eq('is_completed', false)

  if (goalId) query = query.eq('id', goalId)

  const { data } = await query.limit(1).single()
  if (!data || !data.target_amount) return null

  return (data.current_amount / data.target_amount) * 100
}

async function getInvestmentDrop(userId: string, rule: AlertRule): Promise<number | null> {
  const { data: investments } = await supabase
    .from('investments')
    .select('buy_price, current_price')
    .eq('user_id', userId)

  if (!investments || investments.length === 0) return null

  // Return the worst drop across all investments (most negative %)
  let worstDrop: number | null = null
  for (const inv of investments) {
    if (!inv.buy_price || inv.buy_price <= 0) continue
    const drop = ((inv.buy_price - inv.current_price) / inv.buy_price) * 100 // positive = dropped
    if (worstDrop === null || drop > worstDrop) worstDrop = drop
  }
  return worstDrop
}

async function getDaysUntilDebt(userId: string, rule: AlertRule): Promise<number | null> {
  const { data: debts } = await supabase
    .from('debts')
    .select('due_date')
    .eq('user_id', userId)
    .eq('is_closed', false)
    .not('due_date', 'is', null)
    .order('due_date', { ascending: true })
    .limit(1)

  if (!debts || debts.length === 0) return null

  const daysUntil = Math.ceil(
    (new Date(debts[0].due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )
  return daysUntil >= 0 ? daysUntil : null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function compare(actual: number, op: ComparisonOperator, threshold: number): boolean {
  switch (op) {
    case 'gt': return actual > threshold
    case 'gte': return actual >= threshold
    case 'lt': return actual < threshold
    case 'lte': return actual <= threshold
    case 'eq': return actual === threshold
  }
}

function getPeriodDates(period: string): { start: string; end: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()

  if (period === 'previous_month') {
    const first = new Date(y, m - 1, 1)
    const last = new Date(y, m, 0)
    return {
      start: first.toISOString().split('T')[0],
      end: last.toISOString().split('T')[0],
    }
  }

  if (period === 'accumulated') {
    return { start: '2000-01-01', end: now.toISOString().split('T')[0] }
  }

  // current_month (default)
  return {
    start: new Date(y, m, 1).toISOString().split('T')[0],
    end: new Date(y, m + 1, 0).toISOString().split('T')[0],
  }
}

function buildRuleMessage(rule: AlertRule, actualValue: number): string {
  const v = rule.condition.value
  const actual = Math.round(actualValue * 100) / 100

  switch (rule.type) {
    case 'spending_exceeds':
      return `Tus gastos del período alcanzan ${actual}€, superando el límite de ${v}€.`
    case 'income_below':
      return `Tus ingresos del período son ${actual}€, por debajo del mínimo de ${v}€.`
    case 'balance_below':
      return `El balance de tu cuenta es ${actual}€, inferior al mínimo de ${v}€.`
    case 'category_exceeds':
      return `El gasto en esta categoría es ${actual}€, superando el límite de ${v}€.`
    case 'savings_reaches':
      return `Tu ahorro ha alcanzado el ${actual.toFixed(0)}% del objetivo (umbral: ${v}%).`
    case 'investment_drops':
      return `Una inversión ha caído un ${actual.toFixed(1)}%, superando el umbral del ${v}%.`
    case 'debt_due_soon':
      return `Tienes una deuda que vence en ${actual} día${actual !== 1 ? 's' : ''} (umbral: ${v} días).`
    default:
      return `Valor actual: ${actual} (umbral: ${v}).`
  }
}
