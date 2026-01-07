import { supabase } from '../lib/supabaseClient'

/**
 * Schema REAL de savings_goals en Supabase:
 * - id, user_id, name, target_amount, current_amount (default 0)
 * - target_date (DATE, nullable) - NO "due_date"
 * - color, icon
 * - status (TEXT, default 'active') - NO "is_completed", valores: 'active' | 'completed' | 'cancelled'
 * - created_at
 * 
 * Tabla de contribuciones: savings_contributions (NO savings_goal_contributions)
 */

// Types for Savings Goals - MATCH ACTUAL DB SCHEMA
export interface SavingsGoal {
  id: string
  user_id: string
  name: string
  target_amount: number
  current_amount: number
  target_date: string | null
  description: string | null  // Añadido: descripción/comentario
  color: string | null
  icon: string | null
  status: 'active' | 'completed' | 'cancelled'
  created_at: string
}

export interface SavingsContribution {
  id: string
  goal_id: string
  amount: number
  date: string
  note: string | null
  created_at: string
}

// Fetch all goals for user (filtered by organization if provided)
export async function getGoalsByUser(userId: string, organizationId: string | null = null): Promise<SavingsGoal[]> {
  console.log('[savingsService] Fetching goals for user:', userId, 'org:', organizationId)
  
  let query = supabase
    .from('savings_goals')
    .select('*')
    .eq('user_id', userId)
  
  // Filter by organization_id (null for personal, specific ID for org)
  if (organizationId) {
    query = query.eq('organization_id', organizationId)
  } else {
    query = query.is('organization_id', null)
  }
  
  const { data, error } = await query
    .order('status', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[savingsService] Error fetching savings goals:', error)
    throw error
  }
  
  console.log('[savingsService] Goals fetched:', data?.length || 0)
  return data || []
}

// Get single goal by ID
export async function getGoalById(goalId: string): Promise<SavingsGoal | null> {
  const { data, error } = await supabase
    .from('savings_goals')
    .select('*')
    .eq('id', goalId)
    .single()

  if (error) {
    console.error('[savingsService] Error fetching goal:', error)
    throw error
  }
  return data
}

// Create new goal
export interface CreateGoalInput {
  user_id: string
  organization_id?: string | null  // Add organization support
  name: string
  target_amount: number
  target_date?: string | null
  description?: string | null  // Añadido: descripción opcional
  color?: string | null
}

export async function createGoal(input: CreateGoalInput): Promise<SavingsGoal> {
  console.log('[savingsService] Creating goal:', input)
  
  // Build payload with ONLY valid DB columns
  const payload: Record<string, unknown> = {
    user_id: input.user_id,
    organization_id: input.organization_id || null,  // Include organization_id
    name: input.name,
    target_amount: input.target_amount,
    current_amount: 0,
    status: 'active'
  }
  
  // Only add optional fields if provided
  if (input.target_date) {
    payload.target_date = input.target_date
  }
  if (input.description) {
    payload.description = input.description
  }
  if (input.color) {
    payload.color = input.color
  }
  
  const { data, error } = await supabase
    .from('savings_goals')
    .insert([payload])
    .select()
    .single()

  if (error) {
    console.error('[savingsService] Error creating goal:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code
    })
    throw error
  }
  
  console.log('[savingsService] Goal created successfully:', data)
  return data
}

// Update goal
export async function updateGoal(goalId: string, updates: Partial<SavingsGoal>): Promise<SavingsGoal> {
  console.log('[savingsService] Updating goal:', goalId, updates)
  
  const { data, error } = await supabase
    .from('savings_goals')
    .update(updates)
    .eq('id', goalId)
    .select()
    .single()

  if (error) {
    console.error('[savingsService] Error updating goal:', error)
    throw error
  }
  
  console.log('[savingsService] Goal updated:', data)
  return data
}

// Mark goal as completed
export async function markGoalCompleted(goalId: string): Promise<SavingsGoal> {
  return updateGoal(goalId, { status: 'completed' })
}

// Delete goal
export async function deleteGoal(goalId: string): Promise<void> {
  console.log('[savingsService] Deleting goal:', goalId)
  
  const { error } = await supabase
    .from('savings_goals')
    .delete()
    .eq('id', goalId)

  if (error) {
    console.error('[savingsService] Error deleting goal:', error)
    throw error
  }
  
  console.log('[savingsService] Goal deleted:', goalId)
}

// Get contributions for a goal - CORRECT TABLE NAME
export async function getContributionsByGoal(goalId: string): Promise<SavingsContribution[]> {
  console.log('[savingsService] Fetching contributions for goal:', goalId)
  
  const { data, error } = await supabase
    .from('savings_contributions')  // CORRECT: not savings_goal_contributions
    .select('*')
    .eq('goal_id', goalId)
    .order('date', { ascending: false })

  if (error) {
    console.error('[savingsService] Error fetching contributions:', error)
    throw error
  }
  
  return data || []
}

// Link to movement service
import { createMovement } from './movementService'

// Add contribution to a goal
export interface AddContributionInput {
  goal_id: string
  amount: number
  date: string
  note?: string | null
  source_account_id?: string // Optional source account
  user_id?: string // Required for movement creation
}

export async function addContribution(input: AddContributionInput): Promise<SavingsContribution> {
  console.log('[savingsService] Adding contribution:', input)
  
  // Insert contribution - CORRECT TABLE NAME
  const { data: contribution, error: contribError } = await supabase
    .from('savings_contributions')  // CORRECT: not savings_goal_contributions
    .insert([{
      goal_id: input.goal_id,
      amount: input.amount,
      date: input.date,
      note: input.note || null
    }])
    .select()
    .single()

  if (contribError) {
    console.error('[savingsService] Error adding contribution:', contribError)
    throw contribError
  }

  // If linked account provided, create expense movement
  if (input.source_account_id && input.user_id) {
    try {
      // Get goal name for description
      const { data: goal } = await supabase
        .from('savings_goals')
        .select('name')
        .eq('id', input.goal_id)
        .single()
        
      const description = `Aportación: ${goal?.name || 'Objetivo Ahorro'}`
      
      await createMovement({
        user_id: input.user_id,
        account_id: input.source_account_id,
        kind: 'expense', // Expense from the account point of view
        amount: input.amount,
        date: input.date,
        description: description,
        category_id: null // Or fetch 'Ahorro' category if needed
      })
      console.log('[savingsService] Created linked expense movement')
    } catch (movError) {
      console.error('[savingsService] Error creating linked movement:', movError)
      // Don't fail the contribution if movement fails, just log it
    }
  }

  // Recalculate current_amount for the goal
  await recalculateCurrentAmount(input.goal_id)

  console.log('[savingsService] Contribution added:', contribution)
  return contribution
}

// Recalculate current_amount from contributions
export async function recalculateCurrentAmount(goalId: string): Promise<void> {
  // Get sum of contributions - CORRECT TABLE NAME
  const { data: contributions, error: fetchError } = await supabase
    .from('savings_contributions')  // CORRECT: not savings_goal_contributions
    .select('amount')
    .eq('goal_id', goalId)

  if (fetchError) {
    console.error('[savingsService] Error fetching contributions for sum:', fetchError)
    return
  }

  const total = contributions?.reduce((sum, c) => sum + c.amount, 0) || 0

  // Get target amount to check if completed
  const { data: goal } = await supabase
    .from('savings_goals')
    .select('target_amount')
    .eq('id', goalId)
    .single()

  const newStatus = goal && total >= goal.target_amount ? 'completed' : 'active'

  // Update goal with new current_amount
  const { error: updateError } = await supabase
    .from('savings_goals')
    .update({ 
      current_amount: total,
      status: newStatus
    })
    .eq('id', goalId)

  if (updateError) {
    console.error('[savingsService] Error updating current_amount:', updateError)
  }
}
