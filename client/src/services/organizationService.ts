import { api } from '../lib/apiClient'

export type AppRole = 'owner' | 'admin' | 'member' | 'viewer'
export interface Organization { id: string; name: string; slug: string | null; description: string | null; parent_id: string | null }
export interface WorkspaceMember {
  org_id: string; user_id: string; role: AppRole; organization?: Organization
  profile?: { display_name?: string | null; email?: string | null; avatar_type?: string | null } | null
}
export interface OrganizationInvitation {
  id: string; org_id: string; invitee_email: string; role: AppRole
  invited_by: string; accepted_at: string | null; created_at: string
  // Compat aliases
  email?: string
  organization?: { id: string; name: string } | null
}

// OrganizationMember alias for WorkspaceMember
export type OrganizationMember = WorkspaceMember

// PendingInvitation alias
export type PendingInvitation = OrganizationInvitation

export async function getUserOrganizations(_userId: string): Promise<WorkspaceMember[]> {
  const { data } = await api.get<{ data: (Organization & { role: AppRole })[] }>('/api/v1/organizations')
  return data.map(o => ({ org_id: o.id, user_id: '', role: o.role, organization: o }))
}

export async function createOrganization(
  _userIdOrName: string,
  options?: { name?: string; description?: string; parent_id?: string } | string,
): Promise<Organization> {
  let name: string; let description: string | undefined; let parent_id: string | undefined
  if (typeof options === 'object' && options !== null) {
    name = options.name ?? _userIdOrName
    description = options.description
    parent_id = options.parent_id
  } else {
    name = typeof options === 'string' ? options : _userIdOrName
  }
  const { data } = await api.post<{ data: Organization }>('/api/v1/organizations', { name, description, parent_id })
  return data
}

export async function updateOrganization(id: string, updates: Partial<Organization>): Promise<Organization> {
  const { data } = await api.patch<{ data: Organization }>(`/api/v1/organizations/${id}`, updates)
  return data
}

export async function deleteOrganization(id: string): Promise<void> {
  await api.delete(`/api/v1/organizations/${id}`)
}

export async function getOrganizationMembers(orgId: string): Promise<WorkspaceMember[]> {
  const { data } = await api.get<{ data: WorkspaceMember[] }>(`/api/v1/organizations/${orgId}/members`)
  return data
}

export async function removeMember(orgId: string, userId: string): Promise<void> {
  await api.delete(`/api/v1/organizations/${orgId}/members/${userId}`)
}

export async function updateMemberRole(orgId: string, userId: string, role: AppRole): Promise<void> {
  await api.patch(`/api/v1/organizations/${orgId}/members/${userId}`, { role })
}

export async function getMyPendingInvitations(email: string): Promise<OrganizationInvitation[]> {
  const { data } = await api.get<{ data: OrganizationInvitation[] }>('/api/v1/organizations/invitations/pending', { email })
  return data
}

export async function createInvitation(orgId: string, inviteeEmail: string, role: AppRole): Promise<OrganizationInvitation> {
  const { data } = await api.post<{ data: OrganizationInvitation }>(`/api/v1/organizations/${orgId}/invitations`, { invitee_email: inviteeEmail, role })
  return data
}

export async function cancelInvitation(orgIdOrInvId: string, invId?: string): Promise<void> {
  if (invId) {
    await api.delete(`/api/v1/organizations/${orgIdOrInvId}/invitations/${invId}`)
  } else {
    // Single-arg: invId only, org unknown — try generic endpoint
    await api.delete(`/api/v1/organizations/invitations/${orgIdOrInvId}`)
  }
}

// ---- Backward-compat aliases & helpers ----

export async function getOrganizationById(id: string): Promise<Organization | null> {
  const { data } = await api.get<{ data: Organization }>(`/api/v1/organizations/${id}`)
  return data
}

export async function getOrganizationInvitations(orgId: string): Promise<OrganizationInvitation[]> {
  const { data } = await api.get<{ data: OrganizationInvitation[] }>(`/api/v1/organizations/${orgId}/invitations`)
  // Normalize email field
  return data.map(inv => ({ ...inv, email: inv.email ?? inv.invitee_email }))
}

export async function inviteMember(orgId: string, email: string, role: AppRole): Promise<OrganizationInvitation> {
  return createInvitation(orgId, email, role)
}

export async function acceptInvitation(invitationId: string, _userId?: string): Promise<void> {
  await api.post(`/api/v1/organizations/invitations/${invitationId}/accept`, {})
}

export async function declineInvitation(invitationId: string): Promise<void> {
  await api.post(`/api/v1/organizations/invitations/${invitationId}/decline`, {})
}
