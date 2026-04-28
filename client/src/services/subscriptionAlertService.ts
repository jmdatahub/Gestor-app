// Subscription Alert Service - Alerts for expiring subscriptions
import { api } from '../lib/apiClient'

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

  try {
    const { data: allMovements } = await api.get<{ data: any[] }>('/api/v1/movements', { limit: 5000 })
    const todayStr = today.toISOString().split('T')[0]
    const futureDateStr = futureDate.toISOString().split('T')[0]

    const data = (allMovements || []).filter(m =>
      m.isSubscription === true &&
      m.subscriptionEndDate != null &&
      m.subscriptionEndDate >= todayStr &&
      m.subscriptionEndDate <= futureDateStr
    ).sort((a: any, b: any) => (a.subscriptionEndDate || '').localeCompare(b.subscriptionEndDate || ''))

    return data.map((item: any) => {
      const endDate = new Date(item.subscriptionEndDate)
      const daysUntil = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      return {
        id: item.id,
        description: item.description || 'Suscripción',
        provider: item.provider,
        amount: Number(item.amount),
        subscription_end_date: item.subscriptionEndDate,
        auto_renew: item.autoRenew,
        days_until_expiry: daysUntil,
        category_name: item.categoryName || null
      }
    })
  } catch (error) {
    console.error('Error fetching expiring subscriptions:', error)
    return []
  }
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
  try {
    await api.patch('/api/v1/movements/' + id, { subscriptionEndDate: newEndDate })
    return true
  } catch (error) {
    console.error('Error renewing subscription:', error)
    return false
  }
}

// Toggle auto-renew for subscription
export async function toggleAutoRenew(id: string, autoRenew: boolean): Promise<boolean> {
  try {
    await api.patch('/api/v1/movements/' + id, { autoRenew })
    return true
  } catch (error) {
    console.error('Error toggling auto renew:', error)
    return false
  }
}
