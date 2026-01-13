import { supabase } from '../lib/supabaseClient'

export async function ensureDefaultAccountsForUser(userId: string) {
  // Check if user already has PERSONAL accounts (not org accounts)
  const { data: existingAccounts, error: fetchError } = await supabase
    .from('accounts')
    .select('id')
    .eq('user_id', userId)
    .is('organization_id', null) // Only check personal accounts!

  if (fetchError) {
    console.error('Error fetching accounts:', fetchError)
    return
  }

  // If no personal accounts exist, create defaults
  if (!existingAccounts || existingAccounts.length === 0) {
    console.log('[authService] Creating default accounts for user:', userId)
    const defaultAccounts = [
      { user_id: userId, organization_id: null, name: 'Cuenta General', type: 'general', is_active: true },
      { user_id: userId, organization_id: null, name: 'Cuenta Ahorro', type: 'savings', is_active: true }
    ]

    const { error: insertError } = await supabase
      .from('accounts')
      .insert(defaultAccounts)

    if (insertError) {
      console.error('Error creating default accounts:', insertError)
    } else {
      console.log('[authService] Default accounts created successfully')
    }
  }
}
