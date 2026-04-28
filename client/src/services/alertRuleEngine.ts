/**
 * alertRuleEngine — evaluates user-defined alert_rules against live data.
 *
 * Each rule type maps to a query + comparison. When the condition is met and
 * the dedup window allows it, a new alert is created.
 */
import { api } from '../lib/apiClient'
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
    const triggerMode = rule.trigger_mode ?? 'repeat'
    if (triggerMode === 'once' && rule.last_triggered_at) return

    // Dedup window: 24h for repeat rules (prevents spam on every page load)
    const dedupHours = triggerMode === 'repeat' ? 24 : 0
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

    const cond = rule.condition
    if (!cond) return
    const triggered = compare(actualValue, cond.operator, cond.value)
    if (!triggered) return

    // Avoid creating duplicate alerts of 'general' type within 24h for the same rule
    if (await hasRecentAlert(userId, 'general', 1)) {
      // Check specifically for this rule via alerts endpoint
      try {
        const { data: recentAlerts } = await api.get<{ data: any[] }>('/api/v1/alerts')
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const alreadyFired = (recentAlerts || []).some(
          (a: any) =>
            a.type === 'general' &&
            a.created_at >= cutoff &&
            (a.metadata as Record<string, unknown>)?.rule_id === rule.id
        )
        if (alreadyFired) return
      } catch {
        // If we can't check, proceed (better to fire than to silently skip)
      }
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

async function getMonthlyExpenses(_userId: string, rule: AlertRule): Promise<number | null> {
  const { start, end } = getPeriodDates(rule.period ?? 'current_month')
  const { data } = await api.get<{ data: any[] }>('/api/v1/movements', {
    startDate: start,
    endDate: end,
    kind: 'expense',
    status: 'confirmed',
    limit: 5000,
  })
  if (!data) return null
  return data.filter((m: any) => m.kind === 'expense' || m.type === 'expense').reduce((s: number, m: any) => s + Number(m.amount), 0)
}

async function getMonthlyIncome(_userId: string, rule: AlertRule): Promise<number | null> {
  const { start, end } = getPeriodDates(rule.period ?? 'current_month')
  const { data } = await api.get<{ data: any[] }>('/api/v1/movements', {
    startDate: start,
    endDate: end,
    kind: 'income',
    status: 'confirmed',
    limit: 5000,
  })
  if (!data) return null
  return data.filter((m: any) => m.kind === 'income' || m.type === 'income').reduce((s: number, m: any) => s + Number(m.amount), 0)
}

async function getAccountBalance(_userId: string, rule: AlertRule): Promise<number | null> {
  const accountId = rule.condition?.account_id
  const { data } = await api.get<{ data: any[] }>('/api/v1/accounts')
  if (!data) return null

  if (!accountId) {
    return data.reduce((s: number, a: any) => s + (Number(a.balance) || 0), 0)
  }

  const account = data.find((a: any) => a.id === accountId)
  return account ? (Number(account.balance) || 0) : null
}

async function getCategoryExpenses(_userId: string, rule: AlertRule): Promise<number | null> {
  const categoryId = rule.condition?.category_id
  if (!categoryId) return null

  const { start, end } = getPeriodDates(rule.period ?? 'current_month')
  const { data } = await api.get<{ data: any[] }>('/api/v1/movements', {
    startDate: start,
    endDate: end,
    kind: 'expense',
    status: 'confirmed',
    limit: 5000,
  })
  if (!data) return null
  return data
    .filter((m: any) => (m.categoryId || m.category_id) === categoryId)
    .reduce((s: number, m: any) => s + Number(m.amount), 0)
}

async function getSavingsProgress(_userId: string, rule: AlertRule): Promise<number | null> {
  const goalId = rule.condition?.savings_goal_id
  const { data } = await api.get<{ data: any[] }>('/api/v1/savings-goals')
  if (!data) return null

  let goals = data.filter((g: any) => !g.is_completed)
  if (goalId) goals = goals.filter((g: any) => g.id === goalId)
  const row = goals[0]
  if (!row || !row.target_amount) return null

  return (row.current_amount / row.target_amount) * 100
}

async function getInvestmentDrop(_userId: string, _rule: AlertRule): Promise<number | null> {
  const { data: investments } = await api.get<{ data: any[] }>('/api/v1/investments')

  if (!investments || investments.length === 0) return null

  // Return the worst drop across all investments (most negative %)
  let worstDrop: number | null = null
  for (const inv of investments) {
    const buyPrice = Number(inv.buyPrice ?? inv.buy_price)
    const currentPrice = Number(inv.currentPrice ?? inv.current_price)
    if (!buyPrice || buyPrice <= 0) continue
    const drop = ((buyPrice - currentPrice) / buyPrice) * 100 // positive = dropped
    if (worstDrop === null || drop > worstDrop) worstDrop = drop
  }
  return worstDrop
}

async function getDaysUntilDebt(_userId: string, _rule: AlertRule): Promise<number | null> {
  const { data: allDebts } = await api.get<{ data: any[] }>('/api/v1/debts')
  const debts = (allDebts || [])
    .filter((d: any) => !d.is_closed && d.due_date != null)
    .sort((a: any, b: any) => (a.due_date || '').localeCompare(b.due_date || ''))
    .slice(0, 1)

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
  const v = rule.condition?.value ?? 0
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
