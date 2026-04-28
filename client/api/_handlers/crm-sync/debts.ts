import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase, guard, handleError, pickBody, requireId,
  auditCreate, auditUpdate, isTrashList, handleTrashOps } from '../../crm-sync/_shared.js'

const FIELDS = ['direction', 'counterparty_name', 'total_amount', 'remaining_amount', 'due_date', 'description', 'is_closed'] as const

export async function debtsHandler(req: VercelRequest, res: VercelResponse) {
  const ctx = await guard(req, res, ['GET', 'POST', 'PATCH', 'DELETE'])
  if (!ctx) return
  const { orgId, userId, actorEmail } = ctx

  try {
    if (await handleTrashOps(req, res, 'debts', orgId, actorEmail)) return

    if (req.method === 'GET') {
      let q = supabase
        .from('debts')
        .select('id, direction, counterparty_name, total_amount, remaining_amount, due_date, description, is_closed, created_at, deleted_at, created_by_email, updated_by_email')
        .eq('organization_id', orgId)
        .order('is_closed', { ascending: true })
        .order('due_date', { ascending: true, nullsFirst: false })
      if (isTrashList(req)) q = q.not('deleted_at', 'is', null)
      else q = q.is('deleted_at', null)
      const { data: debts, error } = await q
      if (error) throw error
      const items = (debts || []).map(d => ({
        ...d,
        total_amount: Number(d.total_amount) || 0,
        remaining_amount: Number(d.remaining_amount) || 0,
      }))
      const totals = items.reduce(
        (acc, d) => {
          if (d.is_closed) return acc
          if (d.direction === 'i_owe') acc.iOwe += d.remaining_amount
          else if (d.direction === 'they_owe_me') acc.theyOweMe += d.remaining_amount
          return acc
        },
        { iOwe: 0, theyOweMe: 0 },
      )
      return res.status(200).json({
        items,
        totals: {
          iOwe: Math.round(totals.iOwe * 100) / 100,
          theyOweMe: Math.round(totals.theyOweMe * 100) / 100,
          net: Math.round((totals.theyOweMe - totals.iOwe) * 100) / 100,
        },
      })
    }

    if (req.method === 'POST') {
      const body = pickBody(req.body, [...FIELDS])
      if (!body.direction || !body.counterparty_name || body.total_amount == null) {
        return res.status(400).json({ error: 'direction, counterparty_name, total_amount son obligatorios' })
      }
      const payload = {
        ...body,
        user_id: userId,
        organization_id: orgId,
        remaining_amount: body.remaining_amount ?? body.total_amount,
        is_closed: body.is_closed ?? false,
        ...auditCreate(actorEmail),
      }
      const { data, error } = await supabase.from('debts').insert([payload]).select().single()
      if (error) throw error
      return res.status(201).json(data)
    }

    if (req.method === 'PATCH') {
      const id = requireId(req, res); if (!id) return
      const body = pickBody(req.body, [...FIELDS])
      const { data, error } = await supabase.from('debts')
        .update({ ...body, ...auditUpdate(actorEmail) })
        .eq('id', id).eq('organization_id', orgId).select().single()
      if (error) throw error
      return res.status(200).json(data)
    }
  } catch (err) {
    return handleError(res, err, 'debts')
  }
}
