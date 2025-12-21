import { supabase } from '../lib/supabaseClient'
import { 
  getAccountsWithBalances, 
  getRootAccountId, 
  type AccountWithBalance 
} from './accountService'

// Types
export interface MonthlySummary {
  year: number
  month: number
  income: number
  expenses: number
  net: number
  savingsChange: number
}

export interface CategorySummary {
  categoryId: string
  categoryName: string
  color: string
  total: number
}

export interface NetWorthSummary {
  cashBalance: number
  investmentsValue: number
  debtsPending: number
  netWorth: number
}

// Helper to get date ranges
function getMonthRange(year: number, month: number): { start: string; end: string } {
  const start = new Date(year, month - 1, 1).toISOString().split('T')[0]
  const end = new Date(year, month, 0).toISOString().split('T')[0]
  return { start, end }
}

// Format currency
// Format currency
export function formatCurrency(amount: number, locale: string = 'es-ES'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR'
  }).format(amount)
}

// Get monthly summary (income, expenses, net, savings)
export async function getMonthlySummary(
  userId: string,
  year: number,
  month: number,
  _options: { includeChildrenRollup?: boolean } = {}
): Promise<MonthlySummary> {
  const range = getMonthRange(year, month)
  // Note: includeChildrenRollup is currently unused locally but prepared for future filtering

  // Get movements for this month (excluding transfers)
  const { data: movements } = await supabase
    .from('movements')
    .select('type, amount')
    .eq('user_id', userId)
    .eq('status', 'confirmed')
    .not('type', 'in', '(transfer_in,transfer_out)')
    .gte('date', range.start)
    .lte('date', range.end)

  let income = 0
  let expenses = 0

  for (const m of (movements || [])) {
    if (m.type === 'income') {
      income += m.amount
    } else if (m.type === 'expense') {
      expenses += m.amount
    }
  }

  // Get savings contributions for this month
  const { data: contributions } = await supabase
    .from('savings_goal_contributions')
    .select('amount')
    .eq('user_id', userId)
    .gte('date', range.start)
    .lte('date', range.end)

  const savingsChange = (contributions || []).reduce((sum, c) => sum + c.amount, 0)

  return {
    year,
    month,
    income,
    expenses,
    net: income - expenses,
    savingsChange
  }
}

// Get category breakdown for expenses
export async function getMonthlyCategoryBreakdown(
  userId: string,
  year: number,
  month: number
): Promise<CategorySummary[]> {
  const range = getMonthRange(year, month)

  // Get expense movements with categories
  const { data: movements } = await supabase
    .from('movements')
    .select('category, amount')
    .eq('user_id', userId)
    .eq('status', 'confirmed')
    .eq('type', 'expense')
    .gte('date', range.start)
    .lte('date', range.end)

  // Aggregate by category
  const categoryTotals: Record<string, number> = {}
  for (const m of (movements || [])) {
    const cat = m.category || 'Sin categoría'
    categoryTotals[cat] = (categoryTotals[cat] || 0) + m.amount
  }

  // Convert to array and sort
  const result: CategorySummary[] = Object.entries(categoryTotals)
    .map(([name, total], index) => ({
      categoryId: name,
      categoryName: name,
      color: getCategoryColor(index),
      total
    }))
    .sort((a, b) => b.total - a.total)

  return result
}

// Get net worth summary
export async function getNetWorthSummary(
  userId: string,
  _atDate: Date = new Date()
): Promise<NetWorthSummary> {
  // Get all movements for balance calculation (including transfers)
  const { data: movements } = await supabase
    .from('movements')
    .select('type, amount')
    .eq('user_id', userId)
    .eq('status', 'confirmed')

  let cashBalance = 0
  for (const m of (movements || [])) {
    if (m.type === 'income' || m.type === 'transfer_in') {
      cashBalance += m.amount
    } else if (m.type === 'expense' || m.type === 'transfer_out' || m.type === 'investment') {
      cashBalance -= m.amount
    }
  }

  // Get investments value
  const { data: investments } = await supabase
    .from('investments')
    .select('quantity, current_price')
    .eq('user_id', userId)

  const investmentsValue = (investments || []).reduce(
    (sum, inv) => sum + (inv.quantity * inv.current_price),
    0
  )

  // Get pending debts
  const { data: debts } = await supabase
    .from('debts')
    .select('remaining_amount')
    .eq('user_id', userId)
    .eq('is_closed', false)

  const debtsPending = (debts || []).reduce(
    (sum, d) => sum + (d.remaining_amount || 0),
    0
  )

  return {
    cashBalance,
    investmentsValue,
    debtsPending,
    netWorth: cashBalance + investmentsValue - debtsPending
  }
}

// Get balance history for last N months
export async function getBalanceHistory(
  userId: string,
  monthsBack: number
): Promise<MonthlySummary[]> {
  const results: MonthlySummary[] = []
  const now = new Date()

  for (let i = monthsBack - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const year = date.getFullYear()
    const month = date.getMonth() + 1

    const summary = await getMonthlySummary(userId, year, month)
    results.push(summary)
  }

  return results
}

// Category colors palette
const categoryColors = [
  '#6366f1', // indigo
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ef4444', // red
  '#8b5cf6', // purple
  '#06b6d4', // cyan
  '#f97316', // orange
  '#ec4899', // pink
  '#84cc16', // lime
  '#64748b', // slate
]

function getCategoryColor(index: number): string {
  return categoryColors[index % categoryColors.length]
}

// Get month name in Spanish
// Get month name
export function getMonthName(month: number, locale: string = 'es-ES'): string {
  const date = new Date(2000, month - 1, 1)
  return date.toLocaleString(locale, { month: 'long' })
    .replace(/^\w/, c => c.toUpperCase()) // Capitalize first letter
}

// Get account balances with optional roll-up logic
export async function getAccountBalancesSummary(
  userId: string,
  options: { includeChildrenRollup?: boolean } = {}
): Promise<AccountWithBalance[]> {
  // 1. Get raw accounts with balances
  const accounts = await getAccountsWithBalances(userId)

  // 2. If no roll-up, return as is
  if (!options.includeChildrenRollup) {
    return accounts
  }

  // 3. Roll-up logic: Aggregate children into roots
  const accountMap = new Map<string, AccountWithBalance>()
  accounts.forEach(a => accountMap.set(a.id, { ...a }))

  const rootMap = new Map<string, AccountWithBalance>()

  // Identify roots and accumulate balances
  for (const acc of accounts) {
    const rootId = getRootAccountId(accounts, acc.id)
    
    // Ensure root exists in our rootMap
    if (!rootMap.has(rootId)) {
      if (accountMap.has(rootId)) {
        // Clone root and reset balance to 0 (we will sum all descendants INCLUDING the root itself)
        // Wait, if we use getRootAccountId, 'acc' could BE the root.
        // If we reset to 0, we must ensure we add the root's own balance when we iterate over it.
        // The iteration covers all accounts, so when we encounter the root in the loop, we add its balance.
        // So yes, initializing to 0 is correct.
        rootMap.set(rootId, { ...accountMap.get(rootId)!, balance: 0 }) 
      }
    }

    if (rootMap.has(rootId)) {
       const root = rootMap.get(rootId)!
       root.balance += acc.balance
    }
  }

  // Return only the roots
  return Array.from(rootMap.values()).sort((a, b) => a.name.localeCompare(b.name))
}
