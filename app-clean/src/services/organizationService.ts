import { supabase } from '../lib/supabaseClient'

// Types (re-using matching types from Context or defining new DTOs)
export type AppRole = 'owner' | 'admin' | 'member' | 'viewer'

export interface Organization {
  id: string
  name: string
  slug: string | null
  created_at?: string
}

export interface OrganizationMember {
  org_id: string
  user_id: string
  role: AppRole
  user?: {
    email: string
    id: string
  }
}

export interface CreateOrganizationInput {
  name: string
  slug?: string
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
      slug: input.slug || null
    }])
    .select()
    .single()

  if (orgError) throw orgError

  // 2. Add Creator as Owner (Should be handled by DB Trigger usually, but let's be safe or check if trigger exists)
  // Checking MIG_001_v2: "AFTER INSERT ON organizations FOR EACH ROW EXECUTE FUNCTION public.handle_new_organization();"
  // This trigger adds the creator as owner. So we don't need to manually insert into organization_members IF the trigger works correctly with RLS.
  // However, the trigger uses auth.uid(). If we are calling this from frontend, auth.uid() is set.
  
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

// Get members of an organization
export async function getOrganizationMembers(orgId: string): Promise<OrganizationMember[]> {
  // We need to join with auth.users to get emails. 
  // NOTE: accessing auth.users directly from client is usually restricted. 
  // We might depend on a view or public profile table if it exists. 
  // Checking MIG_001: It creates "profiles" table? No, but maybe "public_profiles"?
  // If not, we might only get user_id. 
  // Let's assume for now we might fail getting emails if policies don't allow it. 
  
  // Actually, usually one syncs auth.users to a public "users" or "profiles" table.
  // Let's check if we have a way to get user info. 
  // If not, we simply return IDs or basic info.
  
  const { data, error } = await supabase
    .from('organization_members')
    .select('*')
    .eq('org_id', orgId)

  if (error) throw error

  // IMPORTANT: We cannot join auth.users directly in standard Supabase client queries easily if not exposed.
  // For this MVF, we might just display User ID or look for a profile table. 
  // I will check for 'profiles' table existence in next steps.
  
  return data as OrganizationMember[]
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
