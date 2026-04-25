import { supabase } from '../lib/supabaseClient'

// Types
export interface RecurringRule {
  id: string
  user_id: string
  organization_id?: string | null // [NEW]
  account_id: string
  kind: 'income' | 'expense'
  amount: number
  category: string | null
  description: string | null
  frequency: 'weekly' | 'monthly'
  day_of_week: number | null // 0-6 (0 = Sunday)
  day_of_month: number | null // 1-31
  next_occurrence: string
  is_active: boolean
  created_at: string
  // Joined
  account?: { id: string; name: string }
}

export interface CreateRuleInput {
  user_id: string
  organization_id?: string | null // [NEW]
  account_id: string
  kind: 'income' | 'expense'
  amount: number
  category?: string | null
  description?: string | null
  frequency: 'weekly' | 'monthly'
  day_of_week?: number | null
  day_of_month?: number | null
  next_occurrence: string
}

// Get all rules for user (filtered by organization if provided)
export async function getUserRecurringRules(userId: string, organizationId: string | null = null): Promise<RecurringRule[]> {
  let query = supabase
    .from('recurring_rules')
    .select(`
      *,
      account:accounts(id, name)
    `)
  
  // Filter by organization_id
  if (organizationId) {
    query = query.eq('organization_id', organizationId)
  } else {
    query = query.eq('user_id', userId).is('organization_id', null)
  }
  
  const { data, error } = await query.order('next_occurrence', { ascending: true })

  if (error) {
    console.error('Error fetching recurring rules:', error)
    throw error
  }
  return data || []
}

// Create new rule
export async function createRecurringRule(input: CreateRuleInput): Promise<RecurringRule> {
  const { data, error } = await supabase
    .from('recurring_rules')
    .insert([{
      ...input,
      is_active: true
    }])
    .select()
    .single()

  if (error) {
    console.error('Error creating recurring rule:', error)
    throw error
  }
  return data
}

// Update rule
export async function updateRecurringRule(ruleId: string, updates: Partial<RecurringRule>): Promise<RecurringRule> {
  const { data, error } = await supabase
    .from('recurring_rules')
    .update(updates)
    .eq('id', ruleId)
    .select()
    .single()

  if (error) {
    console.error('Error updating recurring rule:', error)
    throw error
  }
  return data
}

// Toggle active status
export async function toggleRecurringRuleActive(ruleId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('recurring_rules')
    .update({ is_active: isActive })
    .eq('id', ruleId)

  if (error) {
    console.error('Error toggling rule active:', error)
    throw error
  }
}

// Calculate next occurrence after current date
function calculateNextOccurrence(
  frequency: 'weekly' | 'monthly',
  dayOfWeek: number | null,
  dayOfMonth: number | null,
  afterDate: Date
): Date {
  const result = new Date(afterDate)
  result.setHours(0, 0, 0, 0)

  if (frequency === 'weekly' && dayOfWeek !== null) {
    // Find next occurrence of this day of week
    const currentDay = result.getDay()
    let daysToAdd = dayOfWeek - currentDay
    if (daysToAdd <= 0) daysToAdd += 7 // Always go to next week
    result.setDate(result.getDate() + daysToAdd)
  } else if (frequency === 'monthly' && dayOfMonth !== null) {
    // Move to next month
    result.setMonth(result.getMonth() + 1)
    // Set the day, handling months with fewer days
    const lastDayOfMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate()
    result.setDate(Math.min(dayOfMonth, lastDayOfMonth))
  }

  return result
}

// Generate pending movements for user (call on dashboard load)
export async function generatePendingMovementsForUser(userId: string): Promise<number> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]

  // Get all active rules where next_occurrence <= today
  const { data: rules, error: rulesError } = await supabase
    .from('recurring_rules')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .lte('next_occurrence', todayStr)

  if (rulesError) {
    console.error('Error fetching rules for generation:', rulesError)
    return 0
  }

  if (!rules || rules.length === 0) return 0

  // Batch fetch all existing movements for these rules at the relevant dates in a single query.
  const ruleIds = rules.map(r => r.id)
  const { data: existingMovements } = await supabase
    .from('movements')
    .select('recurring_rule_id, date')
    .in('recurring_rule_id', ruleIds)

  const existingKeys = new Set(
    (existingMovements || []).map(m => `${m.recurring_rule_id}|${m.date}`)
  )

  // Build inserts and rule updates in memory; run them in two batched calls.
  const inserts: Record<string, unknown>[] = []
  const ruleUpdates: { id: string; next_occurrence: string }[] = []

  for (const rule of rules) {
    if (!existingKeys.has(`${rule.id}|${rule.next_occurrence}`)) {
      inserts.push({
        user_id: userId,
        organization_id: rule.organization_id || null,
        account_id: rule.account_id,
        kind: rule.kind,
        amount: rule.amount,
        date: rule.next_occurrence,
        description: rule.description ? `(Recurrente) ${rule.description}` : '(Recurrente) Movimiento automático',
        category_id: rule.category,
        status: 'pending',
        recurring_rule_id: rule.id,
      })
    }

    const nextDate = calculateNextOccurrence(
      rule.frequency,
      rule.day_of_week,
      rule.day_of_month,
      new Date(rule.next_occurrence)
    )
    ruleUpdates.push({ id: rule.id, next_occurrence: nextDate.toISOString().split('T')[0] })
  }

  let generated = 0
  if (inserts.length) {
    const { error: insertError } = await supabase.from('movements').insert(inserts)
    if (insertError) {
      console.error('Error creating pending movements:', insertError)
    } else {
      generated = inserts.length
    }
  }

  // Update next_occurrence in parallel (one tiny PATCH per rule, but no awaits in series).
  await Promise.all(
    ruleUpdates.map(u =>
      supabase.from('recurring_rules').update({ next_occurrence: u.next_occurrence }).eq('id', u.id)
    )
  )

  return generated
}

// Get pending movements count
export async function getPendingMovementsCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('movements')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'pending')

  if (error) {
    console.error('Error counting pending movements:', error)
    return 0
  }
  return count || 0
}

// Get pending movements
export async function getPendingMovements(userId: string) {
  const { data, error } = await supabase
    .from('movements')
    .select(`
      *,
      account:accounts(id, name)
    `)
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('date', { ascending: true })

  if (error) {
    console.error('Error fetching pending movements:', error)
    throw error
  }
  return data || []
}

// Accept pending movement
export async function acceptPendingMovement(movementId: string): Promise<void> {
  const { error } = await supabase
    .from('movements')
    .update({ status: 'confirmed' })
    .eq('id', movementId)

  if (error) {
    console.error('Error accepting movement:', error)
    throw error
  }
}

// Discard pending movement
export async function discardPendingMovement(movementId: string): Promise<void> {
  const { error } = await supabase
    .from('movements')
    .delete()
    .eq('id', movementId)

  if (error) {
    console.error('Error discarding movement:', error)
    throw error
  }
}

// Helper: get day name
export function getDayName(day: number): string {
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  return days[day] || ''
}

// Helper: format frequency for display
export function formatFrequency(rule: RecurringRule): string {
  if (rule.frequency === 'weekly' && rule.day_of_week !== null) {
    return `Cada ${getDayName(rule.day_of_week)}`
  } else if (rule.frequency === 'monthly' && rule.day_of_month !== null) {
    return `Día ${rule.day_of_month} de cada mes`
  }
  return rule.frequency
}
