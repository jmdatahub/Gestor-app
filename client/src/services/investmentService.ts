import { api } from '../lib/apiClient'

export type InvestmentType = 'crypto' | 'stock' | 'etf' | 'bond' | 'real_estate' | 'commodity' | 'other'

export const investmentTypes: Array<{ value: InvestmentType; label: string }> = [
  { value: 'crypto', label: 'Criptomoneda' },
  { value: 'stock', label: 'Acción' },
  { value: 'etf', label: 'ETF' },
  { value: 'bond', label: 'Bono' },
  { value: 'real_estate', label: 'Inmueble' },
  { value: 'commodity', label: 'Commodity' },
  { value: 'other', label: 'Otro' },
]

export interface Investment {
  id: string; user_id: string; organization_id?: string | null; name: string
  ticker?: string | null; asset_type: string; quantity: number
  avg_buy_price: number; current_price?: number | null; currency?: string
  notes?: string | null; created_at: string; deleted_at?: string | null
  // Compat snake_case / alternate fields (computed from main fields)
  type?: InvestmentType | string; account_id?: string | null
  buy_price?: number; currentPrice?: number
  fund_from_account_id?: string | null
}

export interface CreateInvestmentInput {
  user_id: string; organization_id?: string | null; name: string
  ticker?: string | null; asset_type?: string; quantity: number
  avg_buy_price?: number; current_price?: number | null; currency?: string
  notes?: string | null; type?: InvestmentType | string; account_id?: string | null
  buy_price?: number; fund_from_account_id?: string | null
}
export interface InvestmentPriceHistory {
  id: string; investment_id: string; price: number; date: string; created_at: string
}

export async function fetchInvestments(_userId: string, organizationId?: string | null): Promise<Investment[]> {
  const params: Record<string, string> = {}
  if (organizationId) params.org_id = organizationId
  const { data } = await api.get<{ data: Investment[] }>('/api/v1/investments', params)
  return data
}

export async function getInvestmentById(id: string): Promise<Investment | null> {
  const { data } = await api.get<{ data: Investment }>(`/api/v1/investments/${id}`)
  return data
}

export async function createInvestment(inv: CreateInvestmentInput): Promise<Investment> {
  const { data } = await api.post<{ data: Investment }>('/api/v1/investments', inv)
  return data
}

export async function updateInvestment(id: string, updates: Partial<Investment>): Promise<Investment> {
  const { data } = await api.patch<{ data: Investment }>(`/api/v1/investments/${id}`, updates)
  return data
}

export async function deleteInvestment(id: string): Promise<void> {
  await api.delete(`/api/v1/investments/${id}`)
}

export async function fetchPriceHistory(investmentId: string): Promise<InvestmentPriceHistory[]> {
  const { data } = await api.get<{ data: InvestmentPriceHistory[] }>(`/api/v1/investments/${investmentId}/price-history`)
  return data
}

export async function addPriceHistory(investmentId: string, entry: { price: number; date: string }): Promise<InvestmentPriceHistory> {
  const { data } = await api.post<{ data: InvestmentPriceHistory }>(`/api/v1/investments/${investmentId}/price-history`, entry)
  return data
}

export async function fetchCoinPrice(ticker: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ticker)}&vs_currencies=eur`)
    const json = await res.json()
    return json[ticker]?.eur ?? null
  } catch { return null }
}

// ---- Backward-compat aliases & helpers ----

export const getUserInvestments = fetchInvestments

export interface InvestmentTotals {
  totalValue: number; totalCost: number; totalGain: number; gainPercent: number
  // Compat aliases
  totalProfitLoss: number; profitLossPercent: number; count: number
}

export function calculateTotals(investments: Investment[]): InvestmentTotals {
  let totalValue = 0; let totalCost = 0
  for (const inv of investments) {
    const price = inv.current_price ?? inv.avg_buy_price
    const cost = (inv.buy_price ?? inv.avg_buy_price) * inv.quantity
    totalValue += price * inv.quantity
    totalCost += cost
  }
  const totalGain = totalValue - totalCost
  const gainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0
  return {
    totalValue, totalCost, totalGain, gainPercent,
    totalProfitLoss: totalGain, profitLossPercent: gainPercent,
    count: investments.length,
  }
}

export async function updatePrice(id: string, _userId: string, price: number, date: string): Promise<Investment> {
  const entry = await addPriceHistory(id, { price, date })
  return updateInvestment(id, { current_price: entry.price })
}

export type PriceHistoryEntry = InvestmentPriceHistory
export const getPriceHistory = fetchPriceHistory

export async function fetchExternalPrice(inv: Investment): Promise<number | null> {
  const type = inv.type ?? inv.asset_type
  if (type === 'crypto' && inv.ticker) {
    return fetchCoinPrice(inv.ticker)
  }
  return null
}
