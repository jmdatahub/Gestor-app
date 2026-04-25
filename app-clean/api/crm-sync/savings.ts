import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase, guard, handleError, pickBody, requireId,
  auditCreate, auditUpdate, isTrashList, handleTrashOps } from './_shared.js'

const FIELDS = ['name', 'target_amount', 'current_amount', 'target_date', 'description', 'color', 'icon', 'status'] as const

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ctx = await guard(req, res, ['GET', 'POST', 'PATCH', 'DELETE'])
  if (!ctx) return
  const { orgId, userId, actorEmail } = ctx

  try {
    if (await handleTrashOps(req, res, 'savings_goals', orgId, actorEmail)) return

    if (req.method === 'GET') {
      let q = supabase
        .from('savings_goals')
        .select('id, name, target_amount, current_amount, target_date, description, color, icon, status, created_at, deleted_at, created_by_email, updated_by_email')
        .eq('organization_id', orgId)
        .order('status', { ascending: true })
        .order('target_date', { ascending: true, nullsFirst: false })
      if (isTrashList(req)) q = q.not('deleted_at', 'is', null)
      else q = q.is('deleted_at', null)
      const { data: goals, error } = await q
      if (error) throw error
      const items = (goals || []).map(g => {
        const target = Number(g.target_amount) || 0
        const current = Number(g.current_amount) || 0
        return {
          ...g,
          target_amount: target,
          current_amount: current,
          progress: target > 0 ? Math.min(100, Math.round((current / target) * 1000) / 10) : 0,
        }
      })
      const active = items.filter(g => g.status === 'active')
      const totals = active.reduce(
        (acc, g) => { acc.target += g.target_amount; acc.current += g.current_amount; return acc },
        { target: 0, current: 0 },
      )
      return res.status(200).json({
        items,
        totals: {
          targetTotal: Math.round(totals.target * 100) / 100,
          currentTotal: Math.round(totals.current * 100) / 100,
          progress: totals.target > 0 ? Math.round((totals.current / totals.target) * 1000) / 10 : 0,
        },
      })
    }

    if (req.method === 'POST') {
      const body = pickBody(req.body, [...FIELDS])
      if (!body.name || body.target_amount == null) return res.status(400).json({ error: 'name y target_amount son obligatorios' })
      const payload = {
        ...body,
        user_id: userId,
        organization_id: orgId,
        current_amount: body.current_amount ?? 0,
        status: body.status || 'active',
        color: body.color || '#22c55e',
        ...auditCreate(actorEmail),
      }
      const { data, error } = await supabase.from('savings_goals').insert([payload]).select().single()
      if (error) throw error
      return res.status(201).json(data)
    }

    if (req.method === 'PATCH') {
      const id = requireId(req, res); if (!id) return
      const body = pickBody(req.body, [...FIELDS])
      const { data, error } = await supabase.from('savings_goals')
        .update({ ...body, ...auditUpdate(actorEmail) })
        .eq('id', id).eq('organization_id', orgId).select().single()
      if (error) throw error
      return res.status(200).json(data)
    }
  } catch (err) {
    return handleError(res, err, 'savings')
  }
}
