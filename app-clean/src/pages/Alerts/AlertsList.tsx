import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import {
  getAlerts,
  markAsRead,
  markAllAsRead,
  deleteAlert,
  snoozeAlert,
  getAlertStats,
  getAlertIcon,
  getAlertTypeLabel,
  getSeverityColor,
  getSeverityLabel,
  getSeverityOrder,
  SNOOZE_PRESETS,
  getSnoozeUntil,
  type Alert,
  type AlertSeverity,
} from '../../services/alertService'
import {
  getAlertRules,
  deleteAlertRule,
  toggleAlertRule,
  getSeverityColor as getRuleSeverityColor,
  getRuleDescription,
  getRuleTypeIcon,
  getPeriodLabel,
  getTriggerModeLabel,
  type AlertRule,
} from '../../services/alertRuleService'
import { runAllChecks } from '../../services/alertEngine'
import { evaluateAlertRules } from '../../services/alertRuleEngine'
import {
  Check,
  Trash2,
  Bell,
  Plus,
  Power,
  PowerOff,
  BellOff,
  ArrowRight,
  BarChart2,
  AlertTriangle,
  Info,
  Zap,
  Clock,
  RefreshCw,
} from 'lucide-react'
import { Breadcrumbs } from '../../components/Breadcrumbs'
import { SkeletonList } from '../../components/Skeleton'
import { UiCard } from '../../components/ui/UiCard'
import { AlertRuleWizard } from '../../components/domain/AlertRuleWizard'

type FilterType = 'all' | 'unread' | 'info' | 'warning' | 'danger'
type SortMode = 'date' | 'severity'

export default function AlertsList() {
  const navigate = useNavigate()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [rules, setRules] = useState<AlertRule[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showRuleWizard, setShowRuleWizard] = useState(false)
  const [filter, setFilter] = useState<FilterType>('all')
  const [sort, setSort] = useState<SortMode>('severity')
  const [snoozeMenuId, setSnoozeMenuId] = useState<string | null>(null)
  const [stats, setStats] = useState({ total: 0, unread: 0, bySeverity: { info: 0, warning: 0, danger: 0 }, thisWeek: 0 })

  useEffect(() => {
    loadData()
  }, [])

  // Close snooze menu on outside click
  useEffect(() => {
    if (!snoozeMenuId) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-snooze-container]')) {
        setSnoozeMenuId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [snoozeMenuId])

  const loadData = async (showRefreshing = false) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (showRefreshing) setRefreshing(true)

    try {
      await Promise.all([
        runAllChecks(user.id),
        evaluateAlertRules(user.id),
      ])
      const [alertsData, rulesData, statsData] = await Promise.all([
        getAlerts(user.id),
        getAlertRules(user.id),
        getAlertStats(user.id),
      ])
      setAlerts(alertsData)
      setRules(rulesData)
      setStats(statsData)
    } catch (error) {
      console.error('Error loading alerts:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleToggleRule = async (ruleId: string, isActive: boolean) => {
    await toggleAlertRule(ruleId, !isActive)
    setRules(prev => prev.map(r => r.id === ruleId ? { ...r, is_active: !isActive } : r))
  }

  const handleDeleteRule = async (ruleId: string) => {
    await deleteAlertRule(ruleId)
    setRules(prev => prev.filter(r => r.id !== ruleId))
  }

  const handleMarkAsRead = async (alertId: string) => {
    await markAsRead(alertId)
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, is_read: true } : a))
    setStats(prev => ({ ...prev, unread: Math.max(0, prev.unread - 1) }))
  }

  const handleMarkAllAsRead = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await markAllAsRead(user.id)
    setAlerts(prev => prev.map(a => ({ ...a, is_read: true })))
    setStats(prev => ({ ...prev, unread: 0 }))
  }

  const handleDelete = async (alertId: string) => {
    const alert = alerts.find(a => a.id === alertId)
    await deleteAlert(alertId)
    setAlerts(prev => prev.filter(a => a.id !== alertId))
    if (alert && !alert.is_read) {
      setStats(prev => ({ ...prev, unread: Math.max(0, prev.unread - 1), total: prev.total - 1 }))
    } else {
      setStats(prev => ({ ...prev, total: prev.total - 1 }))
    }
  }

  const handleSnooze = async (alertId: string, hours: number) => {
    const until = getSnoozeUntil(hours)
    await snoozeAlert(alertId, until)
    setAlerts(prev => prev.filter(a => a.id !== alertId))
    setSnoozeMenuId(null)
  }

  const handleQuickAction = (alert: Alert) => {
    if (alert.action_url) navigate(alert.action_url)
  }

  // ─── Filtering & sorting ─────────────────────────────────────────────────────

  const filteredAlerts = alerts.filter(a => {
    if (filter === 'unread') return !a.is_read
    if (filter === 'info' || filter === 'warning' || filter === 'danger') return a.severity === filter
    return true
  })

  const sortedAlerts = [...filteredAlerts].sort((a, b) => {
    if (sort === 'severity') {
      const sevDiff = getSeverityOrder(a.severity as AlertSeverity) - getSeverityOrder(b.severity as AlertSeverity)
      if (sevDiff !== 0) return sevDiff
      // Within same severity: unread first, then by date
      if (a.is_read !== b.is_read) return a.is_read ? 1 : -1
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const unreadCount = alerts.filter(a => !a.is_read).length

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })

  const formatRelativeDate = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `Hace ${mins}m`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `Hace ${hours}h`
    const days = Math.floor(hours / 24)
    if (days < 7) return `Hace ${days}d`
    return formatDate(date)
  }

  if (loading) return <SkeletonList rows={3} />

  const FILTERS: { key: FilterType; label: string; count?: number }[] = [
    { key: 'all', label: 'Todas', count: stats.total },
    { key: 'unread', label: 'Sin leer', count: stats.unread },
    { key: 'danger', label: 'Críticas', count: stats.bySeverity.danger },
    { key: 'warning', label: 'Advertencias', count: stats.bySeverity.warning },
    { key: 'info', label: 'Informativas', count: stats.bySeverity.info },
  ]

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <Breadcrumbs items={[{ label: 'Alertas', icon: <Bell size={16} /> }]} />
          <h1 className="page-title mt-2">Alertas</h1>
          <p className="page-subtitle">
            {unreadCount > 0
              ? `${unreadCount} alerta${unreadCount !== 1 ? 's' : ''} sin leer`
              : 'Todo al día — sin alertas pendientes'}
          </p>
        </div>
        <div className="d-flex gap-2 items-center">
          <button
            className="btn btn-icon btn-secondary"
            onClick={() => loadData(true)}
            title="Actualizar"
            style={{ opacity: refreshing ? 0.6 : 1 }}
            disabled={refreshing}
          >
            <RefreshCw size={18} className={refreshing ? 'spin' : ''} />
          </button>
          {unreadCount > 0 && (
            <button className="btn btn-secondary" onClick={handleMarkAllAsRead}>
              <Check size={18} />
              Marcar leídas
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setShowRuleWizard(true)}>
            <Plus size={20} />
            Nueva regla
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {stats.total > 0 && (
        <div className="d-flex gap-3 mb-4 flex-wrap">
          <StatPill icon={<BarChart2 size={14} />} label="Total" value={stats.total} color="var(--gray-600)" />
          <StatPill icon={<Bell size={14} />} label="Sin leer" value={stats.unread} color="var(--primary)" />
          <StatPill icon={<AlertTriangle size={14} />} label="Críticas" value={stats.bySeverity.danger} color="#ef4444" />
          <StatPill icon={<Zap size={14} />} label="Advertencias" value={stats.bySeverity.warning} color="#f59e0b" />
          <StatPill icon={<Info size={14} />} label="Esta semana" value={stats.thisWeek} color="#6b7280" />
        </div>
      )}

      {/* Active Rules */}
      {rules.length > 0 && (
        <UiCard className="mb-4 p-4">
          <div className="d-flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text-secondary)' }}>
              Reglas activas ({rules.filter(r => r.is_active).length} / {rules.length})
            </h3>
          </div>
          <div className="d-flex flex-col gap-2">
            {rules.map(rule => (
              <div
                key={rule.id}
                className="d-flex items-center gap-3 px-3 py-2 rounded-lg"
                style={{
                  backgroundColor: rule.is_active
                    ? `${getRuleSeverityColor(rule.severity)}12`
                    : 'var(--gray-50)',
                  opacity: rule.is_active ? 1 : 0.55,
                  border: `1px solid ${rule.is_active ? getRuleSeverityColor(rule.severity) + '30' : 'var(--gray-200)'}`,
                }}
              >
                <span style={{ fontSize: '18px' }}>{getRuleTypeIcon(rule.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{rule.name}</div>
                  <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {getRuleDescription(rule)} · {getPeriodLabel(rule.period)} · {getTriggerModeLabel(rule.trigger_mode)}
                  </div>
                  {rule.last_triggered_at && (
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      <Clock size={10} className="inline mr-1" />
                      Última vez: {formatRelativeDate(rule.last_triggered_at)}
                    </div>
                  )}
                </div>
                <div className="d-flex gap-1 items-center shrink-0">
                  <span
                    className="px-2 py-0.5 rounded text-xs font-medium"
                    style={{
                      backgroundColor: getRuleSeverityColor(rule.severity) + '20',
                      color: getRuleSeverityColor(rule.severity),
                    }}
                  >
                    {getSeverityLabel(rule.severity as AlertSeverity)}
                  </span>
                  <button
                    className="btn-icon-sm ml-1"
                    onClick={() => handleToggleRule(rule.id, rule.is_active)}
                    title={rule.is_active ? 'Desactivar' : 'Activar'}
                  >
                    {rule.is_active ? <Power size={14} /> : <PowerOff size={14} />}
                  </button>
                  <button
                    className="btn-icon-sm text-danger"
                    onClick={() => handleDeleteRule(rule.id)}
                    title="Eliminar regla"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </UiCard>
      )}

      {/* Filter & Sort bar */}
      {alerts.length > 0 && (
        <div className="d-flex items-center justify-between mb-3 gap-3 flex-wrap">
          <div className="d-flex gap-2 flex-wrap">
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className="px-3 py-1.5 rounded-full text-sm font-medium transition-all"
                style={{
                  backgroundColor: filter === f.key ? 'var(--primary)' : 'var(--gray-100)',
                  color: filter === f.key ? 'white' : 'var(--text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {f.label}
                {f.count !== undefined && f.count > 0 && (
                  <span
                    className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs"
                    style={{
                      backgroundColor: filter === f.key ? 'rgba(255,255,255,0.3)' : 'var(--gray-300)',
                    }}
                  >
                    {f.count}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="d-flex gap-2 items-center">
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Orden:</span>
            <button
              onClick={() => setSort(s => s === 'date' ? 'severity' : 'date')}
              className="px-3 py-1.5 rounded-full text-sm font-medium"
              style={{
                backgroundColor: 'var(--gray-100)',
                color: 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {sort === 'date' ? '📅 Fecha' : '🔺 Severidad'}
            </button>
          </div>
        </div>
      )}

      {/* Alert list */}
      {alerts.length === 0 && rules.length === 0 ? (
        <EmptyState onCreateRule={() => setShowRuleWizard(true)} />
      ) : sortedAlerts.length === 0 ? (
        <UiCard className="p-6 d-flex flex-col items-center justify-center text-center">
          <Check size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
          <h3 className="text-base font-semibold mb-1">
            {filter === 'all' ? 'Todo en orden' : `Sin alertas en este filtro`}
          </h3>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {filter !== 'all' && (
              <button
                onClick={() => setFilter('all')}
                style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Ver todas las alertas
              </button>
            )}
          </p>
        </UiCard>
      ) : (
        <div className="d-flex flex-col gap-3">
          {sortedAlerts.map((alert) => {
            const color = getSeverityColor(alert.severity as AlertSeverity)
            const isSnoozeOpen = snoozeMenuId === alert.id
            return (
              <UiCard
                key={alert.id}
                className="p-4 transition-all"
                style={{
                  background: alert.is_read ? 'var(--gray-50)' : 'white',
                  borderLeft: `4px solid ${alert.is_read ? 'var(--gray-200)' : color}`,
                  opacity: alert.is_read ? 0.85 : 1,
                  position: 'relative',
                }}
              >
                <div className="d-flex items-start gap-4">
                  {/* Icon */}
                  <div
                    className="d-flex items-center justify-center rounded-lg text-xl shrink-0"
                    style={{
                      width: '44px',
                      height: '44px',
                      backgroundColor: alert.is_read ? 'var(--gray-100)' : `${color}15`,
                    }}
                  >
                    {getAlertIcon(alert.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="d-flex items-center gap-2 mb-1 flex-wrap">
                      <span
                        className="px-2 py-0.5 rounded text-xs font-semibold"
                        style={{
                          backgroundColor: alert.is_read ? 'var(--gray-200)' : `${color}20`,
                          color: alert.is_read ? 'var(--text-secondary)' : color,
                        }}
                      >
                        {getSeverityLabel(alert.severity as AlertSeverity)}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded text-xs"
                        style={{ backgroundColor: 'var(--gray-100)', color: 'var(--text-secondary)' }}
                      >
                        {getAlertTypeLabel(alert.type)}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {formatRelativeDate(alert.created_at)}
                      </span>
                      {!alert.is_read && (
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: color, display: 'inline-block' }}
                          title="Sin leer"
                        />
                      )}
                    </div>

                    <h4 className="font-bold text-base mb-0.5">{alert.title}</h4>
                    <p className="text-sm m-0" style={{ color: 'var(--text-secondary)' }}>
                      {alert.message}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="d-flex gap-1 items-center shrink-0">
                    {/* Quick navigate */}
                    {alert.action_url && (
                      <button
                        className="btn btn-icon btn-secondary"
                        onClick={() => handleQuickAction(alert)}
                        title="Ver detalles"
                        style={{ fontSize: '12px' }}
                      >
                        <ArrowRight size={16} />
                      </button>
                    )}

                    {/* Snooze */}
                    <div data-snooze-container style={{ position: 'relative' }}>
                      <button
                        className="btn btn-icon btn-secondary"
                        onClick={() => setSnoozeMenuId(isSnoozeOpen ? null : alert.id)}
                        title="Posponer"
                      >
                        <BellOff size={16} />
                      </button>
                      {isSnoozeOpen && (
                        <div
                          style={{
                            position: 'absolute',
                            right: 0,
                            top: '100%',
                            marginTop: '4px',
                            backgroundColor: 'white',
                            border: '1px solid var(--gray-200)',
                            borderRadius: '8px',
                            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                            zIndex: 50,
                            minWidth: '140px',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            className="px-3 py-2 text-xs font-semibold"
                            style={{ color: 'var(--text-muted)', backgroundColor: 'var(--gray-50)', borderBottom: '1px solid var(--gray-100)' }}
                          >
                            Posponer
                          </div>
                          {SNOOZE_PRESETS.map(preset => (
                            <button
                              key={preset.hours}
                              onClick={() => handleSnooze(alert.id, preset.hours)}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'block', width: '100%' }}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Mark read */}
                    {!alert.is_read && (
                      <button
                        className="btn btn-icon btn-secondary"
                        onClick={() => handleMarkAsRead(alert.id)}
                        title="Marcar como leído"
                      >
                        <Check size={16} />
                      </button>
                    )}

                    {/* Delete */}
                    <button
                      className="btn btn-icon btn-ghost text-danger"
                      onClick={() => handleDelete(alert.id)}
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </UiCard>
            )
          })}
        </div>
      )}

      {/* Rule Wizard */}
      <AlertRuleWizard
        isOpen={showRuleWizard}
        onClose={() => setShowRuleWizard(false)}
        onSuccess={() => loadData()}
      />
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatPill({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div
      className="d-flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
      style={{ backgroundColor: 'var(--gray-50)', border: '1px solid var(--gray-200)' }}
    >
      <span style={{ color }}>{icon}</span>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className="font-bold" style={{ color }}>{value}</span>
    </div>
  )
}

function EmptyState({ onCreateRule }: { onCreateRule: () => void }) {
  return (
    <UiCard className="p-8 d-flex flex-col items-center justify-center text-center">
      <div className="mb-4" style={{ color: 'var(--text-muted)' }}>
        <Bell size={48} />
      </div>
      <h3 className="text-lg font-bold mb-2">Sin alertas configuradas</h3>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)', maxWidth: '380px' }}>
        Crea reglas personalizadas para recibir alertas cuando se cumplan condiciones financieras: gastos altos, deudas próximas, objetivos de ahorro, inversiones en caída y más.
      </p>
      <button className="btn btn-primary" onClick={onCreateRule}>
        <Plus size={18} />
        Crear primera regla
      </button>
    </UiCard>
  )
}

