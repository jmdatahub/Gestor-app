import { api } from '../lib/apiClient'

export type ApiScope = string

export interface ApiScopeDef {
  id: ApiScope; label: string; group: string; description?: string
}

export const API_SCOPES: ApiScopeDef[] = [
  // Movements
  { id: 'movements:read', label: 'Leer movimientos', group: 'Movimientos' },
  { id: 'movements:write', label: 'Crear/editar movimientos', group: 'Movimientos' },
  { id: 'movements:delete', label: 'Eliminar movimientos', group: 'Movimientos' },
  // Accounts
  { id: 'accounts:read', label: 'Leer cuentas', group: 'Cuentas' },
  { id: 'accounts:write', label: 'Crear/editar cuentas', group: 'Cuentas' },
  // Budgets
  { id: 'budgets:read', label: 'Leer presupuestos', group: 'Presupuestos' },
  { id: 'budgets:write', label: 'Crear/editar presupuestos', group: 'Presupuestos' },
  // Reports
  { id: 'reports:read', label: 'Leer reportes', group: 'Reportes' },
  // Global
  { id: 'global:access', label: 'Acceso global', group: 'Global' },
]

export const DEFAULT_SCOPES: ApiScope[] = ['movements:read', 'accounts:read', 'reports:read']

export interface ApiToken {
  id: string; user_id: string; organization_id?: string | null; name: string
  token: string; scopes: string[]; created_at: string; last_used_at?: string | null
  organization?: { id: string; name: string } | null
}

export interface CreateApiTokenInput {
  name: string; scopes: string[]; organization_id?: string | null
}

export async function fetchApiTokens(_userId: string): Promise<ApiToken[]> {
  const { data } = await api.get<{ data: ApiToken[] }>('/api/v1/api-tokens')
  return data
}

// Backward compat alias
export const getApiTokens = fetchApiTokens

export async function createApiToken(
  _userId: string,
  input: CreateApiTokenInput,
): Promise<{ token: string; record: ApiToken }> {
  const { data } = await api.post<{ data: { token: string; record: ApiToken } }>('/api/v1/api-tokens', {
    name: input.name,
    scopes: input.scopes,
    organization_id: input.organization_id,
  })
  return data
}

export async function updateApiTokenScopes(id: string, scopes: string[]): Promise<ApiToken> {
  const { data } = await api.patch<{ data: ApiToken }>(`/api/v1/api-tokens/${id}`, { scopes })
  return data
}

export async function revokeApiToken(id: string): Promise<void> {
  await api.delete(`/api/v1/api-tokens/${id}`)
}
