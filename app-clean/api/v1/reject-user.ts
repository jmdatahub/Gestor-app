import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''

const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed')

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const jwt = authHeader.slice(7)
  // Verify caller identity using their JWT
  const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } }
  })
  const { data: { user: caller } } = await callerClient.auth.getUser()
  if (!caller) return res.status(401).json({ error: 'Unauthorized' })

  // Verify caller is super admin
  const { data: callerProfile } = await adminSupabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', caller.id)
    .single()

  if (!callerProfile?.is_super_admin) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { userId } = req.body
  if (!userId) return res.status(400).json({ error: 'userId required' })

  try {
    const { error } = await adminSupabase.auth.admin.deleteUser(userId)
    if (error) throw error
    return res.status(200).json({ ok: true })
  } catch (err: any) {
    console.error('reject-user error:', err)
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}
