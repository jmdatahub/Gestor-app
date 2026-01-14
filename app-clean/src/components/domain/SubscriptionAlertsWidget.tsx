import { useEffect, useState } from 'react'
import { Calendar, AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getExpiringSubscriptions, type SubscriptionAlert } from '../../services/subscriptionAlertService'
import { supabase } from '../../lib/supabaseClient'

interface Props {
  userId: string
  organizationId?: string | null
}

export function SubscriptionAlertsWidget({ userId, organizationId }: Props) {
  const [alerts, setAlerts] = useState<SubscriptionAlert[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    loadAlerts()
  }, [userId, organizationId])

  async function loadAlerts() {
    try {
      setLoading(true)
      // Get subscriptions expiring in next 30 days
      const data = await getExpiringSubscriptions(userId, 30, organizationId)
      setAlerts(data)
    } catch (error) {
      console.error('Error loading subscription alerts:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || alerts.length === 0) return null

  return (
    <div className="section-card !p-0 overflow-hidden border-l-4 border-l-orange-400">
      <div className="p-4 bg-orange-50 dark:bg-orange-950/20 border-b border-orange-100 dark:border-orange-900/30 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Calendar className="text-orange-500" size={18} />
          <h3 className="font-semibold text-orange-900 dark:text-orange-100">Próximas Renovaciones</h3>
        </div>
        <span className="text-xs font-medium bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200 px-2 py-0.5 rounded-full">
          {alerts.length}
        </span>
      </div>

      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {alerts.slice(0, 3).map(alert => (
          <div key={alert.id} className="p-3 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`
                w-8 h-8 rounded-lg flex items-center justify-center 
                ${!alert.auto_renew ? 'bg-red-100 text-red-500' : 'bg-blue-100 text-blue-500'}
              `}>
                {!alert.auto_renew ? <AlertTriangle size={16} /> : <RefreshCw size={16} />}
              </div>
              
              <div>
                <p className="font-medium text-sm text-gray-900 dark:text-gray-100">
                  {alert.provider || alert.description}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(alert.subscription_end_date).toLocaleDateString()} 
                  <span className="mx-1">•</span>
                  {alert.days_until_expiry === 0 ? 'Hoy' : `En ${alert.days_until_expiry} días`}
                </p>
              </div>
            </div>

            <div className="text-right">
              <p className="font-bold text-sm text-gray-900 dark:text-gray-100">
                {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(alert.amount)}
              </p>
              {!alert.auto_renew && (
                 <span className="text-[10px] text-red-500 font-medium">Cancelar manual</span>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {alerts.length > 3 && (
        <button 
          onClick={() => navigate('/app/movements?filter=subscriptions')}
          className="w-full py-2 text-xs text-center text-gray-500 hover:text-primary hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
        >
          Ver {alerts.length - 3} más...
        </button>
      )}
    </div>
  )
}
