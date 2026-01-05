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

// Get all investments for user
export async function getUserInvestments(userId: string): Promise<Investment[]> {
  const { data, error } = await supabase
    .from('investments')
    .select('*')
    .eq('user_id', userId)
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

// Placeholder for future external price API integration
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function fetchExternalPrice(_investment: Investment): Promise<number | null> {
  // TODO: In the future, this function could connect to external APIs:
  // - CoinGecko for crypto prices
  // - AlphaVantage for stock prices
  // - Yahoo Finance for general market data
  // 
  // For now, returns null to indicate manual price updates are required.
  // 
  // Example pseudocode:
  // if (investment.type === 'crypto') {
  //   const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${investment.name}&vs_currencies=eur`)
  //   const data = await response.json()
  //   return data[investment.name]?.eur || null
  // }
  
  return null
}
