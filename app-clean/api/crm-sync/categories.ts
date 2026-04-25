import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase, guard, handleError, pickBody, requireId,
  auditCreate, auditUpdate, isTrashList, handleTrashOps } from './_shared.js'

const FIELDS = ['name', 'kind', 'color', 'icon', 'description'] as const

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ctx = await guard(req, res, ['GET', 'POST', 'PATCH', 'DELETE'])
  if (!ctx) return
  const { orgId, userId, actorEmail } = ctx

  try {
    if (await handleTrashOps(req, res, 'categories', orgId, actorEmail)) return

    if (req.method === 'GET') {
      let q = supabase
        .from('categories')
        .select('id, name, kind, color, icon, description, usage_count, last_used_at, created_at, deleted_at, created_by_email, updated_by_email')
        .eq('organization_id', orgId)
        .order('usage_count', { ascending: false })
      if (isTrashList(req)) q = q.not('deleted_at', 'is', null)
      else q = q.is('deleted_at', null)
      const { data, error } = await q
      if (error) throw error
      const items = data || []
      const income = items.filter(c => c.kind === 'income')
      const expense = items.filter(c => c.kind === 'expense')
      return res.status(200).json({ items, income, expense, total: items.length })
    }

    if (req.method === 'POST') {
      const body = pickBody(req.body, [...FIELDS])
      if (!body.name || !body.kind) return res.status(400).json({ error: 'name y kind son obligatorios' })
      const payload = { ...body, user_id: userId, organization_id: orgId, ...auditCreate(actorEmail) }
      const { data, error } = await supabase.from('categories').insert([payload]).select().single()
      if (error) throw error
      return res.status(201).json(data)
    }

    if (req.method === 'PATCH') {
      const id = requireId(req, res); if (!id) return
      const body = pickBody(req.body, [...FIELDS])
      const { data, error } = await supabase.from('categories')
        .update({ ...body, ...auditUpdate(actorEmail) })
        .eq('id', id).eq('organization_id', orgId).select().single()
      if (error) throw error
      return res.status(200).json(data)
    }
  } catch (err) {
    return handleError(res, err, 'categories')
  }
}
