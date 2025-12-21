import { supabase } from '../lib/supabaseClient'

// Types for Savings Goals
export interface SavingsGoal {
  id: string
  user_id: string
  name: string
  target_amount: number
  current_amount: number
  description: string | null
  due_date: string | null
  is_completed: boolean
  created_at: string
}

export interface SavingsContribution {
  id: string
  goal_id: string
  user_id: string
  amount: number
  date: string
  note: string | null
  created_at: string
}

// Fetch all goals for user
export async function getGoalsByUser(userId: string): Promise<SavingsGoal[]> {
  const { data, error } = await supabase
    .from('savings_goals')
    .select('*')
    .eq('user_id', userId)
    .order('is_completed', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching savings goals:', error)
    throw error
  }
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
    console.error('Error fetching goal:', error)
    throw error
  }
  return data
}

// Create new goal
export interface CreateGoalInput {
  user_id: string
  name: string
  target_amount: number
  description?: string | null
  due_date?: string | null
}

export async function createGoal(input: CreateGoalInput): Promise<SavingsGoal> {
  const { data, error } = await supabase
    .from('savings_goals')
    .insert([{
      ...input,
      current_amount: 0,
      is_completed: false
    }])
    .select()
    .single()

  if (error) {
    console.error('Error creating goal:', error)
    throw error
  }
  return data
}

// Update goal
export async function updateGoal(goalId: string, updates: Partial<SavingsGoal>): Promise<SavingsGoal> {
  const { data, error } = await supabase
    .from('savings_goals')
    .update(updates)
    .eq('id', goalId)
    .select()
    .single()

  if (error) {
    console.error('Error updating goal:', error)
    throw error
  }
  return data
}

// Mark goal as completed
export async function markGoalCompleted(goalId: string): Promise<SavingsGoal> {
  return updateGoal(goalId, { is_completed: true })
}

// Get contributions for a goal
export async function getContributionsByGoal(goalId: string): Promise<SavingsContribution[]> {
  const { data, error } = await supabase
    .from('savings_goal_contributions')
    .select('*')
    .eq('goal_id', goalId)
    .order('date', { ascending: false })

  if (error) {
    console.error('Error fetching contributions:', error)
    throw error
  }
  return data || []
}

// Add contribution to a goal
export interface AddContributionInput {
  goal_id: string
  user_id: string
  amount: number
  date: string
  note?: string | null
}

export async function addContribution(input: AddContributionInput): Promise<SavingsContribution> {
  // 1. Insert contribution
  const { data: contribution, error: contribError } = await supabase
    .from('savings_goal_contributions')
    .insert([input])
    .select()
    .single()

  if (contribError) {
    console.error('Error adding contribution:', contribError)
    throw contribError
  }

  // 2. Recalculate current_amount for the goal
  await recalculateCurrentAmount(input.goal_id)

  // TODO: In the future, this is where we could also create a movement
  // in the movements table to track this as a transfer to savings.
  // Example:
  // await createMovement({
  //   user_id: input.user_id,
  //   account_id: savingsAccountId,
  //   type: 'investment',
  //   amount: input.amount,
  //   date: input.date,
  //   description: `Aportación a objetivo: ${goalName}`,
  //   category: 'Ahorro'
  // })

  return contribution
}

// Recalculate current_amount from contributions
export async function recalculateCurrentAmount(goalId: string): Promise<void> {
  // Get sum of contributions
  const { data: contributions, error: fetchError } = await supabase
    .from('savings_goal_contributions')
    .select('amount')
    .eq('goal_id', goalId)

  if (fetchError) {
    console.error('Error fetching contributions for sum:', fetchError)
    return
  }

  const total = contributions?.reduce((sum, c) => sum + c.amount, 0) || 0

  // Get target amount to check if completed
  const { data: goal } = await supabase
    .from('savings_goals')
    .select('target_amount')
    .eq('id', goalId)
    .single()

  const isCompleted = goal ? total >= goal.target_amount : false

  // Update goal with new current_amount
  const { error: updateError } = await supabase
    .from('savings_goals')
    .update({ 
      current_amount: total,
      is_completed: isCompleted
    })
    .eq('id', goalId)

  if (updateError) {
    console.error('Error updating current_amount:', updateError)
  }
}
