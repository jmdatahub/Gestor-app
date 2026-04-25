import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase, guard, handleError, num, pickBody, requireId,
  auditCreate, auditUpdate, isTrashList, handleTrashOps } from './_shared.js'

const FIELDS = [
  'account_id', 'kind', 'amount', 'date', 'description',
  'category_id', 'provider', 'payment_method',
  'is_subscription', 'subscription_end_date', 'auto_renew',
  'tax_rate', 'tax_amount', 'linked_debt_id', 'status', 'is_business',
] as const

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ctx = await guard(req, res, ['GET', 'POST', 'PATCH', 'DELETE'])
  if (!ctx) return
  const { orgId, userId, actorEmail } = ctx

  try {
    if (await handleTrashOps(req, res, 'movements', orgId, actorEmail)) return

    if (req.method === 'GET') {
      const { from, to, kind, limit = '500', offset = '0', search, categoryId, accountId } = req.query as Record<string, string>
      let q = supabase
        .from('movements')
        .select(`
          id, kind, amount, date, description,
          category_id, account_id, provider, payment_method,
          is_subscription, subscription_end_date, auto_renew,
          tax_rate, tax_amount, linked_debt_id, status, created_at,
          deleted_at, created_by_email, updated_by_email
        `, { count: 'exact' })
        .eq('organization_id', orgId)
        .order('date', { ascending: false })
        .range(num(offset), num(offset) + num(limit) - 1)

      if (isTrashList(req)) q = q.not('deleted_at', 'is', null)
      else q = q.is('deleted_at', null)

      if (from) q = q.gte('date', from)
      if (to) q = q.lte('date', to)
      if (kind) q = q.eq('kind', kind)
      if (categoryId) q = q.eq('category_id', categoryId)
      if (accountId) q = q.eq('account_id', accountId)
      if (search) q = q.ilike('description', `%${search}%`)

      const { data, error, count } = await q
      if (error) throw error

      const categoryIds = [...new Set((data || []).map(m => m.category_id).filter(Boolean) as string[])]
      const accountIds = [...new Set((data || []).map(m => m.account_id).filter(Boolean) as string[])]
      const [cats, accs] = await Promise.all([
        categoryIds.length
          ? supabase.from('categories').select('id, name, color, icon, kind').in('id', categoryIds)
          : Promise.resolve({ data: [] }),
        accountIds.length
          ? supabase.from('accounts').select('id, name, type, color, icon, currency').in('id', accountIds)
          : Promise.resolve({ data: [] }),
      ])
      const catMap = new Map((cats.data || []).map(c => [c.id, c]))
      const accMap = new Map((accs.data || []).map(a => [a.id, a]))
      const items = (data || []).map(m => ({
        ...m,
        amount: Number(m.amount) || 0,
        category: m.category_id ? catMap.get(m.category_id) || null : null,
        account: m.account_id ? accMap.get(m.account_id) || null : null,
      }))
      return res.status(200).json({ items, total: count ?? items.length, limit: num(limit), offset: num(offset) })
    }

    if (req.method === 'POST') {
      const body = pickBody(req.body, [...FIELDS])
      if (!body.kind || !body.amount || !body.date) {
        return res.status(400).json({ error: 'kind, amount, date son obligatorios' })
      }
      const payload = {
        ...body,
        user_id: userId,
        organization_id: orgId,
        status: body.status || 'confirmed',
        ...auditCreate(actorEmail),
      }
      const { data, error } = await supabase.from('movements').insert([payload]).select().single()
      if (error) throw error
      return res.status(201).json(data)
    }

    if (req.method === 'PATCH') {
      const id = requireId(req, res)
      if (!id) return
      const body = pickBody(req.body, [...FIELDS])
      const { data, error } = await supabase
        .from('movements')
        .update({ ...body, ...auditUpdate(actorEmail) })
        .eq('id', id)
        .eq('organization_id', orgId)
        .select()
        .single()
      if (error) throw error
      return res.status(200).json(data)
    }
  } catch (err) {
    return handleError(res, err, 'movements')
  }
}
