import { supabase } from '../lib/supabaseClient'
import { 
  getAccountsWithBalances, 
  getRootAccountId, 
  type AccountWithBalance 
} from './accountService'
import { getUserInvestments, calculateTotals } from './investmentService'

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
    .select('kind, amount')
    .eq('user_id', userId)
    .not('kind', 'in', '(transfer_in,transfer_out)')
    .gte('date', range.start)
    .lte('date', range.end)

  let income = 0
  let expenses = 0

  for (const m of (movements || [])) {
    if (m.kind === 'income') {
      income += m.amount
    } else if (m.kind === 'expense') {
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
    .select('category:categories(name), amount')
    .eq('user_id', userId)
    .eq('kind', 'expense')
    .gte('date', range.start)
    .lte('date', range.end)

  // Aggregate by category
  const categoryTotals: Record<string, number> = {}
  for (const m of (movements || [])) {
    // @ts-ignore
    const cat = m.category?.name || 'Sin categoría'
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
    .select('kind, amount')
    .eq('user_id', userId)

  let cashBalance = 0
  for (const m of (movements || [])) {
    if (m.kind === 'income' || m.kind === 'transfer_in') {
      cashBalance += m.amount
    } else if (m.kind === 'expense' || m.kind === 'transfer_out' || m.kind === 'investment') {
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

// Financial Distribution for Dashboard
export interface FinancialDistribution {
  totalAssets: number
  liquidity: number
  savings: number
  investments: number
  distribution: { name: string; value: number; color: string }[]
}

export async function getFinancialDistribution(userId: string): Promise<FinancialDistribution> {
  // 1. Get Accounts with Balances
  const accounts = await getAccountsWithBalances(userId)

  // 2. Get Investments Value
  const userInvestments = await getUserInvestments(userId)
  const invTotals = calculateTotals(userInvestments)
  const investmentsAssetsValue = invTotals.totalValue

  // Group Investments by Type
  const investmentSubItems: { [key: string]: number } = {}
  userInvestments.forEach(inv => {
     const t = inv.type || 'Otros'
     const val = inv.quantity * inv.current_price
     investmentSubItems[t] = (investmentSubItems[t] || 0) + val
  })
  
  // 2.5 Get Savings Goals
  const { data: goals } = await supabase
    .from('savings_goals')
    .select('name, current_amount')
    .eq('user_id', userId)
  
  const goalsTotal = (goals || []).reduce((sum, g) => sum + g.current_amount, 0)
  const goalsSubItems = (goals || []).map(g => ({ name: g.name, value: g.current_amount, color: '#fbcfe8' })) // light pink

  // 3. Categorize Accounts
  let bank = 0
  const bankAccounts: { name: string, value: number }[] = []
  let cash = 0
  const cashAccounts: { name: string, value: number }[] = []
  let savings = 0
  const savingsAccounts: { name: string, value: number }[] = []
  let investmentCash = 0 // Broker cash
  let other = 0
  const otherAccounts: { name: string, value: number }[] = []

  accounts.forEach(acc => {
    const bal = acc.balance
    switch (acc.type) {
      case 'savings':
        savings += bal
        if (bal > 0) savingsAccounts.push({ name: acc.name, value: bal })
        break
      case 'broker': 
        investmentCash += bal
        break
      case 'bank':
      case 'general':
        bank += bal
        if (bal > 0) bankAccounts.push({ name: acc.name, value: bal })
        break
      case 'cash':
        cash += bal
        if (bal > 0) cashAccounts.push({ name: acc.name, value: bal })
        break
      default: 
        other += bal
        if (bal > 0) otherAccounts.push({ name: acc.name, value: bal })
    }
  })

  // 4. Total Investments
  const totalInvestments = investmentCash + investmentsAssetsValue

  // Build Investment SubItems (Cash + Assets breakdown)
  const invSubItemsList = Object.entries(investmentSubItems).map(([type, val]) => ({
      name: type.charAt(0).toUpperCase() + type.slice(1),
      value: val,
      color: '#c4b5fd' // light purple
  }))
  if (investmentCash > 0) {
      invSubItemsList.push({ name: 'Liquidez (Broker)', value: investmentCash, color: '#ddd6fe' })
  }

  const liquidity = bank + cash

  // 5. Total Assets (Net)
  // Note: Savings Goals are often inside accounts. 
  // If we just ADD them, we duplicate if they are physically in "Bank".
  // User asked for them to be visible. We will show them as a separate slice for distribution visualization, 
  // BUT the totalAssets calculation technically is sum of accounts + investments.
  // If we assume "Savings Goals" track money that is INSIDE "Bank" or "Savings" accounts.
  // We shouldn't double count in "Total Assets".
  // However, for the PIE chart, we have to decide:
  // Option A: Deduct goal amount from source account (complex, don't know source).
  // Option B: Show Goals, but acknowledge Total might be "Visual Distribution Total".
  // To be safe and clean, I will keep TotalAssets as the REAL accounting total.
  // But the Distribution Pie might sum to MORE than TotalAssets if we include Goals without deducting.
  // OR we assume Goals are separate?
  // Let's stick to: "Total Assets" = (Liquidity + Savings + Investments).
  // Goals are just a "breakdown" or we treat them as a "Category" that steals from others?
  // Given user request: "deben de contabilizarse... quesito separado".
  // I will add them as a slice. 
  // If the chart sums to > 100% of real assets, it's confusing. 
  // But usually users with this app structure treat goals as virtual.
  // I will NOT modify 'bank'/'savings' variables to deduct goals (too risky without source mapping).
  // I'll add "Objetivos" to the list. The Pie will simply show the relative proportion of these concepts.
  
  const totalAssets = liquidity + savings + totalInvestments + other // + goalsTotal? No, avoid double calc for net worth.

  // 6. Distribution Data
  const distribution: { name: string; value: number; color: string; subItems?: any[] }[] = [
    { 
        name: 'Cuentas / Bancos', 
        value: Math.max(0, bank), 
        color: '#3b82f6', // Blue
        subItems: bankAccounts 
    },
    { 
        name: 'Efectivo', 
        value: Math.max(0, cash), 
        color: '#10b981', // Emerald
        subItems: cashAccounts
    },
    { 
        name: 'Ahorro', 
        value: Math.max(0, savings), 
        color: '#f97316', // Orange (Changed for contrast)
        subItems: savingsAccounts
    },
    { 
        name: 'Objetivos Ahorro', 
        value: Math.max(0, goalsTotal), 
        color: '#ec4899', // Pink
        subItems: goalsSubItems
    },
    { 
        name: 'Inversión', 
        value: Math.max(0, totalInvestments), 
        color: '#8b5cf6', // Purple
        subItems: invSubItemsList
    },
    { 
        name: 'Otros', 
        value: Math.max(0, other), 
        color: '#64748b', // Slate
        subItems: otherAccounts
    }
  ].filter(d => d.value > 0).map(d => ({
      ...d,
      // Assign specific colors to subItems if needed, or generated?
      // For now, simpler subItems.
      subItems: d.subItems?.map(s => ({ ...s, color: d.color, opacity: 0.7 })) // simplistic styling
  }))

  return {
    totalAssets,
    liquidity,
    savings,
    investments: totalInvestments,
    distribution
  }
}
