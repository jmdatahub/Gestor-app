import { api } from '../lib/apiClient'

// ── Types ──────────────────────────────────────────────────────────────────

export type InvestmentType = 'crypto' | 'stock' | 'etf' | 'bond' | 'real_estate' | 'commodity' | 'collectible' | 'other'
export type PositionType   = 'spot' | 'margin' | 'futures' | 'perpetual'
export type PositionStatus = 'open' | 'closed' | 'liquidated'

export const investmentTypes: Array<{ value: InvestmentType; label: string }> = [
  { value: 'crypto',      label: 'Criptomoneda' },
  { value: 'stock',       label: 'Acción' },
  { value: 'etf',         label: 'ETF' },
  { value: 'bond',        label: 'Bono' },
  { value: 'real_estate', label: 'Inmueble' },
  { value: 'commodity',    label: 'Commodity' },
  { value: 'collectible',  label: 'Coleccionable' },
  { value: 'other',        label: 'Otro' },
]

export const positionTypeLabels: Record<PositionType, string> = {
  spot:      'Spot',
  margin:    'Margen',
  futures:   'Futuros',
  perpetual: 'Perpetuo',
}

export interface Investment {
  id: string
  user_id: string
  organization_id?: string | null
  name: string
  // asset identification
  symbol?: string | null
  ticker?: string | null       // alias for symbol
  type: InvestmentType | string
  asset_type: InvestmentType | string
  // position size & pricing (in investment's own currency)
  quantity: number | null
  buy_price: number | null      // entry price per unit
  avg_buy_price: number | null  // alias
  purchase_price: number | null // alias
  current_price: number | null
  currency: string
  // leveraged position metadata
  position_type: PositionType
  leverage: number
  margin_amount: number | null
  is_short: boolean
  liquidation_price: number | null
  position_status: PositionStatus
  // server-computed equity
  equity: number | null
  // linking
  account_id?: string | null
  fund_from_account_id?: string | null
  notes?: string | null
  created_at: string
  deleted_at?: string | null
}

export interface CreateInvestmentInput {
  user_id: string
  organization_id?: string | null
  name: string
  type: InvestmentType | string
  symbol?: string | null
  ticker?: string | null
  quantity: number
  buy_price?: number | null
  current_price?: number | null
  currency?: string
  notes?: string | null
  account_id?: string | null
  fund_from_account_id?: string | null
  position_type?: PositionType
  leverage?: number
  margin_amount?: number | null
  is_short?: boolean
  liquidation_price?: number | null
  position_status?: PositionStatus
}

export interface InvestmentPriceHistory {
  id: string; investment_id: string; price: number; date: string; created_at: string
}

// ── API calls ──────────────────────────────────────────────────────────────

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

// ── Price fetching via server proxy ────────────────────────────────────────
// Server handles BTC→bitcoin mapping + 60s cache + rate limits.

export async function fetchCryptoPrices(symbols: string[]): Promise<Record<string, { eur: number; usd: number }>> {
  if (!symbols.length) return {}
  try {
    const { data } = await api.get<{ data: Record<string, { eur: number; usd: number }> }>(
      '/api/v1/investments/prices/crypto',
      { symbols: symbols.join(',') }
    )
    return data
  } catch {
    return {}
  }
}

export async function fetchExternalPrice(inv: Investment): Promise<number | null> {
  if ((inv.type ?? inv.asset_type) !== 'crypto') return null
  const sym = (inv.symbol ?? inv.ticker ?? '').toUpperCase()
  if (!sym) return null
  const prices = await fetchCryptoPrices([sym])
  return prices[sym]?.eur ?? null
}

// ── Equity helpers ─────────────────────────────────────────────────────────

/**
 * The "real" value of the position:
 *   - Leveraged (perpetual/futures/margin): margin + unrealised PnL
 *   - Spot: quantity × current_price
 * Returns value in the investment's own currency (USD for most crypto).
 */
export function getPositionEquity(inv: Investment): number {
  if (inv.equity != null) return inv.equity  // prefer server-computed
  const isLeveraged = inv.position_type !== 'spot' && inv.margin_amount != null
  if (isLeveraged) {
    const entry = inv.buy_price ?? inv.avg_buy_price ?? inv.purchase_price
    const cur   = inv.current_price
    const qty   = inv.quantity
    if (entry != null && cur != null && qty != null) {
      const dir = inv.is_short ? -1 : 1
      return (inv.margin_amount ?? 0) + dir * (cur - entry) * qty
    }
    return inv.margin_amount ?? 0
  }
  return (inv.quantity ?? 0) * (inv.current_price ?? inv.buy_price ?? 0)
}

export function getUnrealisedPnl(inv: Investment): number | null {
  const entry = inv.buy_price ?? inv.avg_buy_price ?? inv.purchase_price
  const cur   = inv.current_price
  const qty   = inv.quantity
  if (entry == null || cur == null || qty == null) return null
  const dir = inv.is_short ? -1 : 1
  if (inv.position_type !== 'spot') return dir * (cur - entry) * qty
  return (cur - entry) * qty
}

export function getPnlPercent(inv: Investment): number | null {
  const pnl  = getUnrealisedPnl(inv)
  const base = inv.position_type !== 'spot'
    ? inv.margin_amount
    : ((inv.buy_price ?? inv.avg_buy_price ?? 0) * (inv.quantity ?? 0))
  if (pnl == null || !base) return null
  return (pnl / base) * 100
}

// ── Totals ─────────────────────────────────────────────────────────────────

export interface InvestmentTotals {
  totalValue: number; totalCost: number; totalGain: number; gainPercent: number
  totalProfitLoss: number; profitLossPercent: number; count: number
}

export function calculateTotals(invs: Investment[]): InvestmentTotals {
  let totalValue = 0; let totalCost = 0
  for (const inv of invs) {
    totalValue += getPositionEquity(inv)
    const cost = inv.position_type !== 'spot'
      ? (inv.margin_amount ?? 0)
      : (inv.buy_price ?? inv.avg_buy_price ?? 0) * (inv.quantity ?? 0)
    totalCost += cost
  }
  const totalGain   = totalValue - totalCost
  const gainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0
  return {
    totalValue, totalCost, totalGain, gainPercent,
    totalProfitLoss: totalGain, profitLossPercent: gainPercent,
    count: invs.length,
  }
}

// ── Backward-compat aliases ────────────────────────────────────────────────
export const getUserInvestments = fetchInvestments
export type  PriceHistoryEntry  = InvestmentPriceHistory
export const getPriceHistory    = fetchPriceHistory

export async function updatePrice(id: string, _userId: string, price: number, date: string): Promise<Investment> {
  await addPriceHistory(id, { price, date })
  return updateInvestment(id, { current_price: price })
}
