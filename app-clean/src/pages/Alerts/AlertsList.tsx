import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import {
  getAlerts,
  markAsRead,
  markAllAsRead,
  deleteAlert,
  getAlertIcon,
  getAlertTypeLabel,
  type Alert
} from '../../services/alertService'
import {
  getAlertRules,
  deleteAlertRule,
  toggleAlertRule,
  getSeverityColor,
  type AlertRule
} from '../../services/alertRuleService'
import { runAllChecks } from '../../services/alertEngine'
import { Check, Trash2, Bell, Plus, Power, PowerOff } from 'lucide-react'
import { Breadcrumbs } from '../../components/Breadcrumbs'
import { SkeletonList } from '../../components/Skeleton'
import { UiCard } from '../../components/ui/UiCard'
import { AlertRuleWizard } from '../../components/domain/AlertRuleWizard'




export default function AlertsList() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [rules, setRules] = useState<AlertRule[]>([])
  const [loading, setLoading] = useState(true)
  const [showRuleWizard, setShowRuleWizard] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      await runAllChecks(user.id)
      const [alertsData, rulesData] = await Promise.all([
        getAlerts(user.id),
        getAlertRules(user.id)
      ])
      setAlerts(alertsData)
      setRules(rulesData)
    } catch (error) {
      console.error('Error loading alerts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleRule = async (ruleId: string, isActive: boolean) => {
    try {
      await toggleAlertRule(ruleId, !isActive)
      setRules(prev => prev.map(r => 
        r.id === ruleId ? { ...r, is_active: !isActive } : r
      ))
    } catch (error) {
      console.error('Error toggling rule:', error)
    }
  }

  const handleDeleteRule = async (ruleId: string) => {
    try {
      await deleteAlertRule(ruleId)
      setRules(prev => prev.filter(r => r.id !== ruleId))
    } catch (error) {
      console.error('Error deleting rule:', error)
    }
  }



  const handleMarkAsRead = async (alertId: string) => {
    try {
      await markAsRead(alertId)
      setAlerts(prev => prev.map(a => 
        a.id === alertId ? { ...a, is_read: true } : a
      ))
    } catch (error) {
      console.error('Error marking as read:', error)
    }
  }

  const handleMarkAllAsRead = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      await markAllAsRead(user.id)
      setAlerts(prev => prev.map(a => ({ ...a, is_read: true })))
    } catch (error) {
      console.error('Error marking all as read:', error)
    }
  }

  const handleDelete = async (alertId: string) => {
    try {
      await deleteAlert(alertId)
      setAlerts(prev => prev.filter(a => a.id !== alertId))
    } catch (error) {
      console.error('Error deleting alert:', error)
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  }



  const unreadCount = alerts.filter(a => !a.is_read).length

  if (loading) {
    return <SkeletonList rows={3} />
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <Breadcrumbs items={[
            { label: 'Alertas', icon: <Bell size={16} /> }
          ]} />
          <h1 className="page-title mt-2">Alertas</h1>
          <p className="page-subtitle">
            {unreadCount > 0 
              ? `${unreadCount} alerta${unreadCount !== 1 ? 's' : ''} sin leer`
              : 'Configura alertas automáticas para tu control financiero'}
          </p>
        </div>
        <div className="d-flex gap-2">
          {unreadCount > 0 && (
            <button className="btn btn-secondary" onClick={handleMarkAllAsRead}>
              <Check size={18} />
              Marcar leídas
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setShowRuleWizard(true)}>
            <Plus size={20} />
            Nueva alerta
          </button>
        </div>
      </div>

      {/* Active Rules Summary (if any) */}
      {rules.length > 0 && (
        <UiCard className="mb-4 p-4">
          <div className="d-flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm text-secondary">
              Reglas activas ({rules.filter(r => r.is_active).length})
            </h3>
          </div>
          <div className="d-flex flex-wrap gap-2">
            {rules.map(rule => (
              <div 
                key={rule.id}
                className="d-flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
                style={{
                  backgroundColor: rule.is_active 
                    ? `${getSeverityColor(rule.severity)}15` 
                    : 'var(--gray-100)',
                  opacity: rule.is_active ? 1 : 0.6,
                }}
              >
                <span style={{ color: getSeverityColor(rule.severity) }}>●</span>
                <span>{rule.name}</span>
                <button
                  className="btn-icon-sm ml-1"
                  onClick={() => handleToggleRule(rule.id, rule.is_active)}
                  title={rule.is_active ? 'Desactivar' : 'Activar'}
                  style={{ opacity: 0.6 }}
                >
                  {rule.is_active ? <Power size={14} /> : <PowerOff size={14} />}
                </button>
                <button
                  className="btn-icon-sm text-danger"
                  onClick={() => handleDeleteRule(rule.id)}
                  title="Eliminar"
                  style={{ opacity: 0.6 }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </UiCard>
      )}

      {/* Alerts List */}
      {alerts.length === 0 && rules.length === 0 ? (
        <UiCard className="p-8 d-flex flex-col items-center justify-center text-center">
          <div className="mb-4 text-secondary">
            <Bell size={48} />
          </div>
          <h3 className="text-lg font-bold mb-2">No tienes alertas configuradas</h3>
          <p className="text-secondary mb-4">
            Crea reglas para recibir notificaciones cuando se cumplan ciertas condiciones financieras.
          </p>
          <button className="btn btn-primary" onClick={() => setShowRuleWizard(true)}>
            <Plus size={18} />
            Crear primera alerta
          </button>
        </UiCard>
      ) : alerts.length === 0 ? (
        <UiCard className="p-6 d-flex flex-col items-center justify-center text-center">
          <div className="mb-3 text-secondary">
            <Check size={40} />
          </div>
          <h3 className="text-base font-semibold mb-1">Todo en orden</h3>
          <p className="text-sm text-secondary">
            No hay alertas activas. Tus reglas se están evaluando automáticamente.
          </p>
        </UiCard>
      ) : (
        <div className="d-flex flex-col gap-3">
          {alerts.map((alert) => (
            <UiCard 
              key={alert.id} 
              className="p-4 d-flex items-start gap-4 transition-all"
              style={{
                background: alert.is_read ? 'var(--gray-50)' : 'white',
                borderLeft: alert.is_read ? '4px solid var(--gray-200)' : '4px solid var(--primary)',
              }}
            >
              <div 
                className="d-flex items-center justify-center rounded-lg bg-gray-100 text-xl"
                style={{ width: '48px', height: '48px', flexShrink: 0 }}
              >
                {getAlertIcon(alert.type)}
              </div>
              <div className="flex-1">
                <div className="d-flex items-center gap-2 mb-1">
                  <span className={`badge ${alert.is_read ? 'badge-gray' : 'badge-primary'}`}>
                    {getAlertTypeLabel(alert.type)}
                  </span>
                  <span className="text-sm text-muted">{formatDate(alert.created_at)}</span>
                </div>
                <h4 className="font-bold text-base mb-1">
                  {alert.title}
                </h4>
                <p className="text-sm text-secondary m-0">
                  {alert.message}
                </p>
              </div>
              <div className="d-flex gap-1">
                {!alert.is_read && (
                  <button
                    className="btn btn-icon btn-secondary"
                    onClick={() => handleMarkAsRead(alert.id)}
                    title="Marcar como leído"
                  >
                    <Check size={18} />
                  </button>
                )}
                <button
                  className="btn btn-icon btn-ghost text-danger"
                  onClick={() => handleDelete(alert.id)}
                  title="Eliminar"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </UiCard>
          ))}
        </div>
      )}

      {/* Rule Wizard - Opens when clicking "Nueva alerta" */}
      <AlertRuleWizard
        isOpen={showRuleWizard}
        onClose={() => setShowRuleWizard(false)}
        onSuccess={loadData}
      />
    </div>
  )
}
