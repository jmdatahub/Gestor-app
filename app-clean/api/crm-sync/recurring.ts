import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase, guard, handleError, pickBody, requireId,
  auditCreate, auditUpdate, isTrashList, handleTrashOps } from './_shared.js'

const FIELDS = ['account_id', 'kind', 'amount', 'frequency', 'day_of_month', 'day_of_week', 'next_occurrence', 'is_active', 'description', 'category'] as const

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ctx = await guard(req, res, ['GET', 'POST', 'PATCH', 'DELETE'])
  if (!ctx) return
  const { orgId, userId, actorEmail } = ctx

  try {
    if (await handleTrashOps(req, res, 'recurring_rules', orgId, actorEmail)) return

    if (req.method === 'GET') {
      let q = supabase
        .from('recurring_rules')
        .select(`id, kind, amount, frequency, day_of_month, day_of_week, next_occurrence, is_active, description, category, account_id, created_at, deleted_at, created_by_email, updated_by_email`)
        .eq('organization_id', orgId)
        .order('next_occurrence', { ascending: true, nullsFirst: false })
      if (isTrashList(req)) q = q.not('deleted_at', 'is', null)
      else q = q.is('deleted_at', null)
      const { data, error } = await q
      if (error) throw error
      const items = data || []

      const { data: subsRaw } = await supabase
        .from('movements')
        .select('id, description, amount, date, subscription_end_date, auto_renew, category_id, account_id, provider')
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .eq('is_subscription', true)
        .order('date', { ascending: false })
      const subscriptions = (subsRaw || []).map(s => ({ ...s, amount: Number(s.amount) || 0 }))

      let monthlyIncome = 0
      let monthlyExpense = 0
      for (const r of items) {
        if (!r.is_active) continue
        const amt = Number(r.amount) || 0
        const f = r.frequency === 'daily' ? 30 : r.frequency === 'weekly' ? 4.345 : r.frequency === 'yearly' ? 1 / 12 : 1
        const monthly = amt * f
        if (r.kind === 'income') monthlyIncome += monthly
        else monthlyExpense += monthly
      }
      return res.status(200).json({
        items,
        subscriptions,
        projection: {
          monthlyIncome: Math.round(monthlyIncome * 100) / 100,
          monthlyExpense: Math.round(monthlyExpense * 100) / 100,
          monthlyNet: Math.round((monthlyIncome - monthlyExpense) * 100) / 100,
        },
      })
    }

    if (req.method === 'POST') {
      const body = pickBody(req.body, [...FIELDS])
      if (!body.account_id || !body.kind || !body.amount || !body.frequency || !body.next_occurrence) {
        return res.status(400).json({ error: 'account_id, kind, amount, frequency, next_occurrence son obligatorios' })
      }
      const payload = { ...body, user_id: userId, organization_id: orgId, is_active: body.is_active ?? true, ...auditCreate(actorEmail) }
      const { data, error } = await supabase.from('recurring_rules').insert([payload]).select().single()
      if (error) throw error
      return res.status(201).json(data)
    }

    if (req.method === 'PATCH') {
      const id = requireId(req, res); if (!id) return
      const body = pickBody(req.body, [...FIELDS])
      const { data, error } = await supabase.from('recurring_rules')
        .update({ ...body, ...auditUpdate(actorEmail) })
        .eq('id', id).eq('organization_id', orgId).select().single()
      if (error) throw error
      return res.status(200).json(data)
    }
  } catch (err) {
    return handleError(res, err, 'recurring')
  }
}
