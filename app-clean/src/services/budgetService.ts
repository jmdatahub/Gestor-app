// Budget service - Supabase-based for cross-device sync
import { supabase } from '../lib/supabaseClient'

export interface Budget {
  id: string
  user_id: string
  category_id: string | null
  category_name: string
  monthly_limit: number
  month: string // YYYY-MM format
  created_at: string
  updated_at: string
}

export interface BudgetInput {
  user_id: string
  category_id?: string | null
  category_name: string
  monthly_limit: number
  month: string
}

// Get current month in YYYY-MM format
export function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// Get all budgets for a specific month
export async function getBudgetsForMonth(
  userId: string, 
  month: string
): Promise<Budget[]> {
  const { data, error } = await supabase
    .from('budgets')
    .select('*')
    .eq('user_id', userId)
    .eq('month', month)
    .order('category_name')

  if (error) {
    console.error('Error fetching budgets:', error)
    return []
  }

  return data || []
}

// Get budget for specific category and month
export async function getBudget(
  userId: string,
  categoryName: string, 
  month: string
): Promise<Budget | null> {
  const { data, error } = await supabase
    .from('budgets')
    .select('*')
    .eq('user_id', userId)
    .eq('category_name', categoryName)
    .eq('month', month)
    .single()

  if (error) {
    if (error.code !== 'PGRST116') { // Not found is ok
      console.error('Error fetching budget:', error)
    }
    return null
  }

  return data
}

// Create or update a budget (upsert by checking if exists first)
export async function setBudget(input: BudgetInput): Promise<Budget | null> {
  // Check if budget already exists
  const existing = await getBudget(input.user_id, input.category_name, input.month)
  
  if (existing) {
    // Update existing
    const { data, error } = await supabase
      .from('budgets')
      .update({
        monthly_limit: input.monthly_limit,
        category_id: input.category_id || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating budget:', error)
      return null
    }
    return data
  } else {
    // Insert new
    const { data, error } = await supabase
      .from('budgets')
      .insert({
        user_id: input.user_id,
        category_id: input.category_id || null,
        category_name: input.category_name,
        monthly_limit: input.monthly_limit,
        month: input.month
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating budget:', error)
      return null
    }
    return data
  }
}

// Delete a budget
export async function deleteBudget(
  userId: string,
  categoryName: string, 
  month: string
): Promise<boolean> {
  const { error } = await supabase
    .from('budgets')
    .delete()
    .eq('user_id', userId)
    .eq('category_name', categoryName)
    .eq('month', month)

  if (error) {
    console.error('Error deleting budget:', error)
    return false
  }

  return true
}

// Calculate budget progress
export interface BudgetProgress {
  categoryName: string
  spent: number
  limit: number
  percentage: number
  isOverBudget: boolean
  remaining: number
}
