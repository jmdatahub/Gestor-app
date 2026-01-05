import { supabase } from '../lib/supabaseClient'
import { invalidateCategories } from './catalogCache'

// Types - MATCHES ACTUAL SUPABASE SCHEMA
export interface Movement {
  id: string
  user_id: string
  account_id: string
  kind: 'income' | 'expense' | 'investment' // DB uses 'kind' not 'type'
  amount: number
  date: string
  description: string | null
  category_id: string | null
  status?: string
  is_business?: boolean
  created_at: string
  // Joined data
  account?: { id: string; name: string }
  category?: { id: string; name: string; color?: string }
}

export interface Account {
  id: string
  user_id: string
  name: string
  type: string
}

export interface Category {
  id: string
  user_id: string
  name: string
  kind: string // income or expense
  color?: string // hex color like #RRGGBB
  description?: string | null  // Añadido: descripción de la categoría
}

// Fetch movements for user
export async function fetchMovements(userId: string, limit = 50): Promise<Movement[]> {
  const { data, error } = await supabase
    .from('movements')
    .select(`
      *,
      account:accounts(id, name),
      category:categories(id, name, color)
    `)
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching movements:', error)
    throw error
  }
  return data || []
}

// Fetch movements for current month
export async function fetchMonthlyMovements(userId: string): Promise<Movement[]> {
  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('movements')
    .select(`
      *,
      category:categories(id, name, color)
    `)
    .eq('user_id', userId)
    .gte('date', firstDay)
    .lte('date', lastDay)

  if (error) {
    console.error('Error fetching monthly movements:', error)
    throw error
  }
  return data || []
}

// Calculate monthly summary
export function calculateMonthlySummary(movements: Movement[]) {
  let income = 0
  let expense = 0

  movements.forEach(m => {
    if (m.kind === 'income') {
      income += m.amount
    } else if (m.kind === 'expense') {
      expense += m.amount
    }
    // investment is neutral for now
  })

  return {
    income,
    expense,
    balance: income - expense
  }
}

// Create movement
export interface CreateMovementInput {
  user_id: string
  account_id: string
  kind: 'income' | 'expense' | 'investment' // DB uses 'kind'
  amount: number
  date: string
  description?: string | null
  category_id?: string | null
}

export async function createMovement(input: CreateMovementInput): Promise<Movement> {
  console.log('[movementService] Creating movement:', input)
  
  const { data, error } = await supabase
    .from('movements')
    .insert([{
      user_id: input.user_id,
      account_id: input.account_id,
      kind: input.kind,
      amount: input.amount,
      date: input.date,
      description: input.description || null,
      category_id: input.category_id || null
    }])
    .select()
    .single()

  if (error) {
    console.error('[movementService] Error creating movement:', error)
    throw error
  }
  
  console.log('[movementService] Movement created:', data)
  return data
}

// Update existing movement
export async function updateMovement(
  movementId: string, 
  updates: Partial<CreateMovementInput>
): Promise<Movement> {
  console.log('[movementService] Updating movement:', movementId, updates)
  
  const { data, error } = await supabase
    .from('movements')
    .update(updates)
    .eq('id', movementId)
    .select()
    .single()

  if (error) {
    console.error('[movementService] Error updating movement:', error)
    throw error
  }
  
  console.log('[movementService] Movement updated:', data)
  return data
}

// Delete movement
export async function deleteMovement(movementId: string): Promise<void> {
  console.log('[movementService] Deleting movement:', movementId)
  
  const { error } = await supabase
    .from('movements')
    .delete()
    .eq('id', movementId)

  if (error) {
    console.error('[movementService] Error deleting movement:', error)
    throw error
  }
  
  console.log('[movementService] Movement deleted:', movementId)
}

// Fetch user accounts
export async function fetchAccounts(userId: string): Promise<Account[]> {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', userId)

  if (error) {
    console.error('Error fetching accounts:', error)
    throw error
  }
  return data || []
}

// Fetch user categories
export async function fetchCategories(userId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)

  if (error) {
    // Categories might not exist yet, return empty
    console.warn('Categories fetch failed, might not exist:', error)
    return []
  }
  return data || []
}

// Create a new category
export async function createCategory(
  userId: string, 
  name: string, 
  kind: 'income' | 'expense' = 'expense',
  color?: string
): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .insert([{
      user_id: userId,
      name: name.trim(),
      kind,
      color: color || getRandomCategoryColor()
    }])
    .select()
    .single()

  if (error) {
    console.error('Error creating category:', error)
    throw error
  }
  invalidateCategories(userId)
  return data
}

// Get or create category by name (for auto-creation)
export async function getOrCreateCategory(
  userId: string,
  name: string,
  kind: 'income' | 'expense' = 'expense'
): Promise<Category> {
  const trimmedName = name.trim()
  
  // Check if category already exists
  const { data: existing } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .ilike('name', trimmedName)
    .single()

  if (existing) {
    return existing
  }

  // Create new category
  return createCategory(userId, trimmedName, kind)
}

// Random color generator for new categories
function getRandomCategoryColor(): string {
  const colors = [
    '#818cf8', '#34d399', '#fbbf24', '#f87171', 
    '#60a5fa', '#a78bfa', '#fb923c', '#4ade80',
    '#f472b6', '#22d3d8', '#84cc16', '#e879f9'
  ]
  return colors[Math.floor(Math.random() * colors.length)]
}

