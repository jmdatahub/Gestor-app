import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import {
  getMonthlyInsights,
  getInsightTypeLabel,
  getInsightIcon,
  type Insight,
} from '../../services/insightService'
import {
  BarChart2,
  Lightbulb,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Wallet,
  Sparkles,
  ArrowLeftRight,
  CalendarRange,
} from 'lucide-react'
import { Breadcrumbs } from '../../components/Breadcrumbs'
import { SkeletonKPI } from '../../components/Skeleton'
import { useI18n } from '../../hooks/useI18n'
import { useWorkspace } from '../../context/WorkspaceContext'
import { UiSelect } from '../../components/ui/UiSelect'
import { UiField } from '../../components/ui/UiField'
import { StatCard } from '../../components/shared/StatCard'
import { Panel } from '../../components/shared/Panel'
import { EmptyState } from '../../components/shared/EmptyState'
import { AreaTrendChart } from '../../components/charts/AreaTrendChart'
import { DonutChart } from '../../components/charts/DonutChart'
import { CategoryBarList } from '../../components/charts/CategoryBarList'
import { HeatmapCalendar } from '../../components/charts/HeatmapCalendar'
import { ComparisonBars } from '../../components/charts/ComparisonBars'
import {
  useMonthlyTrend,
  useDailySpending,
  useMonthTopCategories,
} from '../../hooks/queries/useDashboardTrend'

function prevMonth(year: number, month: number) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
}

function severityTone(severity: Insight['severity']): 'success' | 'warning' | 'neutral' {
  if (severity === 'success') return 'success'
  if (severity === 'warning') return 'warning'
  return 'neutral'
}

export default function InsightsPage() {
  const { t, language } = useI18n()
  const { user } = useAuth()
  const { currentWorkspace } = useWorkspace()
  const locale = language === 'es' ? 'es-ES' : 'en-US'
  const currency = 'EUR'
  const workspaceId = currentWorkspace?.id || null

  const now = new Date()
  const userId = user?.id ?? null
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [insights, setInsights] = useState<Insight[]>([])
  const [loadingInsights, setLoadingInsights] = useState(true)


  useEffect(() => {
    if (!userId) return
    let cancelled = false
    setLoadingInsights(true)
    getMonthlyInsights(userId, year, month, t, locale)
      .then((data) => {
        if (!cancelled) setInsights(data)
      })
      .catch((err) => console.error('Error loading insights:', err))
      .finally(() => {
        if (!cancelled) setLoadingInsights(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId, year, month, t, locale])

  const { data: trend6 = [] } = useMonthlyTrend(userId, workspaceId, 6)
  const { data: trend12 = [] } = useMonthlyTrend(userId, workspaceId, 12)
  const { data: daily = [] } = useDailySpending(userId, workspaceId, 126)

  const { data: currentCats = [], isLoading: catsLoading } = useMonthTopCategories(
    userId,
    workspaceId,
    year,
    month,
    'expense',
  )
  const prev = useMemo(() => prevMonth(year, month), [year, month])
  const { data: prevCats = [] } = useMonthTopCategories(
    userId,
    workspaceId,
    prev.year,
    prev.month,
    'expense',
  )

  const selectedMonthKey = useMemo(
    () => `${year}-${String(month).padStart(2, '0')}`,
    [year, month],
  )
  const prevMonthKey = useMemo(
    () => `${prev.year}-${String(prev.month).padStart(2, '0')}`,
    [prev],
  )

  const currentMonthTrend = useMemo(
    () => trend12.find((p) => p.periodKey === selectedMonthKey),
    [trend12, selectedMonthKey],
  )
  const prevMonthTrend = useMemo(
    () => trend12.find((p) => p.periodKey === prevMonthKey),
    [trend12, prevMonthKey],
  )

  const currentIncome = currentMonthTrend?.income ?? 0
  const currentExpense = currentMonthTrend?.expense ?? 0
  const currentNet = currentIncome - currentExpense
  const prevIncome = prevMonthTrend?.income ?? 0
  const prevExpense = prevMonthTrend?.expense ?? 0

  const incomeTrend = prevIncome > 0 ? ((currentIncome - prevIncome) / prevIncome) * 100 : 0
  const expenseTrend = prevExpense > 0 ? ((currentExpense - prevExpense) / prevExpense) * 100 : 0
  const savingsRate = currentIncome > 0 ? (currentNet / currentIncome) * 100 : 0
  const prevSavingsRate = prevIncome > 0 ? ((prevIncome - prevExpense) / prevIncome) * 100 : 0
  const savingsRateTrend = prevSavingsRate !== 0 ? savingsRate - prevSavingsRate : 0

  const topCurrentNames = useMemo(() => currentCats.slice(0, 6).map((c) => c.name), [currentCats])
  const categoryCompare = useMemo(() => {
    const prevMap = new Map(prevCats.map((c) => [c.name, c.value]))
    const currMap = new Map(currentCats.map((c) => [c.name, c.value]))
    return topCurrentNames.map((name) => ({
      period: name.length > 14 ? name.slice(0, 13) + '…' : name,
      current: currMap.get(name) ?? 0,
      previous: prevMap.get(name) ?? 0,
    }))
  }, [topCurrentNames, currentCats, prevCats])

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)

  const incomeSparkline = useMemo(() => trend6.map((p) => p.income), [trend6])
  const expenseSparkline = useMemo(() => trend6.map((p) => p.expense), [trend6])
  const netSparkline = useMemo(() => trend6.map((p) => p.net), [trend6])

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i)
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: new Date(2000, i, 1)
      .toLocaleString(locale, { month: 'long' })
      .replace(/^\w/, (c) => c.toUpperCase()),
  }))

  const handleRefresh = () => {
    if (!userId) return
    setLoadingInsights(true)
    getMonthlyInsights(userId, year, month, t, locale)
      .then(setInsights)
      .finally(() => setLoadingInsights(false))
  }

  const periodLabel = `${months[month - 1]?.label} ${year}`
  const prevPeriodLabel = `${months[prev.month - 1]?.label} ${prev.year}`

  return (
    <div className="page-container fade-in">
      <div className="page-header">
        <div>
          <Breadcrumbs items={[{ label: 'Insights', icon: <BarChart2 size={16} /> }]} />
          <h1 className="page-title mt-2">{t('insights.title')}</h1>
          <p className="page-subtitle">{t('insights.subtitle')}</p>
        </div>
        <div className="d-flex gap-2">
          <button
            className="btn btn-secondary btn-icon"
            onClick={handleRefresh}
            disabled={loadingInsights}
            title="Actualizar análisis"
          >
            <RefreshCw size={18} className={loadingInsights ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <Panel
        className="mb-4"
        padding="tight"
        icon={<CalendarRange size={16} />}
        title="Periodo de análisis"
        subtitle={`Comparando ${periodLabel} vs ${prevPeriodLabel}`}
        actions={
          <button
            className="btn btn-primary"
            onClick={handleRefresh}
            disabled={loadingInsights}
          >
            {t('insights.analyzePeriod')}
          </button>
        }
      >
        <div className="d-flex flex-wrap gap-3 items-end">
          <div style={{ flex: '0 0 140px' }}>
            <UiField label={t('summary.year')} className="mb-0">
              <UiSelect
                value={year.toString()}
                onChange={(val) => setYear(parseInt(val))}
                options={years.map((y) => ({ value: y.toString(), label: y.toString() }))}
              />
            </UiField>
          </div>
          <div style={{ flex: '0 0 180px' }}>
            <UiField label={t('summary.month')} className="mb-0">
              <UiSelect
                value={month.toString()}
                onChange={(val) => setMonth(parseInt(val))}
                options={months.map((m) => ({ value: m.value.toString(), label: m.label }))}
              />
            </UiField>
          </div>
        </div>
      </Panel>

      <div className="stat-grid mb-4">
        <StatCard
          label="Ingresos"
          value={formatCurrency(currentIncome)}
          tone="success"
          icon={<TrendingUp size={18} />}
          trend={{ value: incomeTrend, label: 'vs mes anterior' }}
          helper={`Anterior: ${formatCurrency(prevIncome)}`}
          sparkline={incomeSparkline}
        />
        <StatCard
          label="Gastos"
          value={formatCurrency(currentExpense)}
          tone="danger"
          icon={<TrendingDown size={18} />}
          trend={{ value: expenseTrend, label: 'vs mes anterior', invert: true }}
          helper={`Anterior: ${formatCurrency(prevExpense)}`}
          sparkline={expenseSparkline}
        />
        <StatCard
          label="Balance"
          value={formatCurrency(currentNet)}
          tone={currentNet >= 0 ? 'primary' : 'danger'}
          icon={<Wallet size={18} />}
          helper={currentNet >= 0 ? 'Superávit del mes' : 'Déficit del mes'}
          sparkline={netSparkline}
        />
        <StatCard
          label="Tasa de ahorro"
          value={`${savingsRate.toFixed(1)}%`}
          tone={savingsRate >= 20 ? 'success' : savingsRate >= 0 ? 'warning' : 'danger'}
          icon={<Sparkles size={18} />}
          trend={savingsRateTrend !== 0 ? { value: savingsRateTrend, label: 'pp vs mes anterior' } : undefined}
          helper={savingsRate >= 20 ? 'Muy saludable' : savingsRate >= 10 ? 'Aceptable' : 'Revisar gastos'}
        />
      </div>

      <div className="dash-grid mb-4">
        <div className="col-8">
          <Panel
            title="Evolución mensual"
            subtitle="Ingresos, gastos y neto en los últimos 12 meses"
            icon={<BarChart2 size={16} />}
          >
            {trend12.length === 0 ? (
              <EmptyState
                compact
                icon={<BarChart2 size={24} />}
                title="Sin datos"
                description="Añade movimientos para ver tu evolución."
              />
            ) : (
              <AreaTrendChart data={trend12} showNet height={300} currency={currency} locale={locale} />
            )}
          </Panel>
        </div>
        <div className="col-4">
          <Panel
            title="Comparativa rápida"
            subtitle={`${periodLabel} vs ${prevPeriodLabel}`}
            icon={<ArrowLeftRight size={16} />}
          >
            <div className="cat-row" style={{ borderBottom: '1px solid var(--border-color)' }}>
              <span className="cat-row__name">Ingresos</span>
              <span className="cat-row__amount" style={{ color: 'var(--chart-positive)' }}>
                {formatCurrency(currentIncome)}
              </span>
            </div>
            <div className="cat-row" style={{ borderBottom: '1px solid var(--border-color)' }}>
              <span className="cat-row__name">Gastos</span>
              <span className="cat-row__amount" style={{ color: 'var(--chart-negative)' }}>
                {formatCurrency(currentExpense)}
              </span>
            </div>
            <div className="cat-row" style={{ borderBottom: '1px solid var(--border-color)' }}>
              <span className="cat-row__name">Balance</span>
              <span
                className="cat-row__amount"
                style={{ color: currentNet >= 0 ? 'var(--chart-positive)' : 'var(--chart-negative)' }}
              >
                {formatCurrency(currentNet)}
              </span>
            </div>
            <div className="cat-row">
              <span className="cat-row__name">Δ Gastos</span>
              <span
                className="cat-row__amount"
                style={{ color: expenseTrend > 0 ? 'var(--chart-negative)' : 'var(--chart-positive)' }}
              >
                {expenseTrend > 0 ? '+' : ''}
                {expenseTrend.toFixed(1)}%
              </span>
            </div>
            <div className="cat-row">
              <span className="cat-row__name">Δ Ingresos</span>
              <span
                className="cat-row__amount"
                style={{ color: incomeTrend >= 0 ? 'var(--chart-positive)' : 'var(--chart-negative)' }}
              >
                {incomeTrend > 0 ? '+' : ''}
                {incomeTrend.toFixed(1)}%
              </span>
            </div>
          </Panel>
        </div>
      </div>

      <div className="dash-grid mb-4">
        <div className="col-5">
          <Panel
            title="Distribución de gastos"
            subtitle={periodLabel}
          >
            {catsLoading ? (
              <div style={{ height: 280 }} className="skeleton rounded" />
            ) : currentCats.length === 0 ? (
              <EmptyState
                compact
                title={t('insights.noDataSpending')}
                description="Sin gastos registrados este mes."
              />
            ) : (
              <>
                <DonutChart
                  data={currentCats}
                  height={240}
                  currency={currency}
                  locale={locale}
                  centerLabel="Total"
                  centerValue={formatCurrency(currentExpense)}
                  thickness="medium"
                />
                <CategoryBarList
                  data={currentCats}
                  max={5}
                  currency={currency}
                  locale={locale}
                />
              </>
            )}
          </Panel>
        </div>
        <div className="col-7">
          <Panel
            title="Comparativa por categoría"
            subtitle={`Top gastos ${periodLabel} vs ${prevPeriodLabel}`}
            icon={<ArrowLeftRight size={16} />}
          >
            {categoryCompare.length === 0 ? (
              <EmptyState
                compact
                title="Sin datos comparativos"
                description="Necesitamos al menos un mes con gastos para comparar."
              />
            ) : (
              <ComparisonBars
                data={categoryCompare}
                currentLabel={periodLabel}
                previousLabel={prevPeriodLabel}
                currency={currency}
                locale={locale}
                tone="negative"
                height={280}
              />
            )}
          </Panel>
        </div>
      </div>

      <Panel
        className="mb-4"
        title="Patrón de gasto diario"
        subtitle="Mapa de calor de los últimos 126 días"
      >
        {daily.length === 0 ? (
          <EmptyState compact title="Sin datos" description="Añade movimientos para ver tu patrón diario." />
        ) : (
          <HeatmapCalendar data={daily} weeks={18} tone="danger" currency={currency} locale={locale} />
        )}
      </Panel>

      <Panel
        title={t('insights.detailedAnalysis')}
        icon={<Lightbulb size={16} />}
        subtitle="Detectamos patrones relevantes en tu actividad financiera"
      >
        {loadingInsights ? (
          <div className="stat-grid">
            <SkeletonKPI />
            <SkeletonKPI />
            <SkeletonKPI />
            <SkeletonKPI />
          </div>
        ) : insights.length === 0 ? (
          <EmptyState
            icon={<Lightbulb size={28} />}
            title={t('insights.noInsights')}
            description={t('insights.noInsightsDesc')}
          />
        ) : (
          <div className="d-grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
            {insights.map((insight) => {
              const tone = severityTone(insight.severity)
              return (
                <div key={insight.id} className={`stat-card stat-card--${tone}`} style={{ gap: 10 }}>
                  <span className="stat-card__accent" />
                  <div className="stat-card__head">
                    <span className="stat-card__label">
                      {getInsightTypeLabel(insight.type, t)}
                    </span>
                    <span className="stat-card__icon">{getInsightIcon(insight.type)}</span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                    {insight.title}
                  </div>
                  <div className="muted-sm" style={{ lineHeight: 1.5 }}>{insight.description}</div>
                  <div className="stat-card__meta">
                    <span className="muted-sm">{insight.period}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Panel>
    </div>
  )
}
