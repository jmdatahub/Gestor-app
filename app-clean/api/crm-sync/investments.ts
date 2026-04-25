import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase, guard, handleError, pickBody, requireId,
  auditCreate, auditUpdate, isTrashList, handleTrashOps } from './_shared.js'

const FIELDS = ['name', 'type', 'quantity', 'buy_price', 'current_price', 'currency', 'account_id', 'notes'] as const

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ctx = await guard(req, res, ['GET', 'POST', 'PATCH', 'DELETE'])
  if (!ctx) return
  const { orgId, userId, actorEmail } = ctx

  try {
    if (await handleTrashOps(req, res, 'investments', orgId, actorEmail)) return

    if (req.method === 'GET') {
      let q = supabase
        .from('investments')
        .select('id, name, type, quantity, buy_price, current_price, currency, account_id, notes, created_at, updated_at, deleted_at, created_by_email, updated_by_email')
        .eq('organization_id', orgId)
        .order('name', { ascending: true })
      if (isTrashList(req)) q = q.not('deleted_at', 'is', null)
      else q = q.is('deleted_at', null)
      const { data, error } = await q
      if (error) throw error
      const items = (data || []).map(i => {
        const qty = Number(i.quantity) || 0
        const buy = Number(i.buy_price) || 0
        const cur = Number(i.current_price) || buy
        const cost = qty * buy
        const value = qty * cur
        return {
          ...i,
          quantity: qty,
          buy_price: buy,
          current_price: cur,
          costBasis: Math.round(cost * 100) / 100,
          currentValue: Math.round(value * 100) / 100,
          gainLoss: Math.round((value - cost) * 100) / 100,
          gainLossPct: cost > 0 ? Math.round(((value - cost) / cost) * 10000) / 100 : 0,
        }
      })
      const totals = items.reduce(
        (acc, i) => { acc.cost += i.costBasis; acc.value += i.currentValue; return acc },
        { cost: 0, value: 0 },
      )
      return res.status(200).json({
        items,
        totals: {
          costBasis: Math.round(totals.cost * 100) / 100,
          currentValue: Math.round(totals.value * 100) / 100,
          gainLoss: Math.round((totals.value - totals.cost) * 100) / 100,
          gainLossPct: totals.cost > 0 ? Math.round(((totals.value - totals.cost) / totals.cost) * 10000) / 100 : 0,
        },
      })
    }

    if (req.method === 'POST') {
      const body = pickBody(req.body, [...FIELDS])
      if (!body.name || !body.type || body.quantity == null || body.buy_price == null) {
        return res.status(400).json({ error: 'name, type, quantity, buy_price son obligatorios' })
      }
      const payload = {
        ...body,
        user_id: userId,
        organization_id: orgId,
        currency: body.currency || 'EUR',
        current_price: body.current_price ?? body.buy_price,
        ...auditCreate(actorEmail),
      }
      const { data, error } = await supabase.from('investments').insert([payload]).select().single()
      if (error) throw error
      return res.status(201).json(data)
    }

    if (req.method === 'PATCH') {
      const id = requireId(req, res); if (!id) return
      const body = pickBody(req.body, [...FIELDS])
      const { data, error } = await supabase.from('investments')
        .update({ ...body, ...auditUpdate(actorEmail) })
        .eq('id', id).eq('organization_id', orgId).select().single()
      if (error) throw error
      return res.status(200).json(data)
    }
  } catch (err) {
    return handleError(res, err, 'investments')
  }
}
