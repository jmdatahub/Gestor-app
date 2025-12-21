import { supabase } from '../lib/supabaseClient'

export async function ensureDefaultAccountsForUser(userId: string) {
  // Check if user already has accounts
  const { data: existingAccounts, error: fetchError } = await supabase
    .from('accounts')
    .select('id')
    .eq('user_id', userId)

  if (fetchError) {
    console.error('Error fetching accounts:', fetchError)
    return
  }

  // If no accounts exist, create defaults
  if (!existingAccounts || existingAccounts.length === 0) {
    const defaultAccounts = [
      { user_id: userId, name: 'Cuenta General', type: 'general', is_active: true },
      { user_id: userId, name: 'Cuenta Ahorro', type: 'savings', is_active: true }
    ]

    const { error: insertError } = await supabase
      .from('accounts')
      .insert(defaultAccounts)

    if (insertError) {
      console.error('Error creating default accounts:', insertError)
    }
  }
}
