/**
 * API v1 - Movements Endpoint (Optimized)
 * Supports GET (list) and POST (create) operations
 * Requires Bearer token authentication via api_tokens table
 * 
 * Features:
 * - Comprehensive input validation
 * - Detailed error messages
 * - Automatic debt creation when paid_by_external is set
 * - Batch insert support
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// ============================================================
// Configuration
// ============================================================
// Note: VITE_ prefixed vars are NOT available in Vercel serverless functions
// We must use SUPABASE_URL (without VITE_ prefix)
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// Debug log for config issues
console.log('API Config:', {
  hasUrl: !!supabaseUrl,
  urlPrefix: supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'MISSING',
  hasServiceKey: !!supabaseServiceKey,
  keyPrefix: supabaseServiceKey ? supabaseServiceKey.substring(0, 20) + '...' : 'MISSING'
})

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('FATAL: Missing Supabase configuration. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// ============================================================
// Types
// ============================================================
interface MovementInput {
  kind: 'income' | 'expense' | 'investment'
  amount: number
  date: string
  account_id: string
  description?: string
  category_id?: string
  organization_id?: string
  provider?: string
  payment_method?: string
  tax_rate?: number
  tax_amount?: number
  is_subscription?: boolean
  subscription_end_date?: string
  auto_renew?: boolean
  paid_by_external?: string
  create_debt?: boolean
}

interface ValidationError {
  field: string
  message: string
}

// ============================================================
// Helpers
// ============================================================
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(token)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function validateToken(authHeader: string | undefined): Promise<string | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('API Auth: No Bearer header found')
    return null
  }

  const rawToken = authHeader.replace('Bearer ', '').trim()
  if (!rawToken.startsWith('sk_live_')) {
    console.log('API Auth: Token does not start with sk_live_')
    return null
  }

  try {
    const tokenHash = await hashToken(rawToken)
    console.log('API Auth: Looking for token hash:', tokenHash.substring(0, 16) + '...')

    const { data, error } = await supabase
      .from('api_tokens')
      .select('user_id')
      .eq('token_hash', tokenHash)
      .single()

    if (error) {
      console.log('API Auth: Query error:', error.message, error.code)
      return null
    }
    
    if (!data) {
      console.log('API Auth: No token found matching hash')
      return null
    }

    console.log('API Auth: Token valid for user:', data.user_id)

    // Update last_used_at (fire and forget, don't block)
    supabase.rpc('update_token_last_used', { p_token_hash: tokenHash }).catch(() => {})

    return data.user_id
  } catch (err) {
    console.log('API Auth: Unexpected error:', err)
    return null
  }
}

function validateMovement(m: any, index: number): ValidationError[] {
  const errors: ValidationError[] = []
  const prefix = index >= 0 ? `[${index}].` : ''

  // Required fields
  if (!m.kind || !['income', 'expense', 'investment'].includes(m.kind)) {
    errors.push({ field: `${prefix}kind`, message: 'Must be "income", "expense", or "investment"' })
  }

  if (m.amount === undefined || m.amount === null) {
    errors.push({ field: `${prefix}amount`, message: 'Required' })
  } else if (isNaN(Number(m.amount)) || Number(m.amount) <= 0) {
    errors.push({ field: `${prefix}amount`, message: 'Must be a positive number' })
  }

  if (!m.date) {
    errors.push({ field: `${prefix}date`, message: 'Required (format: YYYY-MM-DD)' })
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(m.date)) {
    errors.push({ field: `${prefix}date`, message: 'Invalid format. Use YYYY-MM-DD' })
  }

  if (!m.account_id) {
    errors.push({ field: `${prefix}account_id`, message: 'Required (UUID of account)' })
  } else if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(m.account_id)) {
    errors.push({ field: `${prefix}account_id`, message: 'Invalid UUID format' })
  }

  // Optional field validation
  if (m.category_id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(m.category_id)) {
    errors.push({ field: `${prefix}category_id`, message: 'Invalid UUID format' })
  }

  if (m.organization_id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(m.organization_id)) {
    errors.push({ field: `${prefix}organization_id`, message: 'Invalid UUID format' })
  }

  if (m.tax_rate !== undefined && (isNaN(Number(m.tax_rate)) || Number(m.tax_rate) < 0 || Number(m.tax_rate) > 100)) {
    errors.push({ field: `${prefix}tax_rate`, message: 'Must be between 0 and 100' })
  }

  if (m.subscription_end_date && !/^\d{4}-\d{2}-\d{2}$/.test(m.subscription_end_date)) {
    errors.push({ field: `${prefix}subscription_end_date`, message: 'Invalid format. Use YYYY-MM-DD' })
  }

  return errors
}

function prepareMovement(m: MovementInput, userId: string) {
  return {
    user_id: userId,
    organization_id: m.organization_id || null,
    account_id: m.account_id,
    kind: m.kind,
    amount: Number(m.amount),
    date: m.date,
    description: m.description?.trim() || null,
    category_id: m.category_id || null,
    provider: m.provider?.trim() || null,
    payment_method: m.payment_method?.trim() || null,
    tax_rate: m.tax_rate !== undefined ? Number(m.tax_rate) : null,
    tax_amount: m.tax_amount !== undefined ? Number(m.tax_amount) : null,
    is_subscription: Boolean(m.is_subscription),
    subscription_end_date: m.subscription_end_date || null,
    auto_renew: m.auto_renew !== undefined ? Boolean(m.auto_renew) : true,
    paid_by_external: m.paid_by_external?.trim() || null
  }
}

// ============================================================
// Main Handler
// ============================================================
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // Check configuration
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ 
      error: 'Server configuration error', 
      message: 'Missing database configuration. Contact administrator.' 
    })
  }

  // Authenticate
  const userId = await validateToken(req.headers.authorization)
  if (!userId) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Invalid or missing API token. Include header: Authorization: Bearer sk_live_...' 
    })
  }

  try {
    // ========== GET: List Movements ==========
    if (req.method === 'GET') {
      const { 
        limit = '50', 
        offset = '0', 
        kind, 
        from, 
        to, 
        organization_id,
        category_id,
        account_id,
        search
      } = req.query

      // Validate pagination
      const limitNum = Math.min(Math.max(1, Number(limit) || 50), 500)
      const offsetNum = Math.max(0, Number(offset) || 0)

      let query = supabase
        .from('movements')
        .select(`
          *,
          category:categories(id, name, color),
          account:accounts(id, name, type)
        `, { count: 'exact' })
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .range(offsetNum, offsetNum + limitNum - 1)

      // Apply filters
      if (kind && ['income', 'expense', 'investment'].includes(kind as string)) {
        query = query.eq('kind', kind)
      }
      if (from && /^\d{4}-\d{2}-\d{2}$/.test(from as string)) {
        query = query.gte('date', from)
      }
      if (to && /^\d{4}-\d{2}-\d{2}$/.test(to as string)) {
        query = query.lte('date', to)
      }
      if (organization_id) {
        query = query.eq('organization_id', organization_id)
      } else {
        query = query.is('organization_id', null)
      }
      if (category_id) {
        query = query.eq('category_id', category_id)
      }
      if (account_id) {
        query = query.eq('account_id', account_id)
      }
      if (search) {
        query = query.ilike('description', `%${search}%`)
      }

      const { data, count, error } = await query

      if (error) {
        console.error('API GET Error:', error)
        return res.status(500).json({ error: 'Database error', message: error.message })
      }

      return res.status(200).json({ 
        data: data || [], 
        count: data?.length || 0,
        total: count || 0,
        pagination: {
          limit: limitNum,
          offset: offsetNum,
          hasMore: (count || 0) > offsetNum + limitNum
        }
      })

    // ========== POST: Create Movement(s) ==========
    } else if (req.method === 'POST') {
      const body = req.body

      if (!body || (Array.isArray(body) && body.length === 0)) {
        return res.status(400).json({ 
          error: 'Bad request', 
          message: 'Request body is empty or invalid JSON' 
        })
      }

      // Support both single object and array
      const movements: MovementInput[] = Array.isArray(body) ? body : [body]

      // Validate all movements
      const allErrors: ValidationError[] = []
      movements.forEach((m, i) => {
        const errors = validateMovement(m, movements.length > 1 ? i : -1)
        allErrors.push(...errors)
      })

      if (allErrors.length > 0) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          message: 'One or more fields have invalid values',
          details: allErrors 
        })
      }

      // Prepare data
      const prepared = movements.map(m => prepareMovement(m, userId))

      // Insert movements
      const { data, error } = await supabase
        .from('movements')
        .insert(prepared)
        .select()

      if (error) {
        console.error('API POST Error:', error)
        
        // Provide helpful error messages
        let message = error.message
        if (error.code === '23503') {
          message = 'Foreign key error: account_id or category_id does not exist'
        } else if (error.code === '23505') {
          message = 'Duplicate entry detected'
        }
        
        return res.status(400).json({ error: 'Insert failed', message })
      }

      // Handle automatic debt creation
      const debtsCreated: string[] = []
      for (let i = 0; i < movements.length; i++) {
        const m = movements[i]
        const created = data?.[i]
        
        if (m.paid_by_external && m.create_debt && created) {
          try {
            const { data: debtData } = await supabase
              .from('debts')
              .insert({
                user_id: userId,
                organization_id: m.organization_id || null,
                direction: 'i_owe',
                counterparty_name: m.paid_by_external,
                total_amount: Number(m.amount),
                remaining_amount: Number(m.amount),
                description: `API: ${m.description || 'Gasto'}`,
                is_closed: false
              })
              .select('id')
              .single()

            if (debtData) {
              debtsCreated.push(debtData.id)
              // Link debt to movement
              await supabase
                .from('movements')
                .update({ linked_debt_id: debtData.id })
                .eq('id', created.id)
            }
          } catch (debtErr) {
            console.error('Debt creation error:', debtErr)
            // Continue without failing the whole request
          }
        }
      }

      return res.status(201).json({ 
        success: true, 
        created: data?.length || 0,
        debts_created: debtsCreated.length,
        data 
      })

    } else {
      return res.status(405).json({ 
        error: 'Method not allowed', 
        message: `${req.method} is not supported. Use GET or POST.` 
      })
    }

  } catch (err: any) {
    console.error('API Unhandled Error:', err)
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: 'An unexpected error occurred. Please try again.' 
    })
  }
}
