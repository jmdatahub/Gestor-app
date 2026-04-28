// Subscription Alert Service - Alerts for expiring subscriptions
import { supabase } from '../lib/supabaseClient'

export interface SubscriptionAlert {
  id: string
  description: string
  provider: string | null
  amount: number
  subscription_end_date: string
  auto_renew: boolean
  days_until_expiry: number
  category_name: string | null
}

// Get subscriptions expiring within X days
export async function getExpiringSubscriptions(
  userId: string,
  daysAhead: number = 30,
  organizationId?: string | null
): Promise<SubscriptionAlert[]> {
  const today = new Date()
  const futureDate = new Date()
  futureDate.setDate(today.getDate() + daysAhead)

  const { data, error } = await supabase
    .from('movements')
    .select(`
      id,
      description,
      provider,
      amount,
      subscription_end_date,
      auto_renew,
      category_id,
      categories(name)
    `)
    .eq('user_id', userId)
    .eq('is_subscription', true)
    .gte('subscription_end_date', today.toISOString().split('T')[0])
    .lte('subscription_end_date', futureDate.toISOString().split('T')[0])
    .order('subscription_end_date', { ascending: true })

  if (error) {
    console.error('Error fetching expiring subscriptions:', error)
    return []
  }

  return (data || []).map(item => {
    const endDate = new Date(item.subscription_end_date)
    const daysUntil = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    
    return {
      id: item.id,
      description: item.description || 'Suscripción',
      provider: item.provider,
      amount: item.amount,
      subscription_end_date: item.subscription_end_date,
      auto_renew: item.auto_renew,
      days_until_expiry: daysUntil,
      category_name: (item.categories as any)?.name || null
    }
  })
}

// Get subscriptions that user wants to cancel (auto_renew = false)
export async function getSubscriptionsToCancel(
  userId: string,
  daysAhead: number = 7
): Promise<SubscriptionAlert[]> {
  const subscriptions = await getExpiringSubscriptions(userId, daysAhead)
  return subscriptions.filter(s => s.auto_renew === false)
}

// Get subscriptions expiring today
export async function getSubscriptionsExpiringToday(userId: string): Promise<SubscriptionAlert[]> {
  return getExpiringSubscriptions(userId, 0)
}

// Count pending subscriptions alerts
export async function countPendingSubscriptionAlerts(userId: string): Promise<{
  expiringIn7Days: number
  toCancel: number
}> {
  const [expiring, toCancel] = await Promise.all([
    getExpiringSubscriptions(userId, 7),
    getSubscriptionsToCancel(userId, 7)
  ])

  return {
    expiringIn7Days: expiring.length,
    toCancel: toCancel.length
  }
}

// Mark subscription as renewed (extend end date)
export async function renewSubscription(
  id: string,
  newEndDate: string
): Promise<boolean> {
  const { error } = await supabase
    .from('movements')
    .update({ subscription_end_date: newEndDate })
    .eq('id', id)

  if (error) {
    console.error('Error renewing subscription:', error)
    return false
  }

  return true
}

// Toggle auto-renew for subscription
export async function toggleAutoRenew(id: string, autoRenew: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('movements')
    .update({ auto_renew: autoRenew })
    .eq('id', id)

  if (error) {
    console.error('Error toggling auto renew:', error)
    return false
  }

  return true
}
