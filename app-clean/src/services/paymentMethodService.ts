// Payment Method Service - CRUD for user payment methods
import { supabase } from '../lib/supabaseClient'

export interface PaymentMethod {
  id: string
  user_id: string
  organization_id: string | null
  name: string
  icon: string | null
  is_default: boolean
  sort_order: number
  created_at: string
}

const DEFAULT_METHODS = [
  { name: 'Tarjeta de débito', icon: '💳' },
  { name: 'Tarjeta de crédito', icon: '💳' },
  { name: 'Transferencia', icon: '🏦' },
  { name: 'Efectivo', icon: '💵' },
  { name: 'Bizum', icon: '📱' },
  { name: 'PayPal', icon: '🅿️' }
]

// Get all payment methods for user
export async function getPaymentMethods(userId: string, organizationId?: string | null): Promise<PaymentMethod[]> {
  let query = supabase
    .from('payment_methods')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })

  const { data, error } = await query

  if (error) {
    console.error('Error fetching payment methods:', error)
    return []
  }

  return data || []
}

// Create a new payment method
export async function createPaymentMethod(
  userId: string,
  name: string,
  icon?: string,
  organizationId?: string | null
): Promise<PaymentMethod | null> {
  const existing = await getPaymentMethods(userId, organizationId)
  const sortOrder = existing.length

  const { data, error } = await supabase
    .from('payment_methods')
    .insert({
      user_id: userId,
      organization_id: organizationId || null,
      name,
      icon: icon || null,
      is_default: existing.length === 0, // First one is default
      sort_order: sortOrder
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating payment method:', error)
    return null
  }

  return data
}

// Update a payment method
export async function updatePaymentMethod(
  id: string,
  updates: { name?: string; icon?: string; sort_order?: number }
): Promise<PaymentMethod | null> {
  const { data, error } = await supabase
    .from('payment_methods')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating payment method:', error)
    return null
  }

  return data
}

// Delete a payment method
export async function deletePaymentMethod(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('payment_methods')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting payment method:', error)
    return false
  }

  return true
}

// Set a payment method as default
export async function setDefaultPaymentMethod(userId: string, id: string): Promise<boolean> {
  // First, unset all defaults
  await supabase
    .from('payment_methods')
    .update({ is_default: false })
    .eq('user_id', userId)

  // Then set the new default
  const { error } = await supabase
    .from('payment_methods')
    .update({ is_default: true })
    .eq('id', id)

  if (error) {
    console.error('Error setting default payment method:', error)
    return false
  }

  return true
}

// Initialize default payment methods for a new user
export async function initializeDefaultPaymentMethods(userId: string): Promise<void> {
  const existing = await getPaymentMethods(userId)
  if (existing.length > 0) return // Already has methods

  for (let i = 0; i < DEFAULT_METHODS.length; i++) {
    const method = DEFAULT_METHODS[i]
    await supabase
      .from('payment_methods')
      .insert({
        user_id: userId,
        name: method.name,
        icon: method.icon,
        is_default: i === 0,
        sort_order: i
      })
  }
}

// Get default payment method
export async function getDefaultPaymentMethod(userId: string): Promise<PaymentMethod | null> {
  const { data, error } = await supabase
    .from('payment_methods')
    .select('*')
    .eq('user_id', userId)
    .eq('is_default', true)
    .single()

  if (error) return null
  return data
}
