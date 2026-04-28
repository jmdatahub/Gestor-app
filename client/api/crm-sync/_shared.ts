import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const CRM_SYNC_SECRET = process.env.CRM_SYNC_SECRET || ''
const TARGET_ORG_NAME = process.env.CRM_SYNC_ORG_NAME || 'Soul IA'

export function validateApiKey(req: VercelRequest, res: VercelResponse): boolean {
  if (!CRM_SYNC_SECRET) {
    console.error('[crm-sync] CRM_SYNC_SECRET not configured')
    res.status(503).json({ error: 'Service unavailable', message: 'CRM sync is not configured on this environment' })
    return false
  }
  const apiKey = req.headers['x-api-key']
  if (!apiKey || apiKey !== CRM_SYNC_SECRET) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or missing x-api-key header' })
    return false
  }
  return true
}

let cachedOrgId: string | null = null
let cachedAt = 0

export async function getTargetOrgId(): Promise<string | null> {
  const now = Date.now()
  if (cachedOrgId && now - cachedAt < 5 * 60_000) return cachedOrgId
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name')
    .ilike('name', `%${TARGET_ORG_NAME}%`)
    .limit(1)
    .single()
  if (!org) return null
  cachedOrgId = org.id
  cachedAt = now
  return cachedOrgId
}

export async function requireOrg(
  req: VercelRequest,
  res: VercelResponse,
): Promise<string | null> {
  if (!validateApiKey(req, res)) return null
  const orgId = await getTargetOrgId()
  if (!orgId) {
    res.status(404).json({
      error: 'Organization not found',
      message: `Could not find organization matching: "${TARGET_ORG_NAME}"`,
    })
    return null
  }
  return orgId
}

export function onlyGet(req: VercelRequest, res: VercelResponse): boolean {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return false
  }
  return true
}

let cachedOwnerId: string | null = null
let cachedOwnerAt = 0
export async function getOrgOwnerId(orgId: string): Promise<string | null> {
  const now = Date.now()
  if (cachedOwnerId && now - cachedOwnerAt < 5 * 60_000) return cachedOwnerId
  const { data } = await supabase
    .from('organization_members')
    .select('user_id, role')
    .eq('org_id', orgId)
    .order('role', { ascending: true })
    .limit(1)
    .single()
  if (!data) return null
  cachedOwnerId = data.user_id
  cachedOwnerAt = now
  return cachedOwnerId
}

export function getActorEmail(req: VercelRequest): string | null {
  const h = req.headers['x-actor-email']
  const val = Array.isArray(h) ? h[0] : h
  return val ? String(val).toLowerCase().trim() : null
}

export async function guard(
  req: VercelRequest,
  res: VercelResponse,
  allowedMethods: string[],
): Promise<{ orgId: string; userId: string; actorEmail: string | null } | null> {
  if (!allowedMethods.includes(req.method || '')) {
    res.status(405).json({ error: 'Method not allowed' })
    return null
  }
  const orgId = await requireOrg(req, res)
  if (!orgId) return null
  const userId = await getOrgOwnerId(orgId)
  if (!userId) {
    res.status(500).json({ error: 'No owner found for organization' })
    return null
  }
  return { orgId, userId, actorEmail: getActorEmail(req) }
}

// Reusable helpers for soft-delete + audit. Use in each handler.
export function auditCreate(actorEmail: string | null): Record<string, unknown> {
  return actorEmail ? { created_by_email: actorEmail, updated_by_email: actorEmail } : {}
}
export function auditUpdate(actorEmail: string | null): Record<string, unknown> {
  return actorEmail ? { updated_by_email: actorEmail } : {}
}

// Soft-delete by default. Pass ?hard=1 to purge.
// Trash operations: ?trash=1 in GET lists deleted rows; ?restore=1 in PATCH restores.
export function isTrashList(req: VercelRequest): boolean {
  return req.query.trash === '1' || req.query.trash === 'true'
}
export function isRestore(req: VercelRequest): boolean {
  return req.query.restore === '1' || req.query.restore === 'true'
}
export function isHardDelete(req: VercelRequest): boolean {
  return req.query.hard === '1' || req.query.hard === 'true'
}

// Generic soft-delete / restore / hard-delete helper for a single row.
// Returns { handled: true } if the request was a trash op; otherwise { handled: false }.
export async function handleTrashOps(
  req: VercelRequest,
  res: VercelResponse,
  table: string,
  orgId: string,
  actorEmail: string | null,
): Promise<boolean> {
  if (req.method === 'PATCH' && isRestore(req)) {
    const id = requireId(req, res); if (!id) return true
    const { data, error } = await supabase.from(table)
      .update({ deleted_at: null, ...auditUpdate(actorEmail) })
      .eq('id', id).eq('organization_id', orgId)
      .select().single()
    if (error) throw error
    res.status(200).json(data)
    return true
  }
  if (req.method === 'DELETE') {
    const id = requireId(req, res); if (!id) return true
    if (isHardDelete(req)) {
      const { error } = await supabase.from(table).delete().eq('id', id).eq('organization_id', orgId)
      if (error) throw error
    } else {
      const { error } = await supabase.from(table)
        .update({ deleted_at: new Date().toISOString(), ...auditUpdate(actorEmail) })
        .eq('id', id).eq('organization_id', orgId)
      if (error) throw error
    }
    res.status(200).json({ success: true })
    return true
  }
  return false
}

export function pickBody<T extends Record<string, unknown>>(body: unknown, keys: (keyof T)[]): Partial<T> {
  if (!body || typeof body !== 'object') return {}
  const src = body as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const k of keys) {
    if (src[k as string] !== undefined) out[k as string] = src[k as string]
  }
  return out as Partial<T>
}

export function requireId(req: VercelRequest, res: VercelResponse): string | null {
  const id = req.query.id
  const val = Array.isArray(id) ? id[0] : id
  if (!val) {
    res.status(400).json({ error: 'Missing ?id parameter' })
    return null
  }
  return String(val)
}

export function handleError(res: VercelResponse, err: unknown, context: string) {
  const isDev = process.env.NODE_ENV !== 'production' || process.env.VERCEL_ENV === 'development'
  let msg: string
  let detail: unknown = undefined
  if (err instanceof Error) {
    msg = err.message
    detail = isDev ? { stack: err.stack } : undefined
  } else if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>
    msg = String(e.message || e.error || JSON.stringify(err))
    detail = isDev ? e : undefined
  } else {
    msg = String(err)
  }
  console.error(`[crm-sync/${context}]`, msg, err instanceof Error ? err.stack : '')
  const body: Record<string, unknown> = { error: 'Internal server error', message: isDev ? msg : 'An unexpected error occurred', context }
  if (isDev && detail) body.detail = detail
  return res.status(500).json(body)
}

export function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
