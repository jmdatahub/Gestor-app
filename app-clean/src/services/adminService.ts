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
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching users:', error)
    throw error
  }

  return data as UserProfile[]
}

// Get user count
export async function getUserCount(): Promise<number> {
  const { count, error } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })

  if (error) {
    console.error('Error counting users:', error)
    return 0
  }

  return count || 0
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
  const { count, error } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('is_suspended', true)

  if (error) return 0
  return count || 0
}

// Get organization count (for admin stats)
export async function getOrganizationCount(): Promise<number> {
  const { count, error } = await supabase
    .from('organizations')
    .select('*', { count: 'exact', head: true })

  if (error) return 0
  return count || 0
}

// Check if current user is super admin
export async function checkIsSuperAdmin(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data, error } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()

  if (error || !data) return false
  return data.is_super_admin === true
}
