import { supabase } from '../lib/supabaseClient'

export interface UserProfile {
  id: string
  email: string | null
  display_name: string | null
  is_suspended: boolean
  is_super_admin: boolean
  created_at: string
}

// Get all users (only works for super admins due to RLS)
export async function getAllUsers(): Promise<UserProfile[]> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('Error fetching users (safe fallback):', error.message)
      return []
    }

    return data as UserProfile[]
  } catch (err) {
    console.error('Unexpected error in getAllUsers:', err)
    return []
  }
}

// Get user count
export async function getUserCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })

    if (error) {
      console.warn('Error counting users (safe fallback):', error.message)
      return 0
    }

    return count || 0
  } catch (err) {
    console.error('Unexpected error in getUserCount:', err)
    return 0
  }
}

// Suspend a user
export async function suspendUser(userId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ is_suspended: true })
    .eq('id', userId)

  if (error) throw error
}

// Unsuspend a user
export async function unsuspendUser(userId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ is_suspended: false })
    .eq('id', userId)

  if (error) throw error
}

// Get suspended user count
export async function getSuspendedCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_suspended', true)

    if (error) return 0
    return count || 0
  } catch (err) {
    return 0
  }
}

// Get organization count (for admin stats)
export async function getOrganizationCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('organizations')
      .select('*', { count: 'exact', head: true })

    if (error) return 0
    return count || 0
  } catch (err) {
    return 0
  }
}

// Check if current user is super admin
export async function checkIsSuperAdmin(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const { data, error } = await supabase
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single()

    if (error || !data) return false
    return data.is_super_admin === true
  } catch (err) {
    console.warn('Check super admin failed (safe fallback):', err)
    return false
  }
}

// Check if the profiles table exists and is accessible
export async function checkDatabaseHealth(): Promise<{ profilesExists: boolean }> {
  try {
    const { error } = await supabase.from('profiles').select('count', { count: 'exact', head: true })
    
    // If error code is 42P01 (undefined_table), the table is missing
    if (error && error.code === '42P01') {
      return { profilesExists: false }
    }
    
    // For other errors (permission, etc) or success, we assume it exists
    return { profilesExists: true }
  } catch (err) {
    return { profilesExists: false }
  }
}
