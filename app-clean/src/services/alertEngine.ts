import { supabase } from '../lib/supabaseClient'
import { createAlert, hasRecentAlert, hasRecentAlertForEntity } from './alertService'
import type { Alert } from './alertService'

// Sends a Telegram notification for an alert without throwing on failure
async function notifyTelegram(type: Alert['type'], title: string, message: string): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return

    await fetch('/api/v1/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ type, title, message })
    })
  } catch {
    // Notification failures are silent — they must never break the alert system
  }
}

// Run all automatic checks
export async function runAllChecks(userId: string): Promise<void> {
  try {
    await Promise.all([
      checkSpendingLimit(userId),
      checkPendingRecurringMovements(userId),
      checkSavingsGoalProgress(userId),
      checkInvestmentDrop(userId),
      checkDebtDueSoon(userId),
    ])
  } catch (error) {
    console.error('Error running alert checks:', error)
  }
}

// Check if monthly spending exceeds limit
export async function checkSpendingLimit(userId: string): Promise<void> {
  if (await hasRecentAlert(userId, 'spending_limit', 7)) return

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  const { data: movements } = await supabase
    .from('movements')
    .select('amount')
    .eq('user_id', userId)
    .eq('status', 'confirmed')
    .eq('type', 'expense')
    .gte('date', startOfMonth)
    .lte('date', endOfMonth)

  if (!movements) return

  const totalExpenses = movements.reduce((sum, m) => sum + m.amount, 0)

  // Use a configurable limit stored in the user profile, fallback to 2000
  const { data: profile } = await supabase
    .from('profiles')
    .select('spending_limit')
    .eq('id', userId)
    .single()

  const limit: number = (profile as { spending_limit?: number } | null)?.spending_limit ?? 2000

  if (totalExpenses > limit) {
    const pct = Math.round((totalExpenses / limit) * 100)
    const title = 'Límite de gasto superado'
    const message = `Has gastado ${totalExpenses.toFixed(0)}€ este mes (${pct}% de tu límite de ${limit}€).`
    await createAlert({
      user_id: userId,
      type: 'spending_limit',
      title,
      message,
      severity: pct >= 150 ? 'danger' : 'warning',
      action_url: '/app/analisis/movimientos',
    })
    await notifyTelegram('spending_limit', title, message)
  }
}

// Check for pending recurring movements
export async function checkPendingRecurringMovements(userId: string): Promise<void> {
  if (await hasRecentAlert(userId, 'rule_pending', 1)) return

  const { count } = await supabase
    .from('movements')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'pending')

  if (count && count > 0) {
    const title = `${count} movimiento${count > 1 ? 's' : ''} pendiente${count > 1 ? 's' : ''}`
    const message = `Tienes ${count} movimiento${count > 1 ? 's' : ''} automático${count > 1 ? 's' : ''} que necesita${count > 1 ? 'n' : ''} tu aprobación.`
    await createAlert({
      user_id: userId,
      type: 'rule_pending',
      title,
      message,
      severity: 'info',
      action_url: '/app/movimientos/pendientes',
    })
    await notifyTelegram('rule_pending', title, message)
  }
}

// Check savings goals near completion (per goal, not global)
export async function checkSavingsGoalProgress(userId: string): Promise<void> {
  const { data: goals } = await supabase
    .from('savings_goals')
    .select('*')
    .eq('user_id', userId)
    .eq('is_completed', false)

  if (!goals) return

  for (const goal of goals) {
    const progress = goal.target_amount > 0
      ? (goal.current_amount / goal.target_amount) * 100
      : 0

    if (progress >= 90 && progress < 100) {
      const alreadyAlerted = await hasRecentAlertForEntity(
        userId, 'savings_goal_progress', 'goal_id', goal.id, 7
      )
      if (alreadyAlerted) continue

      const title = '¡Objetivo casi logrado!'
      const message = `"${goal.name}" está al ${progress.toFixed(0)}% — solo te faltan ${(goal.target_amount - goal.current_amount).toFixed(0)}€.`
      await createAlert({
        user_id: userId,
        type: 'savings_goal_progress',
        title,
        message,
        severity: 'info',
        action_url: `/app/patrimonio/ahorros`,
        metadata: { goal_id: goal.id },
      })
      await notifyTelegram('savings_goal_progress', title, message)
    } else if (progress >= 100) {
      const alreadyAlerted = await hasRecentAlertForEntity(
        userId, 'savings_goal_progress', 'goal_id', goal.id, 30
      )
      if (alreadyAlerted) continue

      const title = '🎉 ¡Objetivo alcanzado!'
      const message = `Has completado el objetivo "${goal.name}". ¡Enhorabuena!`
      await createAlert({
        user_id: userId,
        type: 'savings_goal_progress',
        title,
        message,
        severity: 'info',
        action_url: `/app/patrimonio/ahorros`,
        metadata: { goal_id: goal.id },
      })
      await notifyTelegram('savings_goal_progress', title, message)
    }
  }
}

// Check for investment drops (per investment)
export async function checkInvestmentDrop(userId: string): Promise<void> {
  const { data: investments } = await supabase
    .from('investments')
    .select('id, name, buy_price, current_price')
    .eq('user_id', userId)

  if (!investments) return

  for (const inv of investments) {
    if (!inv.buy_price || inv.buy_price <= 0) continue

    const change = ((inv.current_price - inv.buy_price) / inv.buy_price) * 100

    if (change <= -10) {
      const alreadyAlerted = await hasRecentAlertForEntity(
        userId, 'investment_drop', 'investment_id', inv.id, 7
      )
      if (alreadyAlerted) continue

      const title = 'Inversión en descenso'
      const message = `"${inv.name}" ha bajado ${Math.abs(change).toFixed(1)}% desde tu precio de compra (${inv.buy_price}€ → ${inv.current_price}€).`
      await createAlert({
        user_id: userId,
        type: 'investment_drop',
        title,
        message,
        severity: change <= -25 ? 'danger' : 'warning',
        action_url: `/app/patrimonio/inversiones`,
        metadata: { investment_id: inv.id },
      })
      await notifyTelegram('investment_drop', title, message)
    }
  }
}

// Check for debts due soon (per debt)
export async function checkDebtDueSoon(userId: string): Promise<void> {
  const now = new Date()
  const in7Days = new Date()
  in7Days.setDate(now.getDate() + 7)

  const { data: debts } = await supabase
    .from('debts')
    .select('*')
    .eq('user_id', userId)
    .eq('is_closed', false)
    .not('due_date', 'is', null)
    .lte('due_date', in7Days.toISOString().split('T')[0])

  if (!debts || debts.length === 0) return

  for (const debt of debts) {
    const daysRemaining = Math.ceil(
      (new Date(debt.due_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    )

    if (daysRemaining < 0 || daysRemaining > 7) continue

    const alreadyAlerted = await hasRecentAlertForEntity(
      userId, 'debt_due', 'debt_id', debt.id, 3
    )
    if (alreadyAlerted) continue

    const title = daysRemaining === 0 ? 'Deuda vence hoy' : `Deuda vence en ${daysRemaining} día${daysRemaining !== 1 ? 's' : ''}`
    const message = `La deuda con "${debt.counterparty_name}" de ${debt.amount}€ vence ${daysRemaining === 0 ? 'hoy' : `en ${daysRemaining} día${daysRemaining !== 1 ? 's' : ''}`}.`
    await createAlert({
      user_id: userId,
      type: 'debt_due',
      title,
      message,
      severity: daysRemaining <= 1 ? 'danger' : 'warning',
      action_url: `/app/patrimonio/deudas`,
      metadata: { debt_id: debt.id },
    })
    await notifyTelegram('debt_due', title, message)
  }
}
