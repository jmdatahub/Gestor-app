import { supabase } from '../lib/supabaseClient'
import { createAlert, hasRecentAlert } from './alertService'

// Default spending limit (can be made configurable later)
const DEFAULT_SPENDING_LIMIT = 2000 // €

// Run all checks
export async function runAllChecks(userId: string): Promise<void> {
  try {
    await Promise.all([
      checkSpendingLimit(userId),
      checkPendingRecurringMovements(userId),
      checkSavingsGoalProgress(userId),
      checkInvestmentDrop(userId),
      checkDebtDueSoon(userId)
    ])
  } catch (error) {
    console.error('Error running alert checks:', error)
  }
}

// Check if monthly spending exceeds limit
export async function checkSpendingLimit(userId: string): Promise<void> {
  // Check if we already have a recent alert
  if (await hasRecentAlert(userId, 'spending_limit', 7)) return

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  const { data: movements } = await supabase
    .from('movements')
    .select('amount, type')
    .eq('user_id', userId)
    .eq('status', 'confirmed')
    .eq('type', 'expense')
    .gte('date', startOfMonth)
    .lte('date', endOfMonth)

  if (!movements) return

  const totalExpenses = movements.reduce((sum, m) => sum + m.amount, 0)

  if (totalExpenses > DEFAULT_SPENDING_LIMIT) {
    await createAlert({
      user_id: userId,
      type: 'spending_limit',
      title: 'Gasto elevado este mes',
      message: `Has superado ${DEFAULT_SPENDING_LIMIT}€ en gastos este mes. Total actual: ${totalExpenses.toFixed(2)}€`
    })
  }
}

// Check for pending recurring movements
export async function checkPendingRecurringMovements(userId: string): Promise<void> {
  // Check if we already have a recent alert
  if (await hasRecentAlert(userId, 'rule_pending', 1)) return

  const { count } = await supabase
    .from('movements')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'pending')

  if (count && count > 0) {
    await createAlert({
      user_id: userId,
      type: 'rule_pending',
      title: 'Movimientos pendientes',
      message: `Tienes ${count} movimiento${count > 1 ? 's' : ''} automático${count > 1 ? 's' : ''} que necesita${count > 1 ? 'n' : ''} tu aprobación.`
    })
  }
}

// Check savings goals near completion
export async function checkSavingsGoalProgress(userId: string): Promise<void> {
  // Check if we already have a recent alert
  if (await hasRecentAlert(userId, 'savings_goal_progress', 7)) return

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
      await createAlert({
        user_id: userId,
        type: 'savings_goal_progress',
        title: 'Objetivo casi logrado',
        message: `Tu objetivo "${goal.name}" está al ${progress.toFixed(0)}%. ¡Ya casi lo consigues!`,
        metadata: { goal_id: goal.id }
      })
      // Only create one alert at a time
      break
    }
  }
}

// Check for investment drops
export async function checkInvestmentDrop(userId: string): Promise<void> {
  // Check if we already have a recent alert
  if (await hasRecentAlert(userId, 'investment_drop', 7)) return

  const { data: investments } = await supabase
    .from('investments')
    .select('id, name, buy_price, current_price')
    .eq('user_id', userId)

  if (!investments) return

  for (const inv of investments) {
    const change = inv.buy_price > 0 
      ? ((inv.current_price - inv.buy_price) / inv.buy_price) * 100 
      : 0

    // If dropped more than 10% from buy price
    if (change <= -10) {
      await createAlert({
        user_id: userId,
        type: 'investment_drop',
        title: 'Inversión en descenso',
        message: `"${inv.name}" ha bajado ${Math.abs(change).toFixed(1)}% desde tu precio de compra.`,
        metadata: { investment_id: inv.id }
      })
      // Only create one alert at a time
      break
    }
  }
}

// Check for debts due soon
export async function checkDebtDueSoon(userId: string): Promise<void> {
  // Check if we already have a recent alert
  if (await hasRecentAlert(userId, 'debt_due', 3)) return

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

    if (daysRemaining >= 0 && daysRemaining <= 7) {
      await createAlert({
        user_id: userId,
        type: 'debt_due',
        title: 'Deuda por vencer',
        message: `La deuda con "${debt.counterparty_name}" vence en ${daysRemaining} día${daysRemaining !== 1 ? 's' : ''}.`,
        metadata: { debt_id: debt.id }
      })
      // Only create one alert at a time
      break
    }
  }
}
