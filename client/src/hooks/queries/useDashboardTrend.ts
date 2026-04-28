import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'

export const trendKeys = {
  all: ['dashboard', 'trend'] as const,
  monthly: (userId: string, workspaceId: string | null, months: number) =>
    [...trendKeys.all, 'monthly', userId, workspaceId, months] as const,
  daily: (userId: string, workspaceId: string | null, days: number) =>
    [...trendKeys.all, 'daily', userId, workspaceId, days] as const,
  topCategories: (userId: string, workspaceId: string | null, year: number, month: number) =>
    [...trendKeys.all, 'topCategories', userId, workspaceId, year, month] as const,
}

export interface MonthlyTrendPoint {
  period: string
  periodKey: string
  income: number
  expense: number
  net: number
}

export interface DailySpendingPoint {
  date: string
  value: number
}

export interface CategorySlice {
  name: string
  value: number
  color?: string
}

const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function monthLabel(d: Date) {
  return `${MONTHS_ES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
}

function toIso(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function useMonthlyTrend(userId: string | null, workspaceId: string | null, months = 6) {
  return useQuery({
    queryKey: trendKeys.monthly(userId!, workspaceId, months),
    enabled: !!userId,
    queryFn: async (): Promise<MonthlyTrendPoint[]> => {
      const now = new Date()
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1)

      let query = supabase
        .from('movements')
        .select('date, kind, amount')
        .not('kind', 'in', '(transfer_in,transfer_out)')
        .gte('date', toIso(start))
        .lte('date', toIso(end))

      if (workspaceId) {
        query = query.eq('organization_id', workspaceId)
      } else {
        query = query.eq('user_id', userId!).is('organization_id', null)
      }

      const { data, error } = await query
      if (error) throw error

      const buckets = new Map<string, MonthlyTrendPoint>()
      for (let i = 0; i < months; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        buckets.set(key, { period: monthLabel(d), periodKey: key, income: 0, expense: 0, net: 0 })
      }

      for (const row of data ?? []) {
        const key = String(row.date).slice(0, 7) // yyyy-mm
        const bucket = buckets.get(key)
        if (!bucket) continue
        const amount = Number(row.amount) || 0
        if (row.kind === 'income') bucket.income += amount
        else if (row.kind === 'expense') bucket.expense += amount
      }

      const result = Array.from(buckets.values())
      for (const b of result) b.net = b.income - b.expense
      return result
    },
  })
}

export function useDailySpending(userId: string | null, workspaceId: string | null, days = 126) {
  return useQuery({
    queryKey: trendKeys.daily(userId!, workspaceId, days),
    enabled: !!userId,
    queryFn: async (): Promise<DailySpendingPoint[]> => {
      const end = new Date()
      end.setHours(0, 0, 0, 0)
      const start = new Date(end)
      start.setDate(start.getDate() - (days - 1))

      let query = supabase
        .from('movements')
        .select('date, amount, kind')
        .eq('kind', 'expense')
        .gte('date', toIso(start))
        .lte('date', toIso(end))

      if (workspaceId) {
        query = query.eq('organization_id', workspaceId)
      } else {
        query = query.eq('user_id', userId!).is('organization_id', null)
      }

      const { data, error } = await query
      if (error) throw error

      const map = new Map<string, number>()
      for (const row of data ?? []) {
        const k = String(row.date).slice(0, 10)
        map.set(k, (map.get(k) ?? 0) + (Number(row.amount) || 0))
      }

      return Array.from(map.entries()).map(([date, value]) => ({ date, value }))
    },
  })
}

export function useMonthTopCategories(
  userId: string | null,
  workspaceId: string | null,
  year: number,
  month: number,
  kind: 'expense' | 'income' = 'expense',
) {
  return useQuery({
    queryKey: [...trendKeys.topCategories(userId!, workspaceId, year, month), kind],
    enabled: !!userId,
    queryFn: async (): Promise<CategorySlice[]> => {
      const start = new Date(year, month - 1, 1)
      const end = new Date(year, month, 0)

      let query = supabase
        .from('movements')
        .select('amount, category:categories(name,color)')
        .eq('kind', kind)
        .gte('date', toIso(start))
        .lte('date', toIso(end))

      if (workspaceId) {
        query = query.eq('organization_id', workspaceId)
      } else {
        query = query.eq('user_id', userId!).is('organization_id', null)
      }

      const { data, error } = await query
      if (error) throw error

      const map = new Map<string, { value: number; color?: string }>()
      for (const row of (data as unknown as { amount: number; category: { name?: string; color?: string } | { name?: string; color?: string }[] | null }[]) ?? []) {
        const cat = Array.isArray(row.category) ? row.category[0] : row.category
        const name = cat?.name || 'Sin categoría'
        const existing = map.get(name) ?? { value: 0, color: cat?.color }
        existing.value += Number(row.amount) || 0
        if (!existing.color && cat?.color) existing.color = cat.color
        map.set(name, existing)
      }
      return Array.from(map.entries())
        .map(([name, v]) => ({ name, value: v.value, color: v.color }))
        .sort((a, b) => b.value - a.value)
    },
  })
}
