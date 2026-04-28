import { api } from '../lib/apiClient'

export interface Provider { id: string; user_id: string; name: string; category?: string | null; usage_count: number; last_used_at?: string | null; created_at: string }

export async function searchProviders(_userId: string, query: string, _orgId?: string | null): Promise<Provider[]> {
  const { data } = await api.get<{ data: Provider[] }>('/api/v1/providers', { q: query })
  return data
}

export async function fetchAllProviders(_userId: string): Promise<Provider[]> {
  const { data } = await api.get<{ data: Provider[] }>('/api/v1/providers')
  return data
}

export async function createProvider(name: string, category?: string): Promise<Provider> {
  const { data } = await api.post<{ data: Provider }>('/api/v1/providers', { name, category })
  return data
}

export async function updateProviderUsage(id: string): Promise<void> {
  await api.patch(`/api/v1/providers/${id}`, { last_used_at: new Date().toISOString() })
}

// Upsert: find by name or create new
// Support (name, category?) and (userId, name, orgId?) calling conventions
export async function upsertProvider(nameOrUserId: string, nameOrCategory?: string, _orgId?: string | null): Promise<Provider> {
  // If second arg looks like a name (not undefined) and third arg exists, treat as (userId, name, orgId)
  const name = (_orgId !== undefined || (nameOrCategory && nameOrCategory.length > 0 && nameOrUserId.length === 36))
    ? (nameOrCategory ?? nameOrUserId)
    : nameOrUserId
  const providers = await searchProviders('', name)
  const existing = providers.find(p => p.name.toLowerCase() === name.toLowerCase())
  if (existing) {
    await updateProviderUsage(existing.id)
    return existing
  }
  return createProvider(name)
}
