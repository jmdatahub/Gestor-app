import { api } from '../lib/apiClient'

export interface UserProfile {
  id: string; email: string; display_name: string | null; avatar_url: string | null
  is_suspended: boolean; is_approved: boolean; created_at: string; role?: string
  // Extra fields used by AdminPanel
  is_super_admin?: boolean
  telegram_chat_id?: string | null
}

export interface AdminOrganization {
  id: string; name: string; slug: string | null; description: string | null
  parent_id: string | null; created_at?: string; deleted_at?: string | null
  member_count?: number
}

export interface DatabaseHealth {
  status: 'ok' | 'degraded' | 'error'; latencyMs: number; message?: string
  profilesExists?: boolean
}

export async function listUsers(): Promise<UserProfile[]> {
  const { data } = await api.get<{ data: UserProfile[] }>('/api/v1/profiles')
  return data
}

export async function suspendUser(userId: string, suspended = true): Promise<void> {
  await api.patch(`/api/v1/profiles/${userId}`, { is_suspended: suspended })
}

export async function unsuspendUser(userId: string): Promise<void> {
  return suspendUser(userId, false)
}

export async function approveUser(userId: string): Promise<void> {
  await api.patch(`/api/v1/profiles/${userId}`, { is_approved: true })
}

export async function rejectUser(userId: string): Promise<void> {
  await api.patch(`/api/v1/profiles/${userId}`, { is_approved: false })
}

// ---- Backward-compat aliases & helpers ----

export const getAllUsers = listUsers

export async function getUserCount(): Promise<number> {
  const users = await listUsers()
  return users.length
}

export async function getSuspendedCount(): Promise<number> {
  const users = await listUsers()
  return users.filter(u => u.is_suspended).length
}

export async function getOrganizationCount(): Promise<number> {
  const orgs = await getAllOrganizations()
  return orgs.length
}

export async function deleteUserProfile(userId: string): Promise<void> {
  await api.delete(`/api/v1/profiles/${userId}`)
}

export async function checkIsSuperAdmin(): Promise<boolean> {
  try {
    const { data } = await api.get<{ data: { is_super_admin: boolean } }>('/api/v1/admin/me')
    return data.is_super_admin
  } catch { return false }
}

export async function getAllOrganizations(): Promise<AdminOrganization[]> {
  const { data } = await api.get<{ data: AdminOrganization[] }>('/api/v1/admin/organizations')
  return data
}

export async function getDeletedOrganizations(): Promise<AdminOrganization[]> {
  const { data } = await api.get<{ data: AdminOrganization[] }>('/api/v1/admin/organizations/deleted')
  return data
}

export async function updateOrganization(id: string, updates: Partial<AdminOrganization>): Promise<AdminOrganization> {
  const { data } = await api.patch<{ data: AdminOrganization }>(`/api/v1/admin/organizations/${id}`, updates)
  return data
}

export async function deleteOrganization(id: string): Promise<void> {
  await api.delete(`/api/v1/admin/organizations/${id}`)
}

export async function restoreOrganization(id: string): Promise<void> {
  await api.post(`/api/v1/admin/organizations/${id}/restore`, {})
}

export async function permanentDeleteOrganization(id: string): Promise<void> {
  await api.delete(`/api/v1/admin/organizations/${id}/permanent`)
}

export async function purgeExpiredOrganizations(): Promise<void> {
  await api.post('/api/v1/admin/organizations/purge', {})
}

export async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  try {
    const start = Date.now()
    await api.get('/api/v1/health')
    return { status: 'ok', latencyMs: Date.now() - start, profilesExists: true }
  } catch {
    return { status: 'error', latencyMs: -1, message: 'Failed to reach server', profilesExists: false }
  }
}

export async function getPendingUsers(): Promise<UserProfile[]> {
  const users = await listUsers()
  return users.filter(u => !u.is_approved)
}

export async function getPendingCount(): Promise<number> {
  const pending = await getPendingUsers()
  return pending.length
}
