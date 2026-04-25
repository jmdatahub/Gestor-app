import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase, requireOrg, onlyGet, handleError } from './_shared.js'

const USER_ACTIVITY_TABLES = [
  { name: 'movements',       label: 'Movimiento' },
  { name: 'accounts',        label: 'Cuenta' },
  { name: 'categories',      label: 'Categoría' },
  { name: 'recurring_rules', label: 'Recurrente' },
  { name: 'debts',           label: 'Deuda' },
  { name: 'savings_goals',   label: 'Ahorro' },
  { name: 'investments',     label: 'Inversión' },
]

async function handleUserActivity(req: VercelRequest, res: VercelResponse, orgId: string) {
  const emailRaw = req.query.email
  const email = Array.isArray(emailRaw) ? emailRaw[0] : emailRaw
  if (!email) return res.status(400).json({ error: 'Missing email' })
  const lim = Math.min(200, Math.max(10, Number(req.query.limit) || 50))
  type Row = { table: string; id: string; action: 'create' | 'update' | 'delete'; at: string; label: string }
  const out: Row[] = []
  for (const t of USER_ACTIVITY_TABLES) {
    const { data, error } = await supabase
      .from(t.name)
      .select('id, created_at, updated_at, deleted_at, created_by_email, updated_by_email, name, description, amount, kind, counterparty_name')
      .eq('organization_id', orgId)
      .or(`created_by_email.eq.${email},updated_by_email.eq.${email}`)
      .order('updated_at', { ascending: false })
      .limit(lim)
    if (error) continue
    for (const r of (data || []) as Record<string, unknown>[]) {
      const title = String(r.name || r.description || r.counterparty_name || (r.kind && r.amount ? `${r.kind} ${r.amount}` : '(sin título)'))
      const createdBy = r.created_by_email
      const updatedBy = r.updated_by_email
      const deletedAt = r.deleted_at as string | null
      if (createdBy === email && r.created_at) {
        out.push({ table: t.name, id: String(r.id), action: 'create', at: String(r.created_at), label: `${t.label}: ${title}` })
      }
      if (deletedAt && updatedBy === email) {
        out.push({ table: t.name, id: String(r.id), action: 'delete', at: String(deletedAt), label: `${t.label}: ${title}` })
      } else if (updatedBy === email && r.updated_at && r.updated_at !== r.created_at) {
        out.push({ table: t.name, id: String(r.id), action: 'update', at: String(r.updated_at), label: `${t.label}: ${title}` })
      }
    }
  }
  out.sort((a, b) => b.at.localeCompare(a.at))
  return res.status(200).json({ email, items: out.slice(0, lim) })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!onlyGet(req, res)) return
  const orgId = await requireOrg(req, res)
  if (!orgId) return

  if (req.query.mode === 'user-activity') {
    try { return await handleUserActivity(req, res, orgId) }
    catch (err) { return handleError(res, err, 'overview:user-activity') }
  }

  try {
    const now = new Date()
    const currentMonth = now.toISOString().slice(0, 7) // YYYY-MM
    const monthStart = `${currentMonth}-01`

    const [movRes, accRes, debtRes, goalRes, invRes, recRes] = await Promise.all([
      supabase.from('movements').select('kind, amount, date, category_id, is_subscription').eq('organization_id', orgId),
      supabase.from('accounts').select('id, name, balance, type, currency, is_active, color, icon').eq('organization_id', orgId),
      supabase.from('debts').select('direction, remaining_amount, is_closed').eq('organization_id', orgId),
      supabase.from('savings_goals').select('target_amount, current_amount, status').eq('organization_id', orgId),
      supabase.from('investments').select('quantity, buy_price, current_price').eq('organization_id', orgId),
      supabase.from('recurring_rules').select('kind, amount, frequency, is_active').eq('organization_id', orgId),
    ])

    const movs = movRes.data || []
    const accs = accRes.data || []
    const debts = debtRes.data || []
    const goals = goalRes.data || []
    const invs = invRes.data || []
    const recs = recRes.data || []

    // All-time totals
    let totalIncome = 0
    let totalExpense = 0
    let monthIncome = 0
    let monthExpense = 0
    let subscriptionCount = 0

    const byCategoryMap = new Map<string, { income: number; expense: number; count: number }>()
    const monthlyMap = new Map<string, { income: number; expense: number }>()

    for (const m of movs) {
      const amt = Number(m.amount) || 0
      const kind = m.kind
      if (kind === 'income') totalIncome += amt
      else if (kind === 'expense') totalExpense += amt
      if (m.is_subscription) subscriptionCount += 1

      if (m.date && m.date >= monthStart) {
        if (kind === 'income') monthIncome += amt
        else if (kind === 'expense') monthExpense += amt
      }

      // Monthly trend (last 12 months)
      if (m.date) {
        const mk = String(m.date).slice(0, 7)
        const entry = monthlyMap.get(mk) || { income: 0, expense: 0 }
        if (kind === 'income') entry.income += amt
        else if (kind === 'expense') entry.expense += amt
        monthlyMap.set(mk, entry)
      }

      // By category
      if (m.category_id) {
        const k = m.category_id as string
        const e = byCategoryMap.get(k) || { income: 0, expense: 0, count: 0 }
        if (kind === 'income') e.income += amt
        else if (kind === 'expense') e.expense += amt
        e.count += 1
        byCategoryMap.set(k, e)
      }
    }

    // Monthly trend (last 12 months in order)
    const monthlyTrend = [...monthlyMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, v]) => ({
        month,
        income: Math.round(v.income * 100) / 100,
        expense: Math.round(v.expense * 100) / 100,
      }))

    // Categories names
    const catIds = [...byCategoryMap.keys()]
    const { data: cats } = catIds.length
      ? await supabase.from('categories').select('id, name, color, icon, kind').in('id', catIds)
      : { data: [] }
    const catMap = new Map((cats || []).map(c => [c.id, c]))
    const byCategory = [...byCategoryMap.entries()]
      .map(([id, v]) => ({
        id,
        name: (catMap.get(id) as any)?.name || 'Sin categoría',
        color: (catMap.get(id) as any)?.color || null,
        icon: (catMap.get(id) as any)?.icon || null,
        kind: (catMap.get(id) as any)?.kind || null,
        income: Math.round(v.income * 100) / 100,
        expense: Math.round(v.expense * 100) / 100,
        total: Math.round((v.income + v.expense) * 100) / 100,
        count: v.count,
      }))
      .sort((a, b) => b.total - a.total)

    // Accounts totals
    const totalBalance = accs.reduce((s, a) => s + (Number(a.balance) || 0), 0)

    // Debts
    let iOwe = 0
    let theyOweMe = 0
    for (const d of debts) {
      if (d.is_closed) continue
      const r = Number(d.remaining_amount) || 0
      if (d.direction === 'i_owe') iOwe += r
      else if (d.direction === 'they_owe_me') theyOweMe += r
    }

    // Savings
    let savingsTarget = 0
    let savingsCurrent = 0
    for (const g of goals) {
      if (g.status !== 'active') continue
      savingsTarget += Number(g.target_amount) || 0
      savingsCurrent += Number(g.current_amount) || 0
    }

    // Investments
    let invCost = 0
    let invValue = 0
    for (const i of invs) {
      const qty = Number(i.quantity) || 0
      const buy = Number(i.buy_price) || 0
      const cur = Number(i.current_price) || buy
      invCost += qty * buy
      invValue += qty * cur
    }

    // Recurring projection (monthly)
    let recMonthlyIncome = 0
    let recMonthlyExpense = 0
    for (const r of recs) {
      if (!r.is_active) continue
      const amt = Number(r.amount) || 0
      const f =
        r.frequency === 'daily' ? 30
        : r.frequency === 'weekly' ? 4.345
        : r.frequency === 'yearly' ? 1 / 12
        : 1
      if (r.kind === 'income') recMonthlyIncome += amt * f
      else recMonthlyExpense += amt * f
    }

    const r2 = (n: number) => Math.round(n * 100) / 100

    return res.status(200).json({
      generatedAt: new Date().toISOString(),
      allTime: {
        income: r2(totalIncome),
        expense: r2(totalExpense),
        profit: r2(totalIncome - totalExpense),
      },
      currentMonth: {
        month: currentMonth,
        income: r2(monthIncome),
        expense: r2(monthExpense),
        profit: r2(monthIncome - monthExpense),
      },
      accounts: {
        count: accs.length,
        totalBalance: r2(totalBalance),
        items: accs,
      },
      debts: {
        iOwe: r2(iOwe),
        theyOweMe: r2(theyOweMe),
        net: r2(theyOweMe - iOwe),
      },
      savings: {
        targetTotal: r2(savingsTarget),
        currentTotal: r2(savingsCurrent),
        progress: savingsTarget > 0 ? Math.round((savingsCurrent / savingsTarget) * 1000) / 10 : 0,
      },
      investments: {
        costBasis: r2(invCost),
        currentValue: r2(invValue),
        gainLoss: r2(invValue - invCost),
        gainLossPct: invCost > 0 ? Math.round(((invValue - invCost) / invCost) * 10000) / 100 : 0,
      },
      recurring: {
        monthlyIncome: r2(recMonthlyIncome),
        monthlyExpense: r2(recMonthlyExpense),
        monthlyNet: r2(recMonthlyIncome - recMonthlyExpense),
        activeCount: recs.filter(r => r.is_active).length,
      },
      subscriptions: {
        count: subscriptionCount,
      },
      netWorth: r2(totalBalance + invValue + theyOweMe - iOwe),
      monthlyTrend,
      byCategory,
    })
  } catch (err) {
    return handleError(res, err, 'overview')
  }
}
