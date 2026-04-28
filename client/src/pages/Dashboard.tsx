import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

import { warmup as warmupCache } from '../services/catalogCache'
import {
  ArrowRight,
  Bell,
  Clock,
  Layers,
  Plus,
  PiggyBank,
  TrendingUp,
  TrendingDown,
  Wallet,
  Activity,
  Sparkles,
  CreditCard,
  LineChart,
  ReceiptText,
} from 'lucide-react'
import { useI18n } from '../hooks/useI18n'
import { useSettings } from '../context/SettingsContext'
import { SkeletonDashboard } from '../components/Skeleton'

import { useAccountsSummary, useFinancialDistribution, useTopAccounts } from '../hooks/queries/useDashboardAccounts'
import { useMonthlyMovementsSummary, usePendingClassificationCount, usePendingRecurringCount } from '../hooks/queries/useDashboardMovements'
import { useMonthlyTrend, useDailySpending, useMonthTopCategories } from '../hooks/queries/useDashboardTrend'

import { useWorkspace } from '../context/WorkspaceContext'
import { PendingInvitations } from '../components/invitations/PendingInvitations'
import { BudgetWidget } from '../components/BudgetWidget'
import { SubscriptionAlertsWidget } from '../components/domain/SubscriptionAlertsWidget'
import { UiBanner } from '../components/ui/UiBanner'
import { ClassifyMovementsModal } from '../components/domain/ClassifyMovementsModal'

import { StatCard } from '../components/shared/StatCard'
import { Panel } from '../components/shared/Panel'
import { EmptyState } from '../components/shared/EmptyState'
import { AreaTrendChart } from '../components/charts/AreaTrendChart'
import { HeatmapCalendar } from '../components/charts/HeatmapCalendar'
import { DonutChart } from '../components/charts/DonutChart'
import { CategoryBarList } from '../components/charts/CategoryBarList'
import { HealthGauge } from '../components/charts/HealthGauge'

const WORKSPACE_ROLES: Record<string, { label: string; className: string }> = {
  owner: { label: 'Propietario', className: 'pill pill--violet' },
  admin: { label: 'Admin', className: 'pill pill--primary' },
  member: { label: 'Miembro', className: 'pill' },
  viewer: { label: 'Visor', className: 'pill' },
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { t, language } = useI18n()
  const { settings } = useSettings()
  const { currentWorkspace, workspaces, isLoading: workspaceLoading, userRole, switchWorkspace, refreshWorkspaces } = useWorkspace()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  const workspaceId = currentWorkspace?.id || null
  const locale = language === 'es' ? 'es-ES' : 'en-US'

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserEmail(user.email || null)
        setUserId(user.id)
        warmupCache(user.id, workspaceId)
      }
    })
  }, [workspaceId])

  const { data: accountsSummary = { totalBalance: 0, accountCount: 0 }, isLoading: isAccountsLoading } = useAccountsSummary(userId, workspaceId)
  const { data: monthlySummary = { income: 0, expense: 0, balance: 0 }, isLoading: isMonthlyLoading } = useMonthlyMovementsSummary(userId, workspaceId)
  const { data: financialOverview, isLoading: isFinancialLoading } = useFinancialDistribution(userId, workspaceId)
  const { data: topAccounts = [], isLoading: isTopAccountsLoading } = useTopAccounts(userId, workspaceId, settings.rollupAccountsByParent)
  const { data: pendingCount = 0 } = usePendingRecurringCount(userId)
  const { data: uncategorizedCount = 0 } = usePendingClassificationCount(userId, workspaceId)
  const [showClassifyModal, setShowClassifyModal] = useState(false)

  const { data: trendData = [] } = useMonthlyTrend(userId, workspaceId, 6)
  const { data: dailyData = [] } = useDailySpending(userId, workspaceId, 126)

  const today = new Date()
  const { data: categorySlices = [] } = useMonthTopCategories(userId, workspaceId, today.getFullYear(), today.getMonth() + 1, 'expense')

  const loading = isAccountsLoading || isMonthlyLoading || isFinancialLoading || isTopAccountsLoading || !userId

  const handleInvitationAccepted = async () => {
    await refreshWorkspaces()
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount)

  const { incomeTrend, expenseTrend, savingsRate, healthScore, healthDescription } = useMemo(() => {
    if (!trendData || trendData.length < 2) {
      return { incomeTrend: 0, expenseTrend: 0, savingsRate: 0, healthScore: 0, healthDescription: 'Añade movimientos para calcular tu salud financiera.' }
    }
    const [prev, current] = [trendData[trendData.length - 2], trendData[trendData.length - 1]]
    const incomeTrend = prev.income > 0 ? ((current.income - prev.income) / prev.income) * 100 : 0
    const expenseTrend = prev.expense > 0 ? ((current.expense - prev.expense) / prev.expense) * 100 : 0
    const savingsRate = current.income > 0 ? ((current.income - current.expense) / current.income) * 100 : 0

    let score = 50
    if (savingsRate > 30) score += 25
    else if (savingsRate > 15) score += 15
    else if (savingsRate > 5) score += 5
    else if (savingsRate < 0) score -= 25

    if (expenseTrend < -5) score += 10
    else if (expenseTrend > 10) score -= 10

    if (incomeTrend > 5) score += 10
    else if (incomeTrend < -10) score -= 10

    score = Math.max(0, Math.min(100, score))
    const desc = savingsRate >= 20
      ? 'Estás ahorrando de forma excelente este mes.'
      : savingsRate >= 10
        ? 'Buen ritmo de ahorro, sigue así.'
        : savingsRate >= 0
          ? 'Tu balance es positivo pero el margen es ajustado.'
          : 'Este mes estás gastando más de lo que ingresas.'

    return { incomeTrend, expenseTrend, savingsRate, healthScore: score, healthDescription: desc }
  }, [trendData])

  const incomeSparkline = useMemo(() => trendData.map(t => t.income), [trendData])
  const expenseSparkline = useMemo(() => trendData.map(t => t.expense), [trendData])
  const netSparkline = useMemo(() => trendData.map(t => t.net), [trendData])

  const monthLabel = useMemo(() => {
    const m = new Date().toLocaleString(locale, { month: 'long' })
    return m.charAt(0).toUpperCase() + m.slice(1)
  }, [locale])

  const pieCenterTotal = useMemo(
    () => categorySlices.reduce((sum, c) => sum + c.value, 0),
    [categorySlices],
  )

  if (loading || workspaceLoading) {
    return <SkeletonDashboard />
  }

  const roleMeta = userRole ? WORKSPACE_ROLES[userRole] : null

  return (
    <div className="page-container fade-in">
      <header className="page-header" style={{ alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
            <h1 className="page-title" style={{ margin: 0 }}>
              {currentWorkspace ? currentWorkspace.name : t('dashboard.title')}
            </h1>
            {roleMeta && <span className={roleMeta.className}>{roleMeta.label}</span>}
          </div>
          <p className="page-subtitle">
            {currentWorkspace
              ? `Vista financiera de ${currentWorkspace.name}`
              : t('dashboard.subtitle')}
          </p>
        </div>

        {workspaces.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select
              value={currentWorkspace?.id || 'personal'}
              onChange={(e) => switchWorkspace(e.target.value === 'personal' ? null : e.target.value)}
              className="ui-control"
              style={{ maxWidth: 220 }}
            >
              <option value="personal">🏠 Personal</option>
              {workspaces.map(ws => (
                <option key={ws.org_id} value={ws.org_id}>🏢 {ws.organization.name}</option>
              ))}
            </select>
          </div>
        )}
      </header>

      <PendingInvitations
        userEmail={userEmail}
        userId={userId}
        onInvitationAccepted={handleInvitationAccepted}
      />

      {userId && (
        <div className="mb-6">
          <SubscriptionAlertsWidget userId={userId} organizationId={currentWorkspace?.id} />
        </div>
      )}

      {pendingCount > 0 && (
        <UiBanner
          type="warning"
          icon={<Clock size={20} />}
          title={`${pendingCount} ${pendingCount === 1 ? 'movimiento pendiente' : 'movimientos pendientes'}`}
          description="Generados automáticamente por tus reglas recurrentes"
          action={
            <button className="btn btn-warning" onClick={() => navigate('/app/recurring/pending')} style={{ whiteSpace: 'nowrap' }}>
              <Bell size={16} /> Revisar
            </button>
          }
        />
      )}

      {uncategorizedCount > 0 && (
        <UiBanner
          type="danger"
          icon={<Bell size={20} />}
          title={`${uncategorizedCount} ${uncategorizedCount === 1 ? 'movimiento sin clasificar' : 'movimientos sin clasificar'}`}
          description="Asígnales una categoría para mejorar tus estadísticas."
          action={
            <button className="btn btn-danger" style={{ whiteSpace: 'nowrap' }} onClick={() => setShowClassifyModal(true)}>
              Clasificar
            </button>
          }
        />
      )}

      <ClassifyMovementsModal isOpen={showClassifyModal} onClose={() => setShowClassifyModal(false)} />

      <div className="stat-grid stat-grid--4" style={{ marginBottom: 20 }}>
        <StatCard
          label={t('dashboard.balance')}
          value={formatCurrency(accountsSummary.totalBalance)}
          icon={<Wallet size={18} />}
          tone="primary"
          helper={`${accountsSummary.accountCount} ${accountsSummary.accountCount === 1 ? 'cuenta' : 'cuentas'}`}
          sparkline={netSparkline}
        />
        <StatCard
          label={`${t('dashboard.income')} · ${monthLabel}`}
          value={formatCurrency(monthlySummary.income)}
          icon={<TrendingUp size={18} />}
          tone="success"
          trend={{ value: incomeTrend }}
          sparkline={incomeSparkline}
        />
        <StatCard
          label={`${t('dashboard.expenses')} · ${monthLabel}`}
          value={formatCurrency(monthlySummary.expense)}
          icon={<TrendingDown size={18} />}
          tone="danger"
          trend={{ value: expenseTrend, invert: true }}
          sparkline={expenseSparkline}
        />
        <StatCard
          label="Ahorro neto · mes"
          value={formatCurrency(monthlySummary.income - monthlySummary.expense)}
          icon={<PiggyBank size={18} />}
          tone={monthlySummary.income - monthlySummary.expense >= 0 ? 'neutral' : 'warning'}
          helper={`${savingsRate.toFixed(0)}% tasa de ahorro`}
          sparkline={netSparkline}
        />
      </div>

      <div className="dash-grid" style={{ marginBottom: 20 }}>
        <div className="col-8">
          <Panel
            title="Evolución financiera"
            subtitle="Ingresos vs gastos últimos 6 meses"
            icon={<LineChart size={16} style={{ color: 'var(--primary)' }} />}
            actions={
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/app/summary')}>
                Resumen completo <ArrowRight size={14} />
              </button>
            }
          >
            {trendData.length > 0 ? (
              <AreaTrendChart data={trendData} showNet height={280} locale={locale} />
            ) : (
              <EmptyState
                icon={<LineChart size={28} />}
                title="Aún no hay historial"
                description="Cuando registres movimientos verás aquí la evolución mensual."
              />
            )}
          </Panel>
        </div>

        <div className="col-4">
          <Panel title="Salud financiera" subtitle="Basado en tus últimos 30 días" icon={<Activity size={16} style={{ color: 'var(--success)' }} />}>
            <HealthGauge score={healthScore} description={healthDescription} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
              <div className="cat-row" style={{ padding: '6px 0' }}>
                <span className="cat-row__name">Tasa de ahorro</span>
                <span className="cat-row__amount" style={{ color: savingsRate >= 15 ? 'var(--success)' : savingsRate >= 0 ? 'var(--text-primary)' : 'var(--danger)' }}>
                  {savingsRate.toFixed(1)}%
                </span>
              </div>
              <div className="cat-row" style={{ padding: '6px 0' }}>
                <span className="cat-row__name">Variación gastos</span>
                <span className="cat-row__amount" style={{ color: expenseTrend <= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {expenseTrend > 0 ? '+' : ''}{expenseTrend.toFixed(1)}%
                </span>
              </div>
              <div className="cat-row" style={{ padding: '6px 0' }}>
                <span className="cat-row__name">Variación ingresos</span>
                <span className="cat-row__amount" style={{ color: incomeTrend >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {incomeTrend > 0 ? '+' : ''}{incomeTrend.toFixed(1)}%
                </span>
              </div>
            </div>
          </Panel>
        </div>

        <div className="col-5">
          <Panel
            title={`Gastos · ${monthLabel}`}
            subtitle="Distribución por categoría"
            icon={<ReceiptText size={16} style={{ color: 'var(--danger)' }} />}
            actions={
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/app/insights')}>
                Insights <ArrowRight size={14} />
              </button>
            }
          >
            {categorySlices.length > 0 ? (
              <>
                <DonutChart
                  data={categorySlices.slice(0, 7)}
                  centerLabel="Total"
                  centerValue={formatCurrency(pieCenterTotal)}
                  locale={locale}
                />
                <div style={{ marginTop: 12 }}>
                  <CategoryBarList data={categorySlices} max={5} locale={locale} />
                </div>
              </>
            ) : (
              <EmptyState icon={<ReceiptText size={28} />} title="Sin gastos este mes" description="Cuando registres gastos, los verás aquí desglosados." compact />
            )}
          </Panel>
        </div>

        <div className="col-7">
          <Panel
            title="Patrón de gasto"
            subtitle="Intensidad diaria últimas 18 semanas"
            icon={<Sparkles size={16} style={{ color: 'var(--chart-violet)' }} />}
          >
            {dailyData.length > 0 ? (
              <HeatmapCalendar data={dailyData} weeks={18} locale={locale} tone="danger" />
            ) : (
              <EmptyState icon={<Sparkles size={28} />} title="Sin datos de gasto" compact />
            )}
          </Panel>
        </div>

        <div className="col-6">
          <Panel
            title="Top cuentas"
            subtitle="Por balance disponible"
            icon={<CreditCard size={16} style={{ color: 'var(--primary)' }} />}
            actions={
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/app/accounts')}>
                Ver todas <ArrowRight size={14} />
              </button>
            }
          >
            {topAccounts.length === 0 ? (
              <EmptyState icon={<Wallet size={28} />} title="Sin cuentas" description="Crea tu primera cuenta para empezar." compact />
            ) : (
              <div>
                {topAccounts.map(acc => (
                  <div className="cat-row" key={acc.id}>
                    <span className="cat-row__dot" style={{ background: (acc as any).color || 'var(--primary)' }} />
                    <span className="cat-row__name">
                      {acc.name}
                      {settings.rollupAccountsByParent && (acc as any).child_ids && (acc as any).child_ids.length > 0 && (
                        <Layers size={12} style={{ opacity: 0.5, marginLeft: 6, verticalAlign: 'middle' }} />
                      )}
                    </span>
                    <span className="cat-row__amount" style={{ color: acc.balance >= 0 ? 'var(--text-primary)' : 'var(--danger)' }}>
                      {formatCurrency(acc.balance)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="col-6">
          <Panel title="Acciones rápidas" icon={<Plus size={16} style={{ color: 'var(--primary)' }} />}>
            <div className="flex gap-3 flex-wrap">
              <button className="btn btn-primary" onClick={() => navigate('/app/movements')}>
                <Plus size={18} /> Nuevo movimiento
              </button>
              <button className="btn btn-secondary" onClick={() => navigate('/app/accounts')}>
                <Wallet size={18} /> {t('accounts.title')}
              </button>
              <button className="btn btn-secondary" onClick={() => navigate('/app/summary')}>
                <TrendingUp size={18} /> {t('nav.summary')}
              </button>
              <button className="btn btn-secondary" onClick={() => navigate('/app/insights')}>
                <LineChart size={18} /> Insights
              </button>
              <button className="btn btn-secondary" onClick={() => navigate('/app/settings')}>Ajustes</button>
            </div>
          </Panel>

          {userId && <div style={{ marginTop: 20 }}><BudgetWidget userId={userId} /></div>}
        </div>

        {financialOverview && (
          <div className="col-12">
            <Panel
              title="Distribución de patrimonio"
              subtitle="Reparto entre liquidez, ahorro, inversión y deuda"
              icon={<PiggyBank size={16} style={{ color: 'var(--chart-teal)' }} />}
            >
              <NetWorthSection overview={financialOverview} locale={locale} />
            </Panel>
          </div>
        )}
      </div>
    </div>
  )
}

function NetWorthSection({ overview, locale }: { overview: any; locale: string }) {
  const slices = (overview?.distribution ?? [])
    .filter((d: any) => d.value > 0)
    .map((d: any) => ({ name: d.label ?? d.name, value: d.value, color: d.color }))

  const total = slices.reduce((s: number, d: any) => s + d.value, 0)
  const fmt = (n: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 360px) 1fr', gap: 24, alignItems: 'center' }}>
      <DonutChart
        data={slices}
        centerLabel="Patrimonio"
        centerValue={fmt(total)}
        height={260}
        locale={locale}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <CategoryBarList data={slices} max={8} locale={locale} />
      </div>
    </div>
  )
}
