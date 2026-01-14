import { supabase } from '../lib/supabaseClient'
import { createMovement } from './movementService'

// Types
export interface Investment {
  id: string
  user_id: string
  name: string
  type: string // crypto, collectible, stock, fund, manual, etc.
  quantity: number
  buy_price: number
  current_price: number
  currency: string
  notes: string | null
  account_id?: string | null // Account where the investment is held
  created_at: string
  updated_at: string | null
}

export interface PriceHistoryEntry {
  id: string
  investment_id: string
  user_id: string
  price: number
  date: string
  created_at: string
}

export interface CreateInvestmentInput {
  user_id: string
  organization_id?: string | null  // Add organization support
  name: string
  type: string
  quantity: number
  buy_price: number
  current_price: number
  currency?: string
  notes?: string | null
  account_id?: string | null
  fund_from_account_id?: string | null // Optional: Account to deduct funds from
}

// Get all investments for user (filtered by organization if provided)
export async function getUserInvestments(userId: string, organizationId: string | null = null): Promise<Investment[]> {
  let query = supabase
    .from('investments')
    .select('*')
    .eq('user_id', userId)
  
  // Filter by organization_id (null for personal, specific ID for org)
  if (organizationId) {
    query = query.eq('organization_id', organizationId)
  } else {
    query = query.is('organization_id', null)
  }
  
  const { data, error } = await query
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching investments:', error)
    throw error
  }
  return data || []
}

// Get single investment
export async function getInvestmentById(investmentId: string): Promise<Investment | null> {
  const { data, error } = await supabase
    .from('investments')
    .select('*')
    .eq('id', investmentId)
    .single()

  if (error) {
    console.error('Error fetching investment:', error)
    throw error
  }
  return data
}

// Create new investment
export async function createInvestment(input: CreateInvestmentInput): Promise<Investment> {
  // Extract non-DB fields
  const { fund_from_account_id, ...dbInput } = input

  const { data, error } = await supabase
    .from('investments')
    .insert([{
      ...dbInput,
      currency: input.currency || 'EUR'
    }])
    .select()
    .single()

  if (error) {
    console.error('Error creating investment:', error)
    throw error
  }

  // Add initial price history entry
  await addPriceHistoryEntry(data.id, input.user_id, input.current_price, new Date().toISOString().split('T')[0])

  // If funding account specified, create expense
  if (fund_from_account_id) {
    const totalCost = input.quantity * input.buy_price
    if (totalCost > 0) {
      try {
        await createMovement({
          user_id: input.user_id,
          account_id: fund_from_account_id,
          kind: 'expense',
          amount: totalCost,
          date: new Date().toISOString().split('T')[0],
          description: `Inversión: ${input.name}`,
          category_id: null // Could map to 'Inversión' category if it exists
        })
      } catch (err) {
        console.error('Error creating expense for investment:', err)
      }
    }
  }

  return data
}

// Update investment
export async function updateInvestment(investmentId: string, updates: Partial<Investment>): Promise<Investment> {
  const { data, error } = await supabase
    .from('investments')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', investmentId)
    .select()
    .single()

  if (error) {
    console.error('Error updating investment:', error)
    throw error
  }
  return data
}

// Delete investment
export async function deleteInvestment(investmentId: string): Promise<void> {
  // First delete price history
  await supabase
    .from('investment_price_history')
    .delete()
    .eq('investment_id', investmentId)

  // Then delete investment
  const { error } = await supabase
    .from('investments')
    .delete()
    .eq('id', investmentId)

  if (error) {
    console.error('Error deleting investment:', error)
    throw error
  }
}

// Update price and record history
export async function updatePrice(investmentId: string, userId: string, newPrice: number, date: string): Promise<void> {
  // Update current price
  await supabase
    .from('investments')
    .update({ 
      current_price: newPrice,
      updated_at: new Date().toISOString()
    })
    .eq('id', investmentId)

  // Add history entry
  await addPriceHistoryEntry(investmentId, userId, newPrice, date)
}

// Add price history entry
export async function addPriceHistoryEntry(
  investmentId: string, 
  userId: string, 
  price: number, 
  date: string
): Promise<PriceHistoryEntry> {
  const { data, error } = await supabase
    .from('investment_price_history')
    .insert([{
      investment_id: investmentId,
      user_id: userId,
      price,
      date
    }])
    .select()
    .single()

  if (error) {
    console.error('Error adding price history:', error)
    throw error
  }
  return data
}

// Get price history for investment
export async function getPriceHistory(investmentId: string): Promise<PriceHistoryEntry[]> {
  const { data, error } = await supabase
    .from('investment_price_history')
    .select('*')
    .eq('investment_id', investmentId)
    .order('date', { ascending: true })

  if (error) {
    console.error('Error fetching price history:', error)
    throw error
  }
  return data || []
}

// Calculate totals
export function calculateTotals(investments: Investment[]) {
  const totalValue = investments.reduce((sum, inv) => sum + (inv.quantity * inv.current_price), 0)
  const totalCost = investments.reduce((sum, inv) => sum + (inv.quantity * inv.buy_price), 0)
  const totalProfitLoss = totalValue - totalCost
  const profitLossPercent = totalCost > 0 ? ((totalProfitLoss / totalCost) * 100) : 0

  return {
    totalValue,
    totalCost,
    totalProfitLoss,
    profitLossPercent,
    count: investments.length
  }
}

// Investment types for dropdown
export const investmentTypes = [
  { value: 'crypto', label: 'Criptomoneda' },
  { value: 'stock', label: 'Acción' },
  { value: 'fund', label: 'Fondo de inversión' },
  { value: 'etf', label: 'ETF' },
  { value: 'collectible', label: 'Coleccionable' },
  { value: 'real_estate', label: 'Inmobiliario' },
  { value: 'manual', label: 'Otro / Manual' }
]

// Crypto name to CoinGecko ID mapping
const CRYPTO_ID_MAP: Record<string, string> = {
  'bitcoin': 'bitcoin',
  'btc': 'bitcoin',
  'ethereum': 'ethereum',
  'eth': 'ethereum',
  'ripple': 'ripple',
  'xrp': 'ripple',
  'cardano': 'cardano',
  'ada': 'cardano',
  'solana': 'solana',
  'sol': 'solana',
  'polkadot': 'polkadot',
  'dot': 'polkadot',
  'dogecoin': 'dogecoin',
  'doge': 'dogecoin',
  'litecoin': 'litecoin',
  'ltc': 'litecoin',
  'avalanche': 'avalanche-2',
  'avax': 'avalanche-2',
  'chainlink': 'chainlink',
  'link': 'chainlink',
  'polygon': 'matic-network',
  'matic': 'matic-network',
}

/**
 * Fetch current price from CoinGecko API (free, no API key required)
 * Supports crypto only for now
 */
export async function fetchExternalPrice(investment: Investment): Promise<number | null> {
  if (investment.type !== 'crypto') {
    // Only crypto supported for now
    return null
  }

  try {
    // Normalize investment name to lowercase and find CoinGecko ID
    const normalizedName = investment.name.toLowerCase().trim()
    const coinId = CRYPTO_ID_MAP[normalizedName] || normalizedName

    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=eur`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      }
    )

    if (!response.ok) {
      console.warn(`CoinGecko API error: ${response.status}`)
      return null
    }

    const data = await response.json()
    const price = data[coinId]?.eur

    if (typeof price === 'number') {
      return price
    }

    console.warn(`Price not found for ${coinId}`)
    return null
  } catch (error) {
    console.error('Error fetching external price:', error)
    return null
  }
}

/**
 * Fetch prices for multiple cryptos at once (more efficient)
 */
export async function fetchMultipleCryptoPrices(names: string[]): Promise<Record<string, number>> {
  const coinIds = names.map(name => {
    const normalized = name.toLowerCase().trim()
    return CRYPTO_ID_MAP[normalized] || normalized
  })

  const uniqueIds = [...new Set(coinIds)]
  
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${uniqueIds.join(',')}&vs_currencies=eur`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      }
    )

    if (!response.ok) {
      console.warn(`CoinGecko API error: ${response.status}`)
      return {}
    }

    const data = await response.json()
    const result: Record<string, number> = {}

    names.forEach((name, index) => {
      const coinId = coinIds[index]
      if (data[coinId]?.eur) {
        result[name.toLowerCase()] = data[coinId].eur
      }
    })

    return result
  } catch (error) {
    console.error('Error fetching multiple prices:', error)
    return {}
  }
}
