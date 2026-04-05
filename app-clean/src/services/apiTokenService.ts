/**
 * API Token Service v2
 * Handles CRUD for API tokens with granular scopes and workspace support
 */
import { supabase } from '../lib/supabaseClient'

// All available scopes
export const API_SCOPES = [
  { id: 'movements:read',    label: 'Movimientos — Leer',         group: 'Movimientos' },
  { id: 'movements:write',   label: 'Movimientos — Crear',        group: 'Movimientos' },
  { id: 'accounts:read',     label: 'Cuentas — Leer',             group: 'Cuentas' },
  { id: 'categories:read',   label: 'Categorías — Leer',          group: 'Categorías' },
  { id: 'debts:read',        label: 'Deudas — Leer',              group: 'Deudas' },
  { id: 'debts:write',       label: 'Deudas — Crear/Editar',      group: 'Deudas' },
  { id: 'savings:read',      label: 'Ahorros — Leer',             group: 'Ahorros' },
  { id: 'savings:write',     label: 'Ahorros — Crear/Editar',     group: 'Ahorros' },
  { id: 'investments:read',  label: 'Inversiones — Leer',         group: 'Inversiones' },
  { id: 'investments:write', label: 'Inversiones — Crear/Editar', group: 'Inversiones' },
] as const

export type ApiScope = typeof API_SCOPES[number]['id']

export const DEFAULT_SCOPES: ApiScope[] = [
  'movements:read',
  'movements:write',
  'accounts:read',
  'categories:read',
]

// Generate a secure random token
function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let token = 'sk_live_'
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}

// Hash using Web Crypto API (same algorithm as serverless API)
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(token)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export interface ApiToken {
  id: string
  user_id: string
  name: string
  token_hash: string
  organization_id: string | null
  scopes: ApiScope[]
  expires_at: string | null
  last_used_at: string | null
  created_at: string
  // Joined
  organization?: { id: string; name: string } | null
}

export interface CreateApiTokenInput {
  name: string
  organization_id?: string | null
  scopes?: ApiScope[]
  expires_at?: string | null
}

/**
 * Fetch all tokens for a user (with organization name joined)
 */
export async function getApiTokens(userId: string): Promise<ApiToken[]> {
  const { data, error } = await supabase
    .from('api_tokens')
    .select(`
      *,
      organization:organizations(id, name)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching API tokens:', error)
    throw error
  }
  return (data || []) as ApiToken[]
}

/**
 * Create a new API token
 * Returns the raw token (show once!) and saves the hash
 */
export async function createApiToken(
  userId: string,
  input: CreateApiTokenInput
): Promise<{ token: string; record: ApiToken }> {
  const rawToken = generateToken()
  const tokenHash = await hashToken(rawToken)

  const { data, error } = await supabase
    .from('api_tokens')
    .insert({
      user_id: userId,
      name: input.name,
      token_hash: tokenHash,
      organization_id: input.organization_id || null,
      scopes: input.scopes || DEFAULT_SCOPES,
      expires_at: input.expires_at || null,
    })
    .select(`
      *,
      organization:organizations(id, name)
    `)
    .single()

  if (error) {
    console.error('Error creating API token:', error)
    throw error
  }

  return { token: rawToken, record: data as ApiToken }
}

/**
 * Delete/Revoke a token
 */
export async function revokeApiToken(tokenId: string): Promise<void> {
  const { error } = await supabase
    .from('api_tokens')
    .delete()
    .eq('id', tokenId)

  if (error) {
    console.error('Error revoking API token:', error)
    throw error
  }
}

/**
 * Update token scopes
 */
export async function updateTokenScopes(tokenId: string, scopes: ApiScope[]): Promise<void> {
  const { error } = await supabase
    .from('api_tokens')
    .update({ scopes })
    .eq('id', tokenId)

  if (error) throw error
}
