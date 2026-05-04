import { Router, Request, Response } from 'express'
import { db } from '../db/connection.js'
import { sql } from 'drizzle-orm'
import rateLimit from 'express-rate-limit'
import crypto from 'crypto'

const router = Router()

// ─── Rate limiting ────────────────────────────────────────────────────────────
// CRM sync endpoints: 60 requests per minute per IP (prevents hammering)
const crmLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down' },
})
router.use(crmLimiter)

// ─── Auth ─────────────────────────────────────────────────────────────────────

function validateApiKey(req: Request, res: Response): boolean {
  const secret = process.env.CRM_SYNC_SECRET
  if (!secret) {
    res.status(503).json({ error: 'CRM sync not configured on this server' })
    return false
  }
  const keyHeader = req.headers['x-api-key']
  const key = Array.isArray(keyHeader) ? keyHeader[0] : keyHeader
  if (!key) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or missing x-api-key header' })
    return false
  }
  // Timing-safe comparison to prevent timing attacks
  try {
    const secretBuf = Buffer.from(secret)
    const keyBuf = Buffer.from(key)
    if (secretBuf.length !== keyBuf.length || !crypto.timingSafeEqual(secretBuf, keyBuf)) {
      res.status(401).json({ error: 'Unauthorized', message: 'Invalid or missing x-api-key header' })
      return false
    }
  } catch {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or missing x-api-key header' })
    return false
  }
  return true
}

const _isProd = process.env.NODE_ENV === 'production'

// ─── Org resolution (cached 5 min) ────────────────────────────────────────────

let _cachedOrgId: string | null = null
let _cachedUserId: string | null = null
let _cachedAt = 0
const ORG_TTL = 5 * 60_000

async function resolveOrg(res: Response): Promise<{ orgId: string; userId: string } | null> {
  const now = Date.now()
  if (_cachedOrgId && _cachedUserId && now - _cachedAt < ORG_TTL) {
    return { orgId: _cachedOrgId, userId: _cachedUserId }
  }
  const name = process.env.CRM_SYNC_ORG_NAME || 'Soul IA'
  try {
    const orgs = await db.execute(sql`
      SELECT id FROM organizations WHERE name ILIKE ${'%' + name + '%'} LIMIT 1
    `)
    const orgId = (orgs as any[])[0]?.id as string | undefined
    if (!orgId) {
      res.status(404).json({ error: 'Organization not found', message: `No organization matching "${name}"` })
      return null
    }
    const members = await db.execute(sql`
      SELECT user_id FROM organization_members
      WHERE org_id = ${orgId}
      ORDER BY role ASC LIMIT 1
    `)
    const userId = (members as any[])[0]?.user_id as string | undefined
    if (!userId) {
      res.status(500).json({ error: 'No owner found for organization' })
      return null
    }
    _cachedOrgId = orgId
    _cachedUserId = userId
    _cachedAt = now
    return { orgId, userId }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[crm-sync/resolveOrg]', msg)
    // Never expose DB internals in production
    res.status(500).json({
      error: 'Database error resolving organization',
      ...(_isProd ? {} : { message: msg }),
    })
    return null
  }
}

function getActorEmail(req: Request): string | null {
  const h = req.headers['x-actor-email']
  const val = Array.isArray(h) ? h[0] : h
  return val ? String(val).toLowerCase().trim() : null
}

function q(v: unknown): string | null {
  if (v === undefined || v === null || v === '') return null
  return String(v)
}
function num(v: unknown, def = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : def
}
function isTrash(req: Request) { return req.query.trash === '1' || req.query.trash === 'true' }
function isRestore(req: Request) { return req.query.restore === '1' || req.query.restore === 'true' }
function isHard(req: Request) { return req.query.hard === '1' || req.query.hard === 'true' }

function handleError(res: Response, err: unknown, ctx: string) {
  const msg = err instanceof Error ? err.message : String(err)
  console.error(`[crm-sync/${ctx}]`, msg)
  // Never expose internal error details (DB messages, table names) in production
  return res.status(500).json({
    error: 'Internal server error',
    context: ctx,
    ...(_isProd ? {} : { message: msg }),
  })
}

// ─── Retry helper ─────────────────────────────────────────────────────────────
// Retries a DB operation up to `maxAttempts` times on transient errors.
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3, delayMs = 300): Promise<T> {
  let lastErr: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      const msg = err instanceof Error ? err.message : String(err)
      // Only retry on transient/connection errors
      const isTransient = /connection|timeout|ECONNRESET|ETIMEDOUT|deadlock/i.test(msg)
      if (!isTransient || attempt === maxAttempts) throw err
      console.warn(`[crm-sync/retry] attempt ${attempt} failed (${msg}), retrying in ${delayMs}ms`)
      await new Promise(resolve => setTimeout(resolve, delayMs * attempt))
    }
  }
  throw lastErr
}

// ─── Middleware ───────────────────────────────────────────────────────────────

router.use((req, res, next) => {
  if (!validateApiKey(req, res)) return
  next()
})

// ─── Overview ─────────────────────────────────────────────────────────────────

router.get('/overview', async (req: Request, res: Response) => {
  const ctx = await resolveOrg(res)
  if (!ctx) return
  const { orgId } = ctx

  if (req.query.mode === 'user-activity') {
    const email = q(req.query.email)
    if (!email) return res.status(400).json({ error: 'Missing email' })
    const lim = Math.min(200, Math.max(10, num(req.query.limit, 50)))

    const TABLES = [
      { name: 'movements',      label: 'Movimiento',  titleCol: 'description' },
      { name: 'accounts',       label: 'Cuenta',       titleCol: 'name' },
      { name: 'categories',     label: 'Categoría',    titleCol: 'name' },
      { name: 'recurring_rules',label: 'Recurrente',   titleCol: 'description' },
      { name: 'debts',          label: 'Deuda',        titleCol: 'counterparty_name' },
      { name: 'savings_goals',  label: 'Ahorro',       titleCol: 'name' },
      { name: 'investments',    label: 'Inversión',    titleCol: 'name' },
    ]

    type Row = { table: string; id: string; action: 'create' | 'update' | 'delete'; at: string; label: string }
    const out: Row[] = []

    for (const t of TABLES) {
      try {
        const rows: any[] = await db.execute(sql`
          SELECT id, created_at, updated_at, deleted_at,
                 created_by_email, updated_by_email,
                 COALESCE(${sql.raw(t.titleCol)}::text, '') AS title
          FROM ${sql.raw(t.name)}
          WHERE organization_id = ${orgId}
            AND (created_by_email = ${email} OR updated_by_email = ${email})
          ORDER BY updated_at DESC
          LIMIT ${lim}
        `) as any[]
        for (const r of rows) {
          const label = `${t.label}: ${r.title || '(sin título)'}`
          if (r.created_by_email === email && r.created_at) {
            out.push({ table: t.name, id: r.id, action: 'create', at: r.created_at, label })
          }
          if (r.deleted_at && r.updated_by_email === email) {
            out.push({ table: t.name, id: r.id, action: 'delete', at: r.deleted_at, label })
          } else if (r.updated_by_email === email && r.updated_at && r.updated_at !== r.created_at) {
            out.push({ table: t.name, id: r.id, action: 'update', at: r.updated_at, label })
          }
        }
      } catch { /* skip table on error */ }
    }

    out.sort((a, b) => b.at.localeCompare(a.at))
    return res.status(200).json({ email, items: out.slice(0, lim) })
  }

  try {
    const now = new Date()
    const currentMonth = now.toISOString().slice(0, 7)
    const monthStart = `${currentMonth}-01`

    const [movRows, accRows, debtRows, goalRows, invRows, recRows] = await Promise.all([
      db.execute(sql`SELECT kind, amount, date, category_id, is_subscription FROM movements WHERE organization_id = ${orgId}`),
      db.execute(sql`SELECT id, name, balance, type, currency, is_active, color, icon FROM accounts WHERE organization_id = ${orgId}`),
      db.execute(sql`SELECT direction, remaining_amount, is_closed FROM debts WHERE organization_id = ${orgId}`),
      db.execute(sql`SELECT target_amount, current_amount, status FROM savings_goals WHERE organization_id = ${orgId}`),
      db.execute(sql`SELECT quantity, buy_price, current_price FROM investments WHERE organization_id = ${orgId}`),
      db.execute(sql`SELECT kind, amount, frequency, is_active FROM recurring_rules WHERE organization_id = ${orgId}`),
    ])

    const movs = movRows as any[]
    const accs = accRows as any[]
    const debts = debtRows as any[]
    const goals = goalRows as any[]
    const invs = invRows as any[]
    const recs = recRows as any[]

    let totalIncome = 0, totalExpense = 0, monthIncome = 0, monthExpense = 0, subscriptionCount = 0
    const byCatMap = new Map<string, { income: number; expense: number; count: number }>()
    const monthlyMap = new Map<string, { income: number; expense: number }>()

    for (const m of movs) {
      const amt = Number(m.amount) || 0
      if (m.kind === 'income') totalIncome += amt
      else if (m.kind === 'expense') totalExpense += amt
      if (m.is_subscription) subscriptionCount++
      if (m.date && String(m.date) >= monthStart) {
        if (m.kind === 'income') monthIncome += amt
        else if (m.kind === 'expense') monthExpense += amt
      }
      if (m.date) {
        const mk = String(m.date).slice(0, 7)
        const e = monthlyMap.get(mk) || { income: 0, expense: 0 }
        if (m.kind === 'income') e.income += amt; else if (m.kind === 'expense') e.expense += amt
        monthlyMap.set(mk, e)
      }
      if (m.category_id) {
        const e = byCatMap.get(m.category_id) || { income: 0, expense: 0, count: 0 }
        if (m.kind === 'income') e.income += amt; else if (m.kind === 'expense') e.expense += amt
        e.count++
        byCatMap.set(m.category_id, e)
      }
    }

    const monthlyTrend = [...monthlyMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b)).slice(-12)
      .map(([month, v]) => ({ month, income: r2(v.income), expense: r2(v.expense) }))

    const catIds = [...byCatMap.keys()]
    const cats = catIds.length
      ? await db.execute(sql`SELECT id, name, color, icon, kind FROM categories WHERE id = ANY(${catIds}::uuid[])`)
      : []
    const catMap = new Map((cats as any[]).map(c => [c.id, c]))
    const byCategory = [...byCatMap.entries()].map(([id, v]) => ({
      id, name: catMap.get(id)?.name || 'Sin categoría',
      color: catMap.get(id)?.color || null, icon: catMap.get(id)?.icon || null, kind: catMap.get(id)?.kind || null,
      income: r2(v.income), expense: r2(v.expense), total: r2(v.income + v.expense), count: v.count,
    })).sort((a, b) => b.total - a.total)

    const totalBalance = accs.reduce((s: number, a: any) => s + (Number(a.balance) || 0), 0)
    let iOwe = 0, theyOweMe = 0
    for (const d of debts) {
      if (d.is_closed) continue
      const r = Number(d.remaining_amount) || 0
      if (d.direction === 'i_owe') iOwe += r; else if (d.direction === 'they_owe_me') theyOweMe += r
    }
    let savingsTarget = 0, savingsCurrent = 0
    for (const g of goals) {
      if (g.status !== 'active') continue
      savingsTarget += Number(g.target_amount) || 0
      savingsCurrent += Number(g.current_amount) || 0
    }
    let invCost = 0, invValue = 0
    for (const i of invs) {
      const qty = Number(i.quantity) || 0, buy = Number(i.buy_price) || 0, cur = Number(i.current_price) || buy
      invCost += qty * buy; invValue += qty * cur
    }
    let recMonthlyIncome = 0, recMonthlyExpense = 0
    for (const r of recs) {
      if (!r.is_active) continue
      const amt = Number(r.amount) || 0
      const f = r.frequency === 'daily' ? 30 : r.frequency === 'weekly' ? 4.345 : r.frequency === 'yearly' ? 1 / 12 : 1
      if (r.kind === 'income') recMonthlyIncome += amt * f; else recMonthlyExpense += amt * f
    }

    return res.status(200).json({
      generatedAt: new Date().toISOString(),
      allTime: { income: r2(totalIncome), expense: r2(totalExpense), profit: r2(totalIncome - totalExpense) },
      currentMonth: { month: currentMonth, income: r2(monthIncome), expense: r2(monthExpense), profit: r2(monthIncome - monthExpense) },
      accounts: { count: accs.length, totalBalance: r2(totalBalance), items: accs },
      debts: { iOwe: r2(iOwe), theyOweMe: r2(theyOweMe), net: r2(theyOweMe - iOwe) },
      savings: { targetTotal: r2(savingsTarget), currentTotal: r2(savingsCurrent), progress: savingsTarget > 0 ? Math.round((savingsCurrent / savingsTarget) * 1000) / 10 : 0 },
      investments: { costBasis: r2(invCost), currentValue: r2(invValue), gainLoss: r2(invValue - invCost), gainLossPct: invCost > 0 ? Math.round(((invValue - invCost) / invCost) * 10000) / 100 : 0 },
      recurring: { monthlyIncome: r2(recMonthlyIncome), monthlyExpense: r2(recMonthlyExpense), monthlyNet: r2(recMonthlyIncome - recMonthlyExpense), activeCount: recs.filter((r: any) => r.is_active).length },
      subscriptions: { count: subscriptionCount },
      netWorth: r2(totalBalance + invValue + theyOweMe - iOwe),
      monthlyTrend,
      byCategory,
    })
  } catch (err) {
    return handleError(res, err, 'overview')
  }
})

function r2(n: number) { return Math.round(n * 100) / 100 }

// ─── Summary (legacy) ─────────────────────────────────────────────────────────

router.get('/summary', async (req: Request, res: Response) => {
  const ctx = await resolveOrg(res)
  if (!ctx) return
  const { orgId } = ctx
  try {
    const rows = await db.execute(sql`SELECT kind, amount, date, category_id FROM movements WHERE organization_id = ${orgId} ORDER BY date ASC`)
    const movs = rows as any[]
    let totalIncome = 0, totalExpenses = 0
    const monthlyMap: Record<string, { income: number; expenses: number }> = {}
    const byCatMap: Record<string, { total: number; count: number }> = {}
    for (const m of movs) {
      const amt = Number(m.amount) || 0
      if (m.kind === 'income') totalIncome += amt; else if (m.kind === 'expense') totalExpenses += amt
      if (m.date) {
        const mk = String(m.date).slice(0, 7)
        if (!monthlyMap[mk]) monthlyMap[mk] = { income: 0, expenses: 0 }
        if (m.kind === 'income') monthlyMap[mk].income += amt; else if (m.kind === 'expense') monthlyMap[mk].expenses += amt
      }
      if (m.category_id) {
        if (!byCatMap[m.category_id]) byCatMap[m.category_id] = { total: 0, count: 0 }
        byCatMap[m.category_id].total += amt; byCatMap[m.category_id].count++
      }
    }
    const catIds = Object.keys(byCatMap)
    const cats = catIds.length
      ? await db.execute(sql`SELECT id, name, kind FROM categories WHERE id = ANY(${catIds}::uuid[])`)
      : []
    const catMeta = new Map((cats as any[]).map(c => [c.id, c]))
    const byCategory = Object.entries(byCatMap).map(([id, v]) => ({
      name: catMeta.get(id)?.name || id, type: catMeta.get(id)?.kind || null, total: r2(v.total), count: v.count,
    })).sort((a, b) => b.total - a.total)
    const monthlyTrend = Object.entries(monthlyMap).slice(-12).map(([month, d]) => ({ month, ...d }))
    return res.status(200).json({ income: r2(totalIncome), expenses: r2(totalExpenses), profit: r2(totalIncome - totalExpenses), monthlyTrend, byCategory, lastUpdated: new Date().toISOString() })
  } catch (err) {
    return handleError(res, err, 'summary')
  }
})

// ─── Generic CRUD helper ──────────────────────────────────────────────────────

type CrudConfig = {
  table: string
  requiredFields: string[]
  allowedFields: string[]
  defaults?: Record<string, unknown>
  listQuery?: (orgId: string, trash: boolean) => ReturnType<typeof sql>
  transformRow?: (row: Record<string, unknown>) => Record<string, unknown>
  computeTotals?: (items: Record<string, unknown>[]) => unknown
}

function mountCrud(path: string, cfg: CrudConfig) {
  const { table, requiredFields, allowedFields, defaults = {}, listQuery, transformRow, computeTotals } = cfg

  router.get(path, async (req: Request, res: Response) => {
    const ctx = await resolveOrg(res); if (!ctx) return
    try {
      const trash = isTrash(req)
      const rows = listQuery
        ? await db.execute(listQuery(ctx.orgId, trash))
        : await db.execute(sql`SELECT * FROM ${sql.raw(table)} WHERE organization_id = ${ctx.orgId} AND deleted_at IS ${sql.raw(trash ? 'NOT NULL' : 'NULL')} ORDER BY created_at DESC`)
      const items = (rows as any[]).map(r => transformRow ? transformRow(r) : r)
      if (computeTotals) return res.status(200).json({ items, totals: computeTotals(items) })
      return res.status(200).json({ items })
    } catch (err) { return handleError(res, err, table) }
  })

  router.post(path, async (req: Request, res: Response) => {
    const ctx = await resolveOrg(res); if (!ctx) return
    const actorEmail = getActorEmail(req)
    const body = req.body || {}
    const missing = requiredFields.filter(f => body[f] === undefined || body[f] === null || body[f] === '')
    if (missing.length) return res.status(400).json({ error: `Campos requeridos: ${missing.join(', ')}` })
    const picked: Record<string, unknown> = {}
    for (const f of allowedFields) if (body[f] !== undefined) picked[f] = body[f]
    const payload = {
      ...defaults,
      ...picked,
      user_id: ctx.userId,
      organization_id: ctx.orgId,
      ...(actorEmail ? { created_by_email: actorEmail, updated_by_email: actorEmail } : {}),
    }
    try {
      const entries = Object.entries(payload)
      if (entries.length === 0) return res.status(400).json({ error: 'No hay campos para insertar' })
      const cols = entries.map(([k]) => sql.raw(k))
      const vals = entries.map(([, v]) => v)
      const colList = cols.reduce<any>((acc, c, i) => i === 0 ? c : sql`${acc}, ${c}`, sql``)
      const valList = vals.reduce<any>((acc, v, i) => i === 0 ? sql`${v}` : sql`${acc}, ${v}`, sql``)
      const rows = await withRetry(() =>
        db.execute(sql`INSERT INTO ${sql.raw(table)} (${colList}) VALUES (${valList}) RETURNING *`)
      )
      return res.status(201).json((rows as any[])[0])
    } catch (err) { return handleError(res, err, table) }
  })

  router.patch(`${path}/:id`, async (req: Request, res: Response) => {
    const ctx = await resolveOrg(res); if (!ctx) return
    const actorEmail = getActorEmail(req)
    const id = req.params.id
    if (isRestore(req)) {
      try {
        const rows = await db.execute(sql`
          UPDATE ${sql.raw(table)} SET deleted_at = NULL ${actorEmail ? sql`, updated_by_email = ${actorEmail}` : sql``}
          WHERE id = ${id} AND organization_id = ${ctx.orgId} RETURNING *
        `)
        return res.status(200).json((rows as any[])[0])
      } catch (err) { return handleError(res, err, table) }
    }
    const body = req.body || {}
    const picked: Record<string, unknown> = {}
    for (const f of allowedFields) if (body[f] !== undefined) picked[f] = body[f]
    if (actorEmail) picked.updated_by_email = actorEmail
    if (!Object.keys(picked).length) return res.status(400).json({ error: 'No fields to update' })
    try {
      const setParts = Object.entries(picked).map(([k, v]) => sql`${sql.raw(k)} = ${v}`)
      const setClause = setParts.reduce((acc: any, p, i) => i === 0 ? p : sql`${acc}, ${p}`)
      const rows = await db.execute(sql`
        UPDATE ${sql.raw(table)} SET ${setClause}
        WHERE id = ${id} AND organization_id = ${ctx.orgId} RETURNING *
      `)
      return res.status(200).json((rows as any[])[0])
    } catch (err) { return handleError(res, err, table) }
  })

  router.post(`${path}/:id/restore`, async (req: Request, res: Response) => {
    const ctx = await resolveOrg(res); if (!ctx) return
    const actorEmail = getActorEmail(req)
    try {
      const rows = await db.execute(sql`
        UPDATE ${sql.raw(table)} SET deleted_at = NULL ${actorEmail ? sql`, updated_by_email = ${actorEmail}` : sql``}
        WHERE id = ${req.params.id} AND organization_id = ${ctx.orgId} RETURNING *
      `)
      return res.status(200).json((rows as any[])[0])
    } catch (err) { return handleError(res, err, table) }
  })

  router.delete(`${path}/:id`, async (req: Request, res: Response) => {
    const ctx = await resolveOrg(res); if (!ctx) return
    const actorEmail = getActorEmail(req)
    const id = req.params.id
    try {
      if (isHard(req)) {
        await db.execute(sql`DELETE FROM ${sql.raw(table)} WHERE id = ${id} AND organization_id = ${ctx.orgId}`)
      } else {
        await db.execute(sql`
          UPDATE ${sql.raw(table)} SET deleted_at = NOW() ${actorEmail ? sql`, updated_by_email = ${actorEmail}` : sql``}
          WHERE id = ${id} AND organization_id = ${ctx.orgId}
        `)
      }
      return res.status(200).json({ success: true })
    } catch (err) { return handleError(res, err, table) }
  })
}

// ─── Movements ────────────────────────────────────────────────────────────────

router.get('/movements', async (req: Request, res: Response) => {
  const ctx = await resolveOrg(res); if (!ctx) return
  const { orgId } = ctx
  try {
    const trash = isTrash(req)
    const limit = Math.min(num(req.query.limit, 500), 2000)
    const offset = num(req.query.offset, 0)
    const from = q(req.query.from), to = q(req.query.to), kind = q(req.query.kind)
    const categoryId = q(req.query.categoryId), accountId = q(req.query.accountId), search = q(req.query.search)

    const rows = await db.execute(sql`
      SELECT id, kind, amount, date, description,
             category_id, account_id, provider, payment_method,
             is_subscription, subscription_end_date, auto_renew,
             tax_rate, tax_amount, linked_debt_id, status, created_at,
             deleted_at, created_by_email, updated_by_email
      FROM movements
      WHERE organization_id = ${orgId}
        AND deleted_at IS ${sql.raw(trash ? 'NOT NULL' : 'NULL')}
        ${from ? sql`AND date >= ${from}::date` : sql``}
        ${to ? sql`AND date <= ${to}::date` : sql``}
        ${kind ? sql`AND kind = ${kind}` : sql``}
        ${categoryId ? sql`AND category_id = ${categoryId}::uuid` : sql``}
        ${accountId ? sql`AND account_id = ${accountId}::uuid` : sql``}
        ${search ? sql`AND description ILIKE ${'%' + search + '%'}` : sql``}
      ORDER BY date DESC
      LIMIT ${limit} OFFSET ${offset}
    `)

    const movs = rows as any[]
    const catIds = [...new Set(movs.map(m => m.category_id).filter(Boolean) as string[])]
    const accIds = [...new Set(movs.map(m => m.account_id).filter(Boolean) as string[])]

    const [cats, accs] = await Promise.all([
      catIds.length ? db.execute(sql`SELECT id, name, color, icon, kind FROM categories WHERE id = ANY(${catIds}::uuid[])`) : Promise.resolve([]),
      accIds.length ? db.execute(sql`SELECT id, name, type, color, icon, currency FROM accounts WHERE id = ANY(${accIds}::uuid[])`) : Promise.resolve([]),
    ])
    const catMap = new Map((cats as any[]).map(c => [c.id, c]))
    const accMap = new Map((accs as any[]).map(a => [a.id, a]))

    const items = movs.map(m => ({
      ...m, amount: Number(m.amount) || 0,
      category: m.category_id ? catMap.get(m.category_id) || null : null,
      account: m.account_id ? accMap.get(m.account_id) || null : null,
    }))
    return res.status(200).json({ items, total: items.length, limit, offset })
  } catch (err) { return handleError(res, err, 'movements') }
})

router.post('/movements', async (req: Request, res: Response) => {
  const ctx = await resolveOrg(res); if (!ctx) return
  const { orgId, userId } = ctx
  const actorEmail = getActorEmail(req)
  const body = req.body || {}
  if (!body.kind || !body.amount || !body.date) return res.status(400).json({ error: 'kind, amount, date son obligatorios' })
  const FIELDS = ['account_id', 'kind', 'amount', 'date', 'description', 'category_id', 'provider', 'payment_method', 'is_subscription', 'subscription_end_date', 'auto_renew', 'tax_rate', 'tax_amount', 'linked_debt_id', 'status', 'is_business']
  const picked: Record<string, unknown> = {}
  for (const f of FIELDS) if (body[f] !== undefined) picked[f] = body[f]
  const payload = { ...picked, user_id: userId, organization_id: orgId, status: picked.status || 'confirmed', ...(actorEmail ? { created_by_email: actorEmail, updated_by_email: actorEmail } : {}) }
  try {
    const cols = Object.keys(payload).map(k => sql.raw(k))
    const vals = Object.values(payload)
    const colList = cols.reduce((acc: any, c, i) => i === 0 ? c : sql`${acc}, ${c}`)
    const valList = vals.reduce((acc: any, v, i) => i === 0 ? sql`${v}` : sql`${acc}, ${v}`)
    const rows = await withRetry(() =>
      db.execute(sql`INSERT INTO movements (${colList}) VALUES (${valList}) RETURNING *`)
    )
    return res.status(201).json((rows as any[])[0])
  } catch (err) { return handleError(res, err, 'movements') }
})

router.patch('/movements/:id', async (req: Request, res: Response) => {
  const ctx = await resolveOrg(res); if (!ctx) return
  const actorEmail = getActorEmail(req)
  const id = req.params.id
  if (isRestore(req)) {
    try {
      const rows = await db.execute(sql`UPDATE movements SET deleted_at = NULL ${actorEmail ? sql`, updated_by_email = ${actorEmail}` : sql``} WHERE id = ${id} AND organization_id = ${ctx.orgId} RETURNING *`)
      return res.status(200).json((rows as any[])[0])
    } catch (err) { return handleError(res, err, 'movements') }
  }
  const FIELDS = ['account_id', 'kind', 'amount', 'date', 'description', 'category_id', 'provider', 'payment_method', 'is_subscription', 'subscription_end_date', 'auto_renew', 'tax_rate', 'tax_amount', 'linked_debt_id', 'status', 'is_business']
  const body = req.body || {}
  const picked: Record<string, unknown> = {}
  for (const f of FIELDS) if (body[f] !== undefined) picked[f] = body[f]
  if (actorEmail) picked.updated_by_email = actorEmail
  if (!Object.keys(picked).length) return res.status(400).json({ error: 'No fields to update' })
  try {
    const setParts = Object.entries(picked).map(([k, v]) => sql`${sql.raw(k)} = ${v}`)
    const setClause = setParts.reduce((acc: any, p, i) => i === 0 ? p : sql`${acc}, ${p}`)
    const rows = await db.execute(sql`UPDATE movements SET ${setClause} WHERE id = ${id} AND organization_id = ${ctx.orgId} RETURNING *`)
    return res.status(200).json((rows as any[])[0])
  } catch (err) { return handleError(res, err, 'movements') }
})

router.post('/movements/:id/restore', async (req: Request, res: Response) => {
  const ctx = await resolveOrg(res); if (!ctx) return
  try {
    const rows = await db.execute(sql`UPDATE movements SET deleted_at = NULL WHERE id = ${req.params.id} AND organization_id = ${ctx.orgId} RETURNING *`)
    return res.status(200).json((rows as any[])[0])
  } catch (err) { return handleError(res, err, 'movements') }
})

router.delete('/movements/:id', async (req: Request, res: Response) => {
  const ctx = await resolveOrg(res); if (!ctx) return
  const actorEmail = getActorEmail(req)
  try {
    if (isHard(req)) {
      if (actorEmail) console.log(`[crm-sync/movements] hard delete id=${req.params.id} by ${actorEmail}`)
      await db.execute(sql`DELETE FROM movements WHERE id = ${req.params.id} AND organization_id = ${ctx.orgId}`)
    } else {
      await db.execute(sql`UPDATE movements SET deleted_at = NOW() ${actorEmail ? sql`, updated_by_email = ${actorEmail}` : sql``} WHERE id = ${req.params.id} AND organization_id = ${ctx.orgId}`)
    }
    return res.status(200).json({ success: true })
  } catch (err) { return handleError(res, err, 'movements') }
})

// ─── Accounts ─────────────────────────────────────────────────────────────────

router.get('/accounts', async (req: Request, res: Response) => {
  const ctx = await resolveOrg(res); if (!ctx) return
  const { orgId } = ctx
  try {
    const trash = isTrash(req)
    const accounts = await db.execute(sql`
      SELECT id, name, type, balance, currency, color, icon, is_active,
             parent_account_id, description, created_at, updated_at, deleted_at,
             created_by_email, updated_by_email
      FROM accounts WHERE organization_id = ${orgId}
        AND deleted_at IS ${sql.raw(trash ? 'NOT NULL' : 'NULL')}
      ORDER BY name ASC
    `)
    const accs = accounts as any[]
    const ids = accs.map(a => a.id)
    let computed: Record<string, { income: number; expense: number; count: number }> = {}
    if (ids.length) {
      const movs = await db.execute(sql`SELECT account_id, kind, amount FROM movements WHERE organization_id = ${orgId} AND deleted_at IS NULL AND account_id = ANY(${ids}::uuid[])`)
      for (const m of movs as any[]) {
        if (!computed[m.account_id]) computed[m.account_id] = { income: 0, expense: 0, count: 0 }
        const amt = Number(m.amount) || 0
        if (m.kind === 'income') computed[m.account_id].income += amt
        else if (m.kind === 'expense') computed[m.account_id].expense += amt
        computed[m.account_id].count++
      }
    }
    const items = accs.map(a => {
      const c = computed[a.id] || { income: 0, expense: 0, count: 0 }
      return { ...a, balance: Number(a.balance) || 0, movementCount: c.count, totalIncome: c.income, totalExpense: c.expense, computedBalance: c.income - c.expense }
    })
    const totals = items.reduce((acc: any, it) => { acc.totalBalance += it.balance; acc.totalIncome += it.totalIncome; acc.totalExpense += it.totalExpense; return acc }, { totalBalance: 0, totalIncome: 0, totalExpense: 0 })
    return res.status(200).json({ items, totals })
  } catch (err) { return handleError(res, err, 'accounts') }
})

mountCrud('/accounts', {
  table: 'accounts',
  requiredFields: ['name', 'type'],
  allowedFields: ['name', 'type', 'balance', 'currency', 'color', 'icon', 'is_active', 'parent_account_id', 'description'],
  defaults: { currency: 'EUR', balance: 0, is_active: true },
})

// ─── Categories ───────────────────────────────────────────────────────────────

router.get('/categories', async (req: Request, res: Response) => {
  const ctx = await resolveOrg(res); if (!ctx) return
  try {
    const trash = isTrash(req)
    const rows = await db.execute(sql`
      SELECT id, name, kind, color, icon, description, usage_count, last_used_at,
             created_at, deleted_at, created_by_email, updated_by_email
      FROM categories WHERE organization_id = ${ctx.orgId}
        AND deleted_at IS ${sql.raw(trash ? 'NOT NULL' : 'NULL')}
      ORDER BY usage_count DESC
    `)
    const items = rows as any[]
    return res.status(200).json({ items, income: items.filter(c => c.kind === 'income'), expense: items.filter(c => c.kind === 'expense'), total: items.length })
  } catch (err) { return handleError(res, err, 'categories') }
})

mountCrud('/categories', { table: 'categories', requiredFields: ['name', 'kind'], allowedFields: ['name', 'kind', 'color', 'icon', 'description'] })

// ─── Debts ────────────────────────────────────────────────────────────────────

router.get('/debts', async (req: Request, res: Response) => {
  const ctx = await resolveOrg(res); if (!ctx) return
  try {
    const trash = isTrash(req)
    const rows = await db.execute(sql`
      SELECT id, direction, counterparty_name, total_amount, remaining_amount,
             due_date, description, is_closed, created_at, deleted_at, created_by_email, updated_by_email
      FROM debts WHERE organization_id = ${ctx.orgId}
        AND deleted_at IS ${sql.raw(trash ? 'NOT NULL' : 'NULL')}
      ORDER BY is_closed ASC, due_date ASC NULLS LAST
    `)
    const items = (rows as any[]).map(d => ({ ...d, total_amount: Number(d.total_amount) || 0, remaining_amount: Number(d.remaining_amount) || 0 }))
    const totals = items.reduce((acc: any, d) => {
      if (d.is_closed) return acc
      if (d.direction === 'i_owe') acc.iOwe += d.remaining_amount
      else if (d.direction === 'they_owe_me') acc.theyOweMe += d.remaining_amount
      return acc
    }, { iOwe: 0, theyOweMe: 0 })
    return res.status(200).json({ items, totals: { iOwe: r2(totals.iOwe), theyOweMe: r2(totals.theyOweMe), net: r2(totals.theyOweMe - totals.iOwe) } })
  } catch (err) { return handleError(res, err, 'debts') }
})

mountCrud('/debts', {
  table: 'debts',
  requiredFields: ['direction', 'counterparty_name', 'total_amount'],
  allowedFields: ['direction', 'counterparty_name', 'total_amount', 'remaining_amount', 'due_date', 'description', 'is_closed'],
  defaults: { is_closed: false },
})

// ─── Savings ──────────────────────────────────────────────────────────────────

router.get('/savings', async (req: Request, res: Response) => {
  const ctx = await resolveOrg(res); if (!ctx) return
  try {
    const trash = isTrash(req)
    const rows = await db.execute(sql`
      SELECT id, name, target_amount, current_amount, target_date, description,
             color, icon, status, created_at, deleted_at, created_by_email, updated_by_email
      FROM savings_goals WHERE organization_id = ${ctx.orgId}
        AND deleted_at IS ${sql.raw(trash ? 'NOT NULL' : 'NULL')}
      ORDER BY status ASC, target_date ASC NULLS LAST
    `)
    const items = (rows as any[]).map(g => {
      const target = Number(g.target_amount) || 0, current = Number(g.current_amount) || 0
      return { ...g, target_amount: target, current_amount: current, progress: target > 0 ? Math.min(100, Math.round((current / target) * 1000) / 10) : 0 }
    })
    const active = items.filter(g => g.status === 'active')
    const totals = active.reduce((acc: any, g) => { acc.target += g.target_amount; acc.current += g.current_amount; return acc }, { target: 0, current: 0 })
    return res.status(200).json({ items, totals: { targetTotal: r2(totals.target), currentTotal: r2(totals.current), progress: totals.target > 0 ? Math.round((totals.current / totals.target) * 1000) / 10 : 0 } })
  } catch (err) { return handleError(res, err, 'savings') }
})

mountCrud('/savings', {
  table: 'savings_goals',
  requiredFields: ['name', 'target_amount'],
  allowedFields: ['name', 'target_amount', 'current_amount', 'target_date', 'description', 'color', 'icon', 'status'],
  defaults: { current_amount: 0, status: 'active', color: '#22c55e' },
})

// ─── Investments ──────────────────────────────────────────────────────────────

router.get('/investments', async (req: Request, res: Response) => {
  const ctx = await resolveOrg(res); if (!ctx) return
  try {
    const trash = isTrash(req)
    const rows = await db.execute(sql`
      SELECT id, name, type, quantity, buy_price, current_price, currency, account_id,
             notes, created_at, updated_at, deleted_at, created_by_email, updated_by_email
      FROM investments WHERE organization_id = ${ctx.orgId}
        AND deleted_at IS ${sql.raw(trash ? 'NOT NULL' : 'NULL')}
      ORDER BY name ASC
    `)
    const items = (rows as any[]).map(i => {
      const qty = Number(i.quantity) || 0, buy = Number(i.buy_price) || 0, cur = Number(i.current_price) || buy
      const cost = qty * buy, value = qty * cur
      return { ...i, quantity: qty, buy_price: buy, current_price: cur, costBasis: r2(cost), currentValue: r2(value), gainLoss: r2(value - cost), gainLossPct: cost > 0 ? Math.round(((value - cost) / cost) * 10000) / 100 : 0 }
    })
    const totals = items.reduce((acc: any, i) => { acc.cost += i.costBasis; acc.value += i.currentValue; return acc }, { cost: 0, value: 0 })
    return res.status(200).json({ items, totals: { costBasis: r2(totals.cost), currentValue: r2(totals.value), gainLoss: r2(totals.value - totals.cost), gainLossPct: totals.cost > 0 ? Math.round(((totals.value - totals.cost) / totals.cost) * 10000) / 100 : 0 } })
  } catch (err) { return handleError(res, err, 'investments') }
})

mountCrud('/investments', {
  table: 'investments',
  requiredFields: ['name', 'type', 'quantity', 'buy_price'],
  allowedFields: ['name', 'type', 'quantity', 'buy_price', 'current_price', 'currency', 'account_id', 'notes'],
  defaults: { currency: 'EUR' },
})

// ─── Recurring ────────────────────────────────────────────────────────────────

router.get('/recurring', async (req: Request, res: Response) => {
  const ctx = await resolveOrg(res); if (!ctx) return
  try {
    const trash = isTrash(req)
    const rows = await db.execute(sql`
      SELECT id, kind, amount, frequency, day_of_month, day_of_week,
             next_occurrence, is_active, description, category, account_id,
             created_at, deleted_at, created_by_email, updated_by_email
      FROM recurring_rules WHERE organization_id = ${ctx.orgId}
        AND deleted_at IS ${sql.raw(trash ? 'NOT NULL' : 'NULL')}
      ORDER BY next_occurrence ASC NULLS LAST
    `)
    const items = rows as any[]
    const subs = await db.execute(sql`
      SELECT id, description, amount, date, subscription_end_date, auto_renew, category_id, account_id, provider
      FROM movements WHERE organization_id = ${ctx.orgId} AND deleted_at IS NULL AND is_subscription = true
      ORDER BY date DESC
    `)
    const subscriptions = (subs as any[]).map(s => ({ ...s, amount: Number(s.amount) || 0 }))
    let monthlyIncome = 0, monthlyExpense = 0
    for (const r of items) {
      if (!r.is_active) continue
      const amt = Number(r.amount) || 0
      const f = r.frequency === 'daily' ? 30 : r.frequency === 'weekly' ? 4.345 : r.frequency === 'yearly' ? 1 / 12 : 1
      if (r.kind === 'income') monthlyIncome += amt * f; else monthlyExpense += amt * f
    }
    return res.status(200).json({ items, subscriptions, projection: { monthlyIncome: r2(monthlyIncome), monthlyExpense: r2(monthlyExpense), monthlyNet: r2(monthlyIncome - monthlyExpense) } })
  } catch (err) { return handleError(res, err, 'recurring') }
})

mountCrud('/recurring', {
  table: 'recurring_rules',
  requiredFields: ['account_id', 'kind', 'amount', 'frequency', 'next_occurrence'],
  allowedFields: ['account_id', 'kind', 'amount', 'frequency', 'day_of_month', 'day_of_week', 'next_occurrence', 'is_active', 'description', 'category'],
  defaults: { is_active: true },
})

export default router
