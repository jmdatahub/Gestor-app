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
  options: { includeChildrenRollup?: boolean } = {},
  organizationId?: string | null // [NEW]
): Promise<MonthlySummary> {
  const range = getMonthRange(year, month)

  // Get movements for this month (excluding transfers)
  let query = supabase
    .from('movements')
    .select('kind, amount')
    .not('kind', 'in', '(transfer_in,transfer_out)')
    .gte('date', range.start)
    .lte('date', range.end)

  if (organizationId) {
    query = query.eq('organization_id', organizationId)
  } else {
    query = query.eq('user_id', userId).is('organization_id', null)
  }

  const { data: movements } = await query

  let income = 0
  let expenses = 0

  for (const m of (movements || [])) {
    if (m.kind === 'income') {
      income += m.amount
    } else if (m.kind === 'expense') {
      expenses += m.amount
    }
  }

  // Get savings contributions for this month (Only for Personal currently? Or Org too if table adapted?)
  // Table savings_goal_contributions is NOT yet adapted to shadow mode (It was NOT in MIG_003).
  // So for now, we only query it if organizationId is NULL.
  
  let savingsChange = 0
  if (!organizationId) {
    const { data: contributions } = await supabase
        .from('savings_goal_contributions')
        .select('amount')
        .eq('user_id', userId)
        .gte('date', range.start)
        .lte('date', range.end)
    
    savingsChange = (contributions || []).reduce((sum, c) => sum + c.amount, 0)
  }

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
  month: number,
  organizationId?: string | null // [NEW]
): Promise<CategorySummary[]> {
  const range = getMonthRange(year, month)

  // Get expense movements with categories
  let query = supabase
    .from('movements')
    .select('category:categories(name), amount')
    .eq('kind', 'expense')
    .gte('date', range.start)
    .lte('date', range.end)

  if (organizationId) {
    query = query.eq('organization_id', organizationId)
  } else {
    query = query.eq('user_id', userId).is('organization_id', null)
  }

  const { data: movements } = await query

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
  atDate: Date = new Date(),
  organizationId?: string | null // [NEW]
): Promise<NetWorthSummary> {
  // Get all movements for balance calculation (including transfers)
  let query = supabase
    .from('movements')
    .select('kind, amount')

  if (organizationId) {
    query = query.eq('organization_id', organizationId)
  } else {
    query = query.eq('user_id', userId).is('organization_id', null)
  }

  const { data: movements } = await query

  let cashBalance = 0
  for (const m of (movements || [])) {
    if (m.kind === 'income' || m.kind === 'transfer_in') {
      cashBalance += m.amount
    } else if (m.kind === 'expense' || m.kind === 'transfer_out' || m.kind === 'investment') {
      cashBalance -= m.amount
    }
  }

  // Investments and Debts are separate tables.
  // Currently debts/investments are NOT migrated to Organization ID.
  // So we return 0 for those in Org Mode.
  let investmentsValue = 0
  let debtsPending = 0

  if (!organizationId) {
     // Get investments value
    const { data: investments } = await supabase
        .from('investments')
        .select('quantity, current_price')
        .eq('user_id', userId)

    investmentsValue = (investments || []).reduce(
        (sum, inv) => sum + (inv.quantity * inv.current_price),
        0
    )

    // Get pending debts
    const { data: debts } = await supabase
        .from('debts')
        .select('remaining_amount')
        .eq('user_id', userId)
        .eq('is_closed', false)

    debtsPending = (debts || []).reduce(
        (sum, d) => sum + (d.remaining_amount || 0),
        0
    )
  }

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
  monthsBack: number,
  organizationId?: string | null
): Promise<MonthlySummary[]> {
  const results: MonthlySummary[] = []
  const now = new Date()

  for (let i = monthsBack - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const year = date.getFullYear()
    const month = date.getMonth() + 1

    const summary = await getMonthlySummary(userId, year, month, {}, organizationId)
    results.push(summary)
  }

  return results
}

// Weekly summary interface
export interface WeeklySummary {
  weekStart: string // ISO date string
  weekLabel: string // e.g., "S1 Ene", "S2 Ene"
  income: number
  expenses: number
}

// Get weekly history for last N weeks
export async function getWeeklyHistory(
  userId: string,
  weeksBack: number,
  organizationId?: string | null
): Promise<WeeklySummary[]> {
  const now = new Date()
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  
  // Helper to format date as YYYY-MM-DD in local timezone
  const formatLocalDate = (d: Date): string => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  
  // Helper to get Monday of the week for a given date
  const getMonday = (d: Date): Date => {
    const result = new Date(d)
    result.setHours(0, 0, 0, 0)
    const day = result.getDay()
    const diff = result.getDate() - day + (day === 0 ? -6 : 1)
    result.setDate(diff)
    return result
  }
  
  // Generate all weeks in the range first
  const weeklyData: Map<string, { income: number; expenses: number; weekStart: Date }> = new Map()
  
  // Start from weeksBack weeks ago
  for (let w = weeksBack - 1; w >= 0; w--) {
    const weekDate = new Date(now)
    weekDate.setDate(weekDate.getDate() - (w * 7))
    const monday = getMonday(weekDate)
    const weekKey = formatLocalDate(monday)
    
    if (!weeklyData.has(weekKey)) {
      weeklyData.set(weekKey, { income: 0, expenses: 0, weekStart: new Date(monday) })
    }
  }
  
  // Get the date range - sort entries first to get correct min/max
  const sortedEntries = Array.from(weeklyData.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  if (sortedEntries.length === 0) return []
  
  const startDate = sortedEntries[0][0] // First week key
  const endDate = formatLocalDate(now)
  
  // Fetch all movements in the date range
  let query = supabase
    .from('movements')
    .select('date, kind, amount')
    .not('kind', 'in', '(transfer_in,transfer_out)')
    .gte('date', startDate)
    .lte('date', endDate)

  if (organizationId) {
    query = query.eq('organization_id', organizationId)
  } else {
    query = query.eq('user_id', userId).is('organization_id', null)
  }

  const { data: movements } = await query
  
  console.log(`[WeeklyHistory] Weeks: ${sortedEntries.length}, Range: ${startDate} to ${endDate}`)
  console.log(`[WeeklyHistory] Fetched ${movements?.length || 0} movements`)
  
  // Aggregate movements into weeks
  for (const m of (movements || [])) {
    // Parse the date string directly to avoid timezone issues
    const [year, month, day] = m.date.split('-').map(Number)
    const mDate = new Date(year, month - 1, day)
    const monday = getMonday(mDate)
    const weekKey = formatLocalDate(monday)
    
    const week = weeklyData.get(weekKey)
    if (week) {
      if (m.kind === 'income') {
        week.income += m.amount
      } else if (m.kind === 'expense') {
        week.expenses += m.amount
      }
    }
  }
  
  // Convert to array and sort by date
  const results: WeeklySummary[] = Array.from(weeklyData.entries())
    .map(([weekKey, data]) => {
      const d = data.weekStart
      const weekOfMonth = Math.ceil(d.getDate() / 7)
      return {
        weekStart: weekKey,
        weekLabel: `S${weekOfMonth} ${monthNames[d.getMonth()]}`,
        income: data.income,
        expenses: data.expenses
      }
    })
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
  
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
  options: { includeChildrenRollup?: boolean } = {},
  organizationId?: string | null
): Promise<AccountWithBalance[]> {
  // 1. Get raw accounts with balances
  const accounts = await getAccountsWithBalances(userId, organizationId)

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

export async function getFinancialDistribution(
    userId: string, 
    organizationId?: string | null
): Promise<FinancialDistribution> {
  // 1. Get Accounts with Balances
  const accounts = await getAccountsWithBalances(userId, organizationId)

  // 2. Get Investments Value (Only Personal for now)
  let investmentsAssetsValue = 0
  let investmentSubItems: { [key: string]: number } = {}
  let goalsTotal = 0
  let goalsSubItems: any[] = []

  if (!organizationId) {
      const userInvestments = await getUserInvestments(userId)
      const invTotals = calculateTotals(userInvestments)
      investmentsAssetsValue = invTotals.totalValue

      userInvestments.forEach(inv => {
         const t = inv.type || 'Otros'
         const val = inv.quantity * inv.current_price
         investmentSubItems[t] = (investmentSubItems[t] || 0) + val
      })
      
      const { data: goals } = await supabase
        .from('savings_goals')
        .select('name, current_amount')
        .eq('user_id', userId)
      
      goalsTotal = (goals || []).reduce((sum, g) => sum + g.current_amount, 0)
      goalsSubItems = (goals || []).map(g => ({ name: g.name, value: g.current_amount, color: '#fbcfe8' }))
  }

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
  
  const totalAssets = liquidity + savings + totalInvestments + other

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
