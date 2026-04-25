import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase, guard, handleError, pickBody, requireId,
  auditCreate, auditUpdate, isTrashList, handleTrashOps } from './_shared.js'

const FIELDS = ['name', 'type', 'balance', 'currency', 'color', 'icon', 'is_active', 'parent_account_id', 'description'] as const

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ctx = await guard(req, res, ['GET', 'POST', 'PATCH', 'DELETE'])
  if (!ctx) return
  const { orgId, userId, actorEmail } = ctx

  try {
    if (await handleTrashOps(req, res, 'accounts', orgId, actorEmail)) return

    if (req.method === 'GET') {
      let q = supabase
        .from('accounts')
        .select('id, name, type, balance, currency, color, icon, is_active, parent_account_id, description, created_at, updated_at, deleted_at, created_by_email, updated_by_email')
        .eq('organization_id', orgId)
        .order('name', { ascending: true })
      if (isTrashList(req)) q = q.not('deleted_at', 'is', null)
      else q = q.is('deleted_at', null)
      const { data: accounts, error } = await q
      if (error) throw error

      const ids = (accounts || []).map(a => a.id)
      const computed: Record<string, { income: number; expense: number; count: number }> = {}
      if (ids.length) {
        const { data: movs } = await supabase
          .from('movements')
          .select('account_id, kind, amount')
          .eq('organization_id', orgId)
          .is('deleted_at', null)
          .in('account_id', ids)
        for (const m of movs || []) {
          const key = m.account_id as string
          if (!computed[key]) computed[key] = { income: 0, expense: 0, count: 0 }
          const amt = Number(m.amount) || 0
          if (m.kind === 'income') computed[key].income += amt
          else if (m.kind === 'expense') computed[key].expense += amt
          computed[key].count += 1
        }
      }
      const items = (accounts || []).map(a => {
        const c = computed[a.id] || { income: 0, expense: 0, count: 0 }
        return {
          ...a,
          balance: Number(a.balance) || 0,
          movementCount: c.count,
          totalIncome: c.income,
          totalExpense: c.expense,
          computedBalance: c.income - c.expense,
        }
      })
      const totals = items.reduce(
        (acc, it) => {
          acc.totalBalance += it.balance
          acc.totalIncome += it.totalIncome
          acc.totalExpense += it.totalExpense
          return acc
        },
        { totalBalance: 0, totalIncome: 0, totalExpense: 0 },
      )
      return res.status(200).json({ items, totals })
    }

    if (req.method === 'POST') {
      const body = pickBody(req.body, [...FIELDS])
      if (!body.name || !body.type) return res.status(400).json({ error: 'name y type son obligatorios' })
      const payload = {
        ...body,
        user_id: userId,
        organization_id: orgId,
        currency: body.currency || 'EUR',
        balance: body.balance ?? 0,
        is_active: body.is_active ?? true,
        ...auditCreate(actorEmail),
      }
      const { data, error } = await supabase.from('accounts').insert([payload]).select().single()
      if (error) throw error
      return res.status(201).json(data)
    }

    if (req.method === 'PATCH') {
      const id = requireId(req, res); if (!id) return
      const body = pickBody(req.body, [...FIELDS])
      const { data, error } = await supabase.from('accounts')
        .update({ ...body, ...auditUpdate(actorEmail) })
        .eq('id', id).eq('organization_id', orgId).select().single()
      if (error) throw error
      return res.status(200).json(data)
    }
  } catch (err) {
    return handleError(res, err, 'accounts')
  }
}
