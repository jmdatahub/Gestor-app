// Provider Service - Autocomplete functionality for providers
import { supabase } from '../lib/supabaseClient'

export interface Provider {
  id: string
  user_id: string
  organization_id: string | null
  name: string
  usage_count: number
  last_used_at: string
  created_at: string
}

// Search providers for autocomplete (returns top 10 matches)
export async function searchProviders(
  userId: string,
  query: string,
  organizationId?: string | null
): Promise<Provider[]> {
  if (!query || query.length < 1) return []

  let dbQuery = supabase
    .from('providers')
    .select('*')
    .eq('user_id', userId)
    .ilike('name', `%${query}%`)
    .order('usage_count', { ascending: false })
    .limit(10)

  const { data, error } = await dbQuery

  if (error) {
    console.error('Error searching providers:', error)
    return []
  }

  return data || []
}

// Get all providers (ordered by usage)
export async function getProviders(userId: string, organizationId?: string | null): Promise<Provider[]> {
  const { data, error } = await supabase
    .from('providers')
    .select('*')
    .eq('user_id', userId)
    .order('usage_count', { ascending: false })
    .limit(50)

  if (error) {
    console.error('Error fetching providers:', error)
    return []
  }

  return data || []
}

// Create or update a provider (increment usage if exists)
export async function upsertProvider(
  userId: string,
  name: string,
  organizationId?: string | null
): Promise<Provider | null> {
  const trimmedName = name.trim()
  if (!trimmedName) return null

  // Check if exists
  const { data: existing } = await supabase
    .from('providers')
    .select('*')
    .eq('user_id', userId)
    .ilike('name', trimmedName)
    .single()

  if (existing) {
    // Update usage count
    const { data, error } = await supabase
      .from('providers')
      .update({
        usage_count: existing.usage_count + 1,
        last_used_at: new Date().toISOString()
      })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating provider:', error)
      return null
    }
    return data
  } else {
    // Create new
    const { data, error } = await supabase
      .from('providers')
      .insert({
        user_id: userId,
        organization_id: organizationId || null,
        name: trimmedName
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating provider:', error)
      return null
    }
    return data
  }
}

// Delete a provider
export async function deleteProvider(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('providers')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting provider:', error)
    return false
  }

  return true
}
