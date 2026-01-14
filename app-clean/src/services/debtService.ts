import { supabase } from '../lib/supabaseClient'

// Types
export interface Debt {
  id: string
  user_id: string
  organization_id?: string | null // [NEW] Multi-workspace support
  direction: 'i_owe' | 'they_owe_me'
  counterparty_name: string
  total_amount: number
  remaining_amount: number
  due_date: string | null
  description: string | null
  is_closed: boolean
  created_at: string
}

export interface DebtMovement {
  id: string
  debt_id: string
  type: 'payment' | 'increase'
  amount: number
  date: string
  note: string | null
  created_at: string
}

export type CreateDebtInput = Omit<Debt, 'id' | 'remaining_amount' | 'is_closed' | 'created_at'>

// Fetch all debts for user
export async function fetchDebts(userId: string, organizationId: string | null = null): Promise<Debt[]> {
  let query = supabase
    .from('debts')
    .select('*')
    .eq('user_id', userId)

  // Filter by organization_id
  if (organizationId) {
    query = query.eq('organization_id', organizationId)
  } else {
    query = query.eq('user_id', userId).is('organization_id', null)
  }
    
  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

// Fetch single debt
export async function fetchDebtById(debtId: string): Promise<Debt | null> {
  const { data, error } = await supabase
    .from('debts')
    .select('*')
    .eq('id', debtId)
    .single()

  if (error) throw error
  return data
}

// Fetch movements for a debt
export async function fetchDebtMovements(debtId: string): Promise<DebtMovement[]> {
  const { data, error } = await supabase
    .from('debt_movements')
    .select('*')
    .eq('debt_id', debtId)
    .order('date', { ascending: false })

  if (error) throw error
  return data || []
}

// Create new debt with robust error handling
export async function createDebt(input: CreateDebtInput): Promise<Debt> {
  console.log('[debtService] Creating debt:', input)
  
  const { data, error } = await supabase
    .from('debts')
    .insert([{
      user_id: input.user_id,
      organization_id: input.organization_id || null, // Include org_id
      direction: input.direction,
      counterparty_name: input.counterparty_name,
      total_amount: input.total_amount,
      due_date: input.due_date,
      description: input.description,
      remaining_amount: input.total_amount,
      is_closed: false
    }])
    .select()
    .single()

  if (error) {
    console.error('[debtService] Create debt error:', error)
    throw error
  }
  
  console.log('[debtService] Debt created successfully:', data)
  return data
}

// Update debt info
export async function updateDebt(debtId: string, updates: Partial<Debt>): Promise<Debt> {
  const { data, error } = await supabase
    .from('debts')
    .update(updates)
    .eq('id', debtId)
    .select()
    .single()

  if (error) throw error
  return data
}

// Add debt movement (payment or increase)
export async function addDebtMovement(movement: Omit<DebtMovement, 'id' | 'created_at'>): Promise<DebtMovement> {
  // 1. Insert movement
  const { data: movementData, error: moveError } = await supabase
    .from('debt_movements')
    .insert([movement])
    .select()
    .single()

  if (moveError) throw moveError

  // 2. Update debt remaining/total amount
  const { data: debt } = await supabase
    .from('debts')
    .select('total_amount, remaining_amount')
    .eq('id', movement.debt_id)
    .single()

  if (!debt) throw new Error('Debt not found')

  let newRemaining = debt.remaining_amount
  let newTotal = debt.total_amount

  if (movement.type === 'payment') {
    newRemaining -= movement.amount
  } else if (movement.type === 'increase') {
    newTotal += movement.amount
    newRemaining += movement.amount
  }

  const isClosed = newRemaining <= 0

  const { error: updateError } = await supabase
    .from('debts')
    .update({
      total_amount: newTotal,
      remaining_amount: Math.max(0, newRemaining),
      is_closed: isClosed
    })
    .eq('id', movement.debt_id)

  if (updateError) throw updateError

  return movementData
}

// Count pending debts (not closed)
export async function countPendingDebts(userId: string, organizationId: string | null = null): Promise<number> {
  let query = supabase
    .from('debts')
    .select('*', { count: 'exact', head: true }) // count only
    .eq('user_id', userId)
    .eq('is_closed', false)

  if (organizationId) {
    query = query.eq('organization_id', organizationId)
  } else {
    query = query.eq('user_id', userId).is('organization_id', null)
  }

  const { count, error } = await query

  if (error) {
    console.error('Error counting pending debts:', error)
    return 0
  }
  return count || 0
}
