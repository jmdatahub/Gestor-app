import { supabase } from '../lib/supabaseClient'

// Types (re-using matching types from Context or defining new DTOs)
export type AppRole = 'owner' | 'admin' | 'member' | 'viewer'

export interface Organization {
  id: string
  name: string
  slug: string | null
  description: string | null
  parent_id: string | null
  created_at?: string
}

export interface OrganizationMember {
  org_id: string
  user_id: string
  role: AppRole
  profile?: {
    id: string
    email: string | null
    display_name: string | null
    avatar_type: string | null
  } | null
}

export interface CreateOrganizationInput {
  name: string
  slug?: string
  description?: string
  parent_id?: string
}

// Fetch organizations for the current user
export async function getUserOrganizations(userId: string): Promise<Organization[]> {
  const { data, error } = await supabase
    .from('organization_members')
    .select(`
      org_id,
      organization:organizations (
        id,
        name,
        slug,
        created_at
      )
    `)
    .eq('user_id', userId)

  if (error) {
    console.error('Error fetching user organizations:', error)
    throw error
  }

  // Map to flattened Organization array
  return data.map((item: any) => item.organization)
}

// Get single organization details
export async function getOrganizationById(orgId: string): Promise<Organization | null> {
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', orgId)
    .single()

  if (error) {
    console.error('Error fetching organization:', error)
    throw error
  }
  return data
}

// Create new organization
export async function createOrganization(userId: string, input: CreateOrganizationInput): Promise<Organization> {
  // 1. Create Organization
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert([{
      name: input.name,
      slug: input.slug || null,
      description: input.description || null,
      parent_id: input.parent_id || null,
      owner_id: userId  // Required for RLS policy
    }])
    .select()
    .single()

  if (orgError) throw orgError

  // 2. Add Creator as Owner in organization_members
  // The DB trigger might not be working, so we do it manually
  const { error: memberError } = await supabase
    .from('organization_members')
    .insert([{
      org_id: org.id,
      user_id: userId,
      role: 'owner'
    }])

  if (memberError) {
    console.error('Error adding creator as member:', memberError)
    // Don't throw - org was created, user just won't see it immediately
  }
  
  return org
}

// Update organization
export async function updateOrganization(orgId: string, updates: Partial<Organization>): Promise<Organization> {
  const { data, error } = await supabase
    .from('organizations')
    .update(updates)
    .eq('id', orgId)
    .select()
    .single()

  if (error) throw error
  return data
}

// Delete organization (only owner can delete)
export async function deleteOrganization(orgId: string): Promise<void> {
  const { error } = await supabase
    .from('organizations')
    .delete()
    .eq('id', orgId)

  if (error) throw error
}

// Get members of an organization
export async function getOrganizationMembers(orgId: string): Promise<OrganizationMember[]> {
  // Step 1: Get organization members
  const { data: membersData, error: membersError } = await supabase
    .from('organization_members')
    .select('org_id, user_id, role')
    .eq('org_id', orgId)

  if (membersError) {
    console.error('Error fetching organization members:', membersError)
    throw membersError
  }

  if (!membersData || membersData.length === 0) {
    return []
  }

  console.log('[DEBUG] Members data:', membersData)

  // Step 2: Get profiles for all member user_ids
  const userIds = membersData.map(m => m.user_id)
  console.log('[DEBUG] Fetching profiles for user IDs:', userIds)
  
  const { data: profilesData, error: profilesError } = await supabase
    .from('profiles')
    .select('id, email, display_name, avatar_type')
    .in('id', userIds)

  console.log('[DEBUG] Profiles data:', profilesData)
  console.log('[DEBUG] Profiles error:', profilesError)

  if (profilesError) {
    console.warn('Could not fetch profiles, returning members without profile data:', profilesError)
    return membersData.map(m => ({ ...m, profile: null }))
  }

  // Step 3: Map profiles to members
  const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || [])
  console.log('[DEBUG] Profiles map size:', profilesMap.size)
  
  return membersData.map(m => ({
    org_id: m.org_id,
    user_id: m.user_id,
    role: m.role as AppRole,
    profile: profilesMap.get(m.user_id) || null
  }))
}

// Invite member (Mock implementation for now or direct insert if allowed)
export async function inviteMember(orgId: string, email: string, role: AppRole): Promise<void> {
  // In a real app, this would verify email exists in auth.users (via Edge Function) or send an invite.
  // For this "Hard Tenant" / "Shadow" pivot, we might just want to Add Member by ID if we know it, 
  // or simple visual simulation if we lack the backend for email lookup.
  
  // For now, let's just log it. Real implementation requires backend function to lookup user_id by email.
  console.log('Inviting member:', { orgId, email, role })
  
  // TODO: Call an Edge Function `invite-user`
  // await supabase.functions.invoke('invite-user', { body: { orgId, email, role } })
  
  throw new Error("Invitation system requires backend function (not implemented yet).")
}

// Remove member
export async function removeMember(orgId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('organization_members')
    .delete()
    .match({ org_id: orgId, user_id: userId })

  if (error) throw error
}

// Update member role
export async function updateMemberRole(orgId: string, userId: string, role: AppRole): Promise<void> {
  const { error } = await supabase
    .from('organization_members')
    .update({ role })
    .match({ org_id: orgId, user_id: userId })

  if (error) throw error
}

// Organization Invitation Type
export interface OrganizationInvitation {
  id: string
  org_id: string
  email: string
  role: AppRole
  invited_by: string | null
  expires_at: string
  created_at: string
}

// Get pending invitations for an organization
export async function getOrganizationInvitations(orgId: string): Promise<OrganizationInvitation[]> {
  const { data, error } = await supabase
    .from('organization_invitations')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching invitations:', error)
    return []
  }

  return data as OrganizationInvitation[]
}

// Cancel/delete an invitation
export async function cancelInvitation(invitationId: string): Promise<void> {
  const { error } = await supabase
    .from('organization_invitations')
    .delete()
    .eq('id', invitationId)

  if (error) throw error
}

