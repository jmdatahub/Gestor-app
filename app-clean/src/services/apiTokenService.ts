/**
 * API Token Service
 * Handles CRUD for API tokens and validation
 */
import { supabase } from '../lib/supabaseClient'

// Generate a secure random token prefix
function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let token = 'sk_live_'
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}

// Simple hash function using Web Crypto API
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
  permissions: string[]
  last_used_at: string | null
  created_at: string
}

/**
 * Fetch all tokens for a user (hashes only, not real tokens)
 */
export async function getApiTokens(userId: string): Promise<ApiToken[]> {
  const { data, error } = await supabase
    .from('api_tokens')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching API tokens:', error)
    throw error
  }
  return data || []
}

/**
 * Create a new API token
 * Returns the raw token (show once!) and saves the hash
 */
export async function createApiToken(
  userId: string,
  name: string,
  permissions: string[] = ['read', 'write']
): Promise<{ token: string; record: ApiToken }> {
  const rawToken = generateToken()
  const tokenHash = await hashToken(rawToken)

  const { data, error } = await supabase
    .from('api_tokens')
    .insert({
      user_id: userId,
      name,
      token_hash: tokenHash,
      permissions
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating API token:', error)
    throw error
  }

  return { token: rawToken, record: data }
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
 * Validate a token from an incoming request
 * Returns the user_id if valid, null otherwise
 */
export async function validateApiToken(rawToken: string): Promise<string | null> {
  if (!rawToken || !rawToken.startsWith('sk_live_')) {
    return null
  }

  const tokenHash = await hashToken(rawToken)

  const { data, error } = await supabase
    .from('api_tokens')
    .select('user_id')
    .eq('token_hash', tokenHash)
    .single()

  if (error || !data) {
    return null
  }

  // Update last used (fire and forget)
  supabase.rpc('update_token_last_used', { p_token_hash: tokenHash }).then()

  return data.user_id
}
