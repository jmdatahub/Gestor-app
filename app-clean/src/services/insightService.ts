import { supabase } from '../lib/supabaseClient'

// Types
export interface Insight {
  id: string
  type: 'spending' | 'income' | 'savings' | 'investment' | 'debt'
  severity: 'info' | 'warning' | 'success'
  title: string
  description: string
  period: string
}

export function getInsightTypeLabel(type: string, t: (key: string) => string): string {
  const typeKey = `insights.type.${type}`
  return t(typeKey)
}

// Helper to get date ranges
function getMonthRange(year: number, month: number): { start: string; end: string } {
  const start = new Date(year, month - 1, 1).toISOString().split('T')[0]
  const end = new Date(year, month, 0).toISOString().split('T')[0]
  return { start, end }
}

function getPrevMonth(year: number, month: number): { year: number; month: number } {
  if (month === 1) {
    return { year: year - 1, month: 12 }
  }
  return { year, month: month - 1 }
}

// Removed formatCurrency - defined inside getMonthlyInsights


function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

// Main insight generator
export async function getMonthlyInsights(
  userId: string,
  year: number,
  month: number,
  t: (key: string, params?: any) => string,
  locale: string = 'es-ES'
): Promise<Insight[]> {
  const insights: Insight[] = []
  
  // Helper to format currency
  const formatCurrency = (amount: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(amount)
  const currentRange = getMonthRange(year, month)
  const prev = getPrevMonth(year, month)
  const prevRange = getMonthRange(prev.year, prev.month)
  const periodLabel = `${month}/${year} vs ${prev.month}/${prev.year}`

  try {
    // Get movements for both months (excluding transfers)
    const { data: currentMovements } = await supabase
      .from('movements')
      .select('type, amount, category')
      .eq('user_id', userId)
      .eq('status', 'confirmed')
      .not('type', 'in', '(transfer_in,transfer_out)')
      .gte('date', currentRange.start)
      .lte('date', currentRange.end)

    const { data: prevMovements } = await supabase
      .from('movements')
      .select('type, amount, category')
      .eq('user_id', userId)
      .eq('status', 'confirmed')
      .not('type', 'in', '(transfer_in,transfer_out)')
      .gte('date', prevRange.start)
      .lte('date', prevRange.end)

    // Calculate totals
    const currentExpenses = (currentMovements || [])
      .filter(m => m.type === 'expense')
      .reduce((sum, m) => sum + m.amount, 0)
    
    const prevExpenses = (prevMovements || [])
      .filter(m => m.type === 'expense')
      .reduce((sum, m) => sum + m.amount, 0)

    const currentIncome = (currentMovements || [])
      .filter(m => m.type === 'income')
      .reduce((sum, m) => sum + m.amount, 0)

    const prevIncome = (prevMovements || [])
      .filter(m => m.type === 'income')
      .reduce((sum, m) => sum + m.amount, 0)

    // a) Total spending insight
    if (prevExpenses > 0 && currentExpenses > 0) {
      const changePercent = ((currentExpenses - prevExpenses) / prevExpenses) * 100

      if (currentExpenses > prevExpenses) {
        insights.push({
          id: generateId(),
          type: 'spending',
          severity: changePercent > 20 ? 'warning' : 'info',
          title: t('insights.spending.increased.title'),
          description: t('insights.spending.increased.desc', { percent: Math.abs(changePercent).toFixed(0), current: formatCurrency(currentExpenses), prev: formatCurrency(prevExpenses) }),
          period: periodLabel
        })
      } else if (currentExpenses < prevExpenses) {
        insights.push({
          id: generateId(),
          type: 'spending',
          severity: 'success',
          title: t('insights.spending.decreased.title'),
          description: t('insights.spending.decreased.desc', { percent: Math.abs(changePercent).toFixed(0), current: formatCurrency(currentExpenses), prev: formatCurrency(prevExpenses) }),
          period: periodLabel
        })
      }
    }

    // Income comparison insight
    if (prevIncome > 0 && currentIncome > 0) {
      const incomeChange = ((currentIncome - prevIncome) / prevIncome) * 100
      if (Math.abs(incomeChange) >= 10) {
        insights.push({
          id: generateId(),
          type: 'income',
          severity: incomeChange > 0 ? 'success' : 'info',
          title: incomeChange > 0 ? t('insights.income.increased.title') : t('insights.income.decreased.title'),
          description: incomeChange > 0 
            ? t('insights.income.increased.desc', { percent: Math.abs(incomeChange).toFixed(0), current: formatCurrency(currentIncome), prev: formatCurrency(prevIncome) })
            : t('insights.income.decreased.desc', { percent: Math.abs(incomeChange).toFixed(0), current: formatCurrency(currentIncome), prev: formatCurrency(prevIncome) }),
          period: periodLabel
        })
      }
    }

    // b) Category with highest spending increase
    const currentByCategory: Record<string, number> = {}
    const prevByCategory: Record<string, number> = {}

    ;(currentMovements || [])
      .filter(m => m.type === 'expense' && m.category)
      .forEach(m => {
        currentByCategory[m.category] = (currentByCategory[m.category] || 0) + m.amount
      })

    ;(prevMovements || [])
      .filter(m => m.type === 'expense' && m.category)
      .forEach(m => {
        prevByCategory[m.category] = (prevByCategory[m.category] || 0) + m.amount
      })

    let maxIncrease = 0
    let maxIncreaseCategory = ''
    let maxIncreasePrev = 0
    let maxIncreaseCurrent = 0

    for (const category of Object.keys(currentByCategory)) {
      const curr = currentByCategory[category] || 0
      const prev = prevByCategory[category] || 0
      const increase = curr - prev
      
      if (increase > maxIncrease && increase > 50) {
        maxIncrease = increase
        maxIncreaseCategory = category
        maxIncreasePrev = prev
        maxIncreaseCurrent = curr
      }
    }

    if (maxIncreaseCategory) {
      insights.push({
        id: generateId(),
        type: 'spending',
        severity: 'warning',
        title: t('insights.category.increased.title', { category: maxIncreaseCategory }),
        description: t('insights.category.increased.desc', { prev: formatCurrency(maxIncreasePrev), current: formatCurrency(maxIncreaseCurrent), diff: formatCurrency(maxIncrease) }),
        period: periodLabel
      })
    }

    // c) Income vs expenses
    if (currentIncome > 0 || currentExpenses > 0) {
      if (currentIncome >= currentExpenses) {
        insights.push({
          id: generateId(),
          type: 'income',
          severity: 'success',
          title: t('insights.balance.positive.title'),
          description: t('insights.balance.positive.desc', { income: formatCurrency(currentIncome), expense: formatCurrency(currentExpenses), balance: formatCurrency(currentIncome - currentExpenses) }),
          period: `Mes ${month}/${year}`
        })
      } else {
        insights.push({
          id: generateId(),
          type: 'spending',
          severity: 'warning',
          title: t('insights.balance.negative.title'),
          description: t('insights.balance.negative.desc', { income: formatCurrency(currentIncome), expense: formatCurrency(currentExpenses), balance: formatCurrency(currentIncome - currentExpenses) }),
          period: `Mes ${month}/${year}`
        })
      }
    }

    // d) Savings goals progress
    const { data: goals } = await supabase
      .from('savings_goals')
      .select('id, name, target_amount, current_amount, is_completed')
      .eq('user_id', userId)
      .eq('is_completed', false)

    for (const goal of (goals || [])) {
      const progress = goal.target_amount > 0 
        ? (goal.current_amount / goal.target_amount) * 100 
        : 0

      if (progress >= 75) {
        insights.push({
          id: generateId(),
          type: 'savings',
          severity: 'success',
          title: t('insights.savings.goal.title', { goal: goal.name }),
          description: t('insights.savings.goal.desc', { percent: progress.toFixed(0), current: formatCurrency(goal.current_amount), target: formatCurrency(goal.target_amount) }),
          period: 'Progreso actual'
        })
      }
    }

    // e) Investment changes
    const { data: investments } = await supabase
      .from('investments')
      .select('id, name, buy_price, current_price')
      .eq('user_id', userId)

    for (const inv of (investments || [])) {
      const changePercent = inv.buy_price > 0 
        ? ((inv.current_price - inv.buy_price) / inv.buy_price) * 100 
        : 0

      if (Math.abs(changePercent) >= 10) {
        insights.push({
          id: generateId(),
          type: 'investment',
          severity: changePercent >= 0 ? 'success' : 'warning',
          title: changePercent > 0 
            ? t('insights.investment.change.titlePos', { investment: inv.name, percent: changePercent.toFixed(0) })
            : t('insights.investment.change.title', { investment: inv.name, percent: changePercent.toFixed(0) }),
          description: t('insights.investment.change.desc', { buyPrice: formatCurrency(inv.buy_price), currentPrice: formatCurrency(inv.current_price) }),
          period: 'Desde la compra'
        })
      }
    }

    // f) Debts due soon
    const now = new Date()
    const in15Days = new Date()
    in15Days.setDate(now.getDate() + 15)

    const { data: debts } = await supabase
      .from('debts')
      .select('*')
      .eq('user_id', userId)
      .eq('is_closed', false)
      .not('due_date', 'is', null)
      .lte('due_date', in15Days.toISOString().split('T')[0])

    for (const debt of (debts || [])) {
      if (debt.remaining_amount > 0) {
        const dueDate = new Date(debt.due_date)
        const daysRemaining = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        
        if (daysRemaining >= 0 && daysRemaining <= 15) {
          insights.push({
            id: generateId(),
            type: 'debt',
            severity: daysRemaining <= 7 ? 'warning' : 'info',
            title: t('insights.debt.due.title', { creditor: debt.counterparty_name }),
            description: t('insights.debt.due.desc', { days: daysRemaining, amount: formatCurrency(debt.remaining_amount) }),
            period: 'Próximo vencimiento'
          })
        }
      }
    }

  } catch (error) {
    console.error('Error generating insights:', error)
  }

  return insights
}



// Get icon for type
export function getInsightIcon(type: Insight['type']): string {
  switch (type) {
    case 'spending': return '💸'
    case 'income': return '💰'
    case 'savings': return '🎯'
    case 'investment': return '📈'
    case 'debt': return '💳'
    default: return '📊'
  }
}
