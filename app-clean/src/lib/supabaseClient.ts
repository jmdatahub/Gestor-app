import { createClient } from '@supabase/supabase-js'

// Supabase Instance: Gestor-app (Project ID: pruiccptamjzemedwhdq)
// Account: JMREFER1
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
