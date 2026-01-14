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

    return (data || []) as UserProfile[]
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

// Delete a user profile (only super admin can do this)
export async function deleteUserProfile(userId: string): Promise<void> {
  // First, remove user from all organizations
  const { error: memberError } = await supabase
    .from('organization_members')
    .delete()
    .eq('user_id', userId)
  
  if (memberError) {
    console.warn('Error removing user from orgs:', memberError)
    // Continue anyway - profile might not be in any org
  }

  // Then delete the profile
  const { error } = await supabase
    .from('profiles')
    .delete()
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

// Organization type for admin panel
export interface AdminOrganization {
  id: string
  name: string
  slug: string | null
  description: string | null
  parent_id: string | null
  created_at: string
}

// Get all organizations (for super admin) - excludes deleted
export async function getAllOrganizations(): Promise<AdminOrganization[]> {
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .is('deleted_at', null) // Exclude deleted orgs
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('Error fetching organizations (safe fallback):', error.message)
      return []
    }

    return (data || []) as AdminOrganization[]
  } catch (err) {
    console.error('Unexpected error in getAllOrganizations:', err)
    return []
  }
}

// Update organization (super admin only)
export async function updateOrganization(
  orgId: string, 
  updates: { name?: string; description?: string | null }
): Promise<void> {
  const { error } = await supabase
    .from('organizations')
    .update(updates)
    .eq('id', orgId)

  if (error) throw error
}

// Soft-delete organization (moves to trash for 7 days)
export async function deleteOrganization(orgId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  
  // Soft delete - just set deleted_at timestamp
  const { error } = await supabase
    .from('organizations')
    .update({ 
      deleted_at: new Date().toISOString(),
      deleted_by: user?.id || null
    })
    .eq('id', orgId)

  if (error) throw error
}

// Restore organization from trash
export async function restoreOrganization(orgId: string): Promise<void> {
  const { error } = await supabase
    .from('organizations')
    .update({ 
      deleted_at: null,
      deleted_by: null
    })
    .eq('id', orgId)

  if (error) throw error
}

// Get organizations in trash (deleted)
export async function getDeletedOrganizations(): Promise<AdminOrganization[]> {
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })

    if (error) {
      console.warn('Error fetching deleted organizations:', error.message)
      return []
    }

    return (data || []) as AdminOrganization[]
  } catch (err) {
    console.error('Unexpected error in getDeletedOrganizations:', err)
    return []
  }
}

// Permanently delete organization (no recovery)
export async function permanentDeleteOrganization(orgId: string): Promise<void> {
  // Delete all members
  const { error: membersError } = await supabase
    .from('organization_members')
    .delete()
    .eq('org_id', orgId)

  if (membersError) {
    console.warn('Error deleting org members:', membersError)
  }

  // Delete all invitations
  const { error: invitationsError } = await supabase
    .from('organization_invitations')
    .delete()
    .eq('org_id', orgId)

  if (invitationsError) {
    console.warn('Error deleting org invitations:', invitationsError)
  }

  // Finally permanently delete the organization
  const { error } = await supabase
    .from('organizations')
    .delete()
    .eq('id', orgId)

  if (error) throw error
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

// Purge expired organizations (older than 7 days in trash)
export async function purgeExpiredOrganizations(): Promise<number> {
  // RPC returns the count of deleted organizations
  const { data, error } = await supabase
    .rpc('cleanup_deleted_organizations')

  if (error) throw error
  return typeof data === 'number' ? data : 0
}

// Check if the profiles table exists and is accessible with correct schema
export async function checkDatabaseHealth(): Promise<{ profilesExists: boolean }> {
  try {
    // Try to select specific columns we depend on validation
    const { error } = await supabase
      .from('profiles')
      .select('id, email, is_suspended, is_super_admin')
      .limit(1)
    
    // If any error occurs (missing table 42P01, missing column 42703, etc), return false
    if (error) {
      return { profilesExists: false }
    }
    
    return { profilesExists: true }
  } catch (err) {
    return { profilesExists: false }
  }
}

