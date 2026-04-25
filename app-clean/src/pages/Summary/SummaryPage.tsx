import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExportMenu } from '../../components/shared/ExportMenu'
import { ExcelColumn } from '../../utils/excelExport'
import { supabase } from '../../lib/supabaseClient'
import { useWorkspace } from '../../context/WorkspaceContext'
import {
  getMonthlySummary,
  getMonthlyCategoryBreakdown,
  getNetWorthSummary,
  getBalanceHistory,
  getWeeklyHistory,
  getYearlyBreakdown,
  formatCurrency,
  getAccountBalancesSummary,
  type MonthlySummary,
  type CategorySummary,
  type NetWorthSummary,
  type WeeklySummary,
} from '../../services/summaryService'
import { type AccountWithBalance } from '../../services/accountService'
import { useSettings } from '../../context/SettingsContext'
import { useI18n } from '../../hooks/useI18n'
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  CreditCard,
  Calendar,
  Layers,
  BarChart3,
  LineChart as LineIcon,
  Sparkles,
} from 'lucide-react'
import { UiSelect } from '../../components/ui/UiSelect'
import { UiSegmented } from '../../components/ui/UiSegmented'
import { StatCard } from '../../components/shared/StatCard'
import { Panel } from '../../components/shared/Panel'
import { EmptyState } from '../../components/shared/EmptyState'
import { AreaTrendChart } from '../../components/charts/AreaTrendChart'
import { DonutChart } from '../../components/charts/DonutChart'
import { CategoryBarList } from '../../components/charts/CategoryBarList'

type PeriodType = 'monthly' | 'annual'
type Grouping = 'biweekly' | 'weekly' | 'monthly' | 'bimonthly' | 'quarterly'

const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function monthShortLabel(year: number, month: number) {
  return `${MONTHS_ES[month - 1]} ${String(year).slice(2)}`
}

export default function SummaryPage() {
  const navigate = useNavigate()
  const { t, language } = useI18n()
  const { settings, updateSettings } = useSettings()
  const { currentWorkspace } = useWorkspace()
  const locale = language === 'es' ? 'es-ES' : 'en-US'
  const currency = 'EUR'
  const now = new Date()

  const [periodType, setPeriodType] = useState<PeriodType>('monthly')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [grouping, setGrouping] = useState<Grouping>('monthly')
  const [historyMonths, setHistoryMonths] = useState<number>(12)
  const [chartViewType, setChartViewType] = useState<'area' | 'bars'>('area')
  const [chartCumulative, setChartCumulative] = useState(false)

  const rollupEnabled = settings.rollupAccountsByParent

  const [summary, setSummary] = useState<MonthlySummary | null>(null)
  const [categories, setCategories] = useState<CategorySummary[]>([])
  const [netWorth, setNetWorth] = useState<NetWorthSummary | null>(null)
  const [history, setHistory] = useState<MonthlySummary[]>([])
  const [weeklyHistory, setWeeklyHistory] = useState<WeeklySummary[]>([])
  const [accountBalances, setAccountBalances] = useState<AccountWithBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollupEnabled, periodType, year, month, historyMonths, grouping, currentWorkspace])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    try {
      const orgId = currentWorkspace?.id || null
      const accountsPromise = getAccountBalancesSummary(user.id, { includeChildrenRollup: rollupEnabled }, orgId)

      if (periodType === 'monthly') {
        const weeksToFetch = historyMonths * 4
        const [summaryData, categoriesData, netWorthData, historyData, weeklyData, accountsData] = await Promise.all([
          getMonthlySummary(user.id, year, month, { includeChildrenRollup: rollupEnabled }, orgId),
          getMonthlyCategoryBreakdown(user.id, year, month, orgId),
          getNetWorthSummary(user.id, new Date(), orgId),
          getBalanceHistory(user.id, historyMonths, orgId),
          grouping === 'weekly' || grouping === 'biweekly' ? getWeeklyHistory(user.id, weeksToFetch, orgId) : Promise.resolve([]),
          accountsPromise,
        ])
        setSummary(summaryData)
        setCategories(categoriesData)
        setNetWorth(netWorthData)
        setHistory(historyData)
        setWeeklyHistory(weeklyData)
        setAccountBalances(accountsData)
      } else {
        const [yearly, netWorthData, accountsData] = await Promise.all([
          getYearlyBreakdown(user.id, year, orgId),
          getNetWorthSummary(user.id, new Date(), orgId),
          accountsPromise,
        ])
        const annualSummary: MonthlySummary = {
          year,
          month: 0,
          income: yearly.months.reduce((s, m) => s + m.income, 0),
          expenses: yearly.months.reduce((s, m) => s + m.expenses, 0),
          net: yearly.months.reduce((s, m) => s + m.net, 0),
          savingsChange: yearly.months.reduce((s, m) => s + m.savingsChange, 0),
        }
        setSummary(annualSummary)
        setCategories(yearly.categories)
        setNetWorth(netWorthData)
        setHistory(yearly.months)
        setWeeklyHistory([])
        setAccountBalances(accountsData)
      }
    } catch (err) {
      console.error('Error loading summary:', err)
      setError('Error al cargar los datos. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = () => loadData()

  const exportColumns: ExcelColumn[] = [
    { header: 'SECCIÓN', key: 'section', width: 30 },
    { header: 'CONCEPTO', key: 'concept', width: 25 },
    { header: 'VALOR', key: 'value', width: 20 },
    { header: '% / TASA', key: 'percentage', width: 15 },
    { header: 'DETALLES / NOTAS', key: 'details', width: 40 },
  ]

  const exportData = useMemo(() => {
    if (!summary) return []
    const data: any[] = []
    const fmt = (v: number) => formatCurrency(v, locale)
    data.push({ section: 'RESUMEN', concept: 'Ingresos', value: fmt(summary.income), percentage: '100%', details: '' })
    data.push({ section: 'RESUMEN', concept: 'Gastos', value: fmt(summary.expenses), percentage: summary.income > 0 ? ((summary.expenses / summary.income) * 100).toFixed(1) + '%' : '-', details: '' })
    data.push({ section: 'RESUMEN', concept: 'Balance', value: fmt(summary.net), percentage: summary.income > 0 ? ((summary.net / summary.income) * 100).toFixed(1) + '%' : '-', details: '' })
    data.push({ section: 'RESUMEN', concept: 'Ahorro', value: fmt(summary.savingsChange), percentage: '-', details: '' })
    categories.forEach((c) => {
      data.push({
        section: 'CATEGORÍAS',
        concept: c.categoryName,
        value: fmt(c.total),
        percentage: summary.expenses > 0 ? ((c.total / summary.expenses) * 100).toFixed(1) + '%' : '-',
        details: '',
      })
    })
    history.forEach((h) => {
      data.push({
        section: 'HISTORIAL',
        concept: monthShortLabel(h.year, h.month),
        value: fmt(h.net),
        percentage: h.income > 0 ? ((h.net / h.income) * 100).toFixed(1) + '%' : '-',
        details: `Ing: ${fmt(h.income)} | Gas: ${fmt(h.expenses)}`,
      })
    })
    return data
  }, [summary, categories, history, locale])

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i)
  const months = [
    { value: 1, label: t('months.january') },
    { value: 2, label: t('months.february') },
    { value: 3, label: t('months.march') },
    { value: 4, label: t('months.april') },
    { value: 5, label: t('months.may') },
    { value: 6, label: t('months.june') },
    { value: 7, label: t('months.july') },
    { value: 8, label: t('months.august') },
    { value: 9, label: t('months.september') },
    { value: 10, label: t('months.october') },
    { value: 11, label: t('months.november') },
    { value: 12, label: t('months.december') },
  ]

  const periodLabel = periodType === 'monthly' ? `${months.find((m) => m.value === month)?.label} ${year}` : `${year}`

  const chartData = useMemo(() => {
    type ChartPoint = { period: string; income: number; expense: number; net: number }
    let result: ChartPoint[] = []

    if (grouping === 'weekly') {
      result = weeklyHistory.map((w) => ({ period: w.weekLabel, income: w.income, expense: w.expenses, net: w.income - w.expenses }))
    } else if (grouping === 'biweekly') {
      for (let i = 0; i < weeklyHistory.length; i += 2) {
        const w1 = weeklyHistory[i]
        const w2 = weeklyHistory[i + 1]
        if (!w1) continue
        const income = (w1?.income || 0) + (w2?.income || 0)
        const expense = (w1?.expenses || 0) + (w2?.expenses || 0)
        const label = w2 ? `${w1.weekLabel.split(' ')[0]}+${w2.weekLabel.split(' ')[0]}` : w1.weekLabel
        result.push({ period: label, income, expense, net: income - expense })
      }
    } else {
      const groupSize = grouping === 'monthly' ? 1 : grouping === 'bimonthly' ? 2 : 3
      for (let i = 0; i < history.length; i += groupSize) {
        const g = history.slice(i, i + groupSize)
        if (g.length === 0) continue
        const first = g[0]
        const last = g[g.length - 1]
        let label: string
        if (groupSize === 1) label = monthShortLabel(first.year, first.month)
        else if (groupSize === 2) label = `${MONTHS_ES[first.month - 1]}-${MONTHS_ES[last.month - 1]} ${String(last.year).slice(2)}`
        else label = `T${Math.ceil(first.month / 3)} ${String(first.year).slice(2)}`
        const income = g.reduce((s, x) => s + x.income, 0)
        const expense = g.reduce((s, x) => s + x.expenses, 0)
        result.push({ period: label, income, expense, net: income - expense })
      }
    }

    if (chartCumulative && result.length > 0) {
      let ci = 0
      let ce = 0
      result = result.map((p) => {
        ci += p.income
        ce += p.expense
        return { period: p.period, income: ci, expense: ce, net: ci - ce }
      })
    }

    return result
  }, [grouping, history, weeklyHistory, chartCumulative])

  const incomeSpark = useMemo(() => history.map((h) => h.income), [history])
  const expenseSpark = useMemo(() => history.map((h) => h.expenses), [history])
  const netSpark = useMemo(() => history.map((h) => h.net), [history])

  const savingsRate = (summary?.income ?? 0) > 0 ? ((summary!.net) / summary!.income) * 100 : 0

  return (
    <div className="page-container fade-in">
      <div className="page-header print:hidden">
        <div>
          <h1 className="page-title">{t('summary.title')}</h1>
          <p className="page-subtitle">{periodLabel}</p>
        </div>
        <ExportMenu
          data={exportData}
          columns={exportColumns}
          filename={`Resumen_${periodLabel.replace(/ /g, '_')}`}
          buttonLabel={t('summary.download')}
          disabled={loading || !summary}
        />
      </div>

      <Panel
        className="mb-4"
        padding="tight"
        icon={<Calendar size={16} />}
        title="Periodo"
        actions={
          <button className="btn btn-primary" onClick={handleRefresh} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span style={{ marginLeft: 6 }}>{t('summary.update')}</span>
          </button>
        }
      >
        <div className="d-flex flex-wrap items-end gap-3">
          <UiSegmented
            value={periodType}
            onChange={(val) => setPeriodType(val as PeriodType)}
            options={[
              { value: 'monthly', label: t('summary.monthly'), icon: <Calendar size={14} /> },
              { value: 'annual', label: t('summary.annual'), icon: <Calendar size={14} /> },
            ]}
          />
          <div style={{ width: 120 }}>
            <UiSelect
              value={year.toString()}
              onChange={(val) => setYear(parseInt(val))}
              options={years.map((y) => ({ value: y.toString(), label: y.toString() }))}
            />
          </div>
          {periodType === 'monthly' && (
            <div style={{ width: 160 }}>
              <UiSelect
                value={month.toString()}
                onChange={(val) => setMonth(parseInt(val))}
                options={months.map((m) => ({ value: m.value.toString(), label: m.label }))}
              />
            </div>
          )}
        </div>
      </Panel>

      {error && (
        <div className="empty-state" style={{ borderColor: 'var(--danger)', color: 'var(--danger)', marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div className="stat-grid mb-4">
        <StatCard
          label={t('summary.income')}
          value={loading ? '…' : formatCurrency(summary?.income || 0, locale)}
          tone="success"
          icon={<TrendingUp size={18} />}
          sparkline={incomeSpark}
        />
        <StatCard
          label={t('summary.expenses')}
          value={loading ? '…' : formatCurrency(summary?.expenses || 0, locale)}
          tone="danger"
          icon={<TrendingDown size={18} />}
          sparkline={expenseSpark}
        />
        <StatCard
          label={t('summary.netBalance')}
          value={loading ? '…' : formatCurrency(summary?.net || 0, locale)}
          tone={(summary?.net || 0) >= 0 ? 'primary' : 'danger'}
          icon={<Wallet size={18} />}
          helper={summary && summary.income > 0 ? `${savingsRate.toFixed(1)}% de ingresos` : undefined}
          sparkline={netSpark}
        />
        <StatCard
          label={t('summary.savings')}
          value={loading ? '…' : formatCurrency(summary?.savingsChange || 0, locale)}
          tone="primary"
          icon={<PiggyBank size={18} />}
        />
      </div>

      <div className="dash-grid mb-4">
        <div className="col-8">
          <Panel
            title={`Evolución · ${chartCumulative ? 'acumulado' : 'por periodo'}`}
            subtitle={`Últimos ${historyMonths} meses · agrupado por ${grouping}`}
            icon={<BarChart3 size={16} />}
            actions={
              <div className="d-flex gap-2 flex-wrap items-center">
                <UiSegmented
                  value={String(historyMonths)}
                  onChange={(v) => setHistoryMonths(parseInt(v))}
                  options={[
                    { value: '3', label: '3m' },
                    { value: '6', label: '6m' },
                    { value: '12', label: '12m' },
                    { value: '24', label: '24m' },
                  ]}
                />
                <UiSegmented
                  value={grouping}
                  onChange={(v) => setGrouping(v as Grouping)}
                  options={[
                    { value: 'weekly', label: 'Sem' },
                    { value: 'biweekly', label: '2s' },
                    { value: 'monthly', label: 'Mes' },
                    { value: 'bimonthly', label: 'Bim' },
                    { value: 'quarterly', label: 'Trim' },
                  ]}
                />
                <UiSegmented
                  value={chartViewType}
                  onChange={(v) => setChartViewType(v as 'area' | 'bars')}
                  options={[
                    { value: 'area', label: 'Área', icon: <LineIcon size={12} /> },
                    { value: 'bars', label: 'Barras', icon: <BarChart3 size={12} /> },
                  ]}
                />
                <UiSegmented
                  value={chartCumulative ? 'cum' : 'ind'}
                  onChange={(v) => setChartCumulative(v === 'cum')}
                  options={[
                    { value: 'ind', label: 'Ind.' },
                    { value: 'cum', label: 'Σ Acum.' },
                  ]}
                />
              </div>
            }
          >
            {loading ? (
              <div className="chart-frame" style={{ height: 260 }} />
            ) : chartData.length === 0 ? (
              <EmptyState compact title={t('summary.noDataHistory')} icon={<BarChart3 size={24} />} />
            ) : chartViewType === 'area' ? (
              <AreaTrendChart data={chartData} showNet height={280} currency={currency} locale={locale} />
            ) : (
              <BarChartSimple data={chartData} height={260} currency={currency} locale={locale} />
            )}
          </Panel>
        </div>

        <div className="col-4">
          <Panel title={t('summary.spendingBreakdown')} subtitle={periodLabel}>
            {loading ? (
              <div className="chart-frame" style={{ height: 240 }} />
            ) : categories.length === 0 ? (
              <EmptyState compact title={t('summary.noDataSpending')} />
            ) : (
              <>
                <DonutChart
                  data={categories.map((c) => ({ name: c.categoryName, value: c.total, color: c.color }))}
                  height={220}
                  currency={currency}
                  locale={locale}
                  centerLabel="Total"
                  centerValue={formatCurrency(summary?.expenses || 0, locale)}
                  thickness="medium"
                />
                <CategoryBarList
                  data={categories.map((c) => ({ name: c.categoryName, value: c.total, color: c.color }))}
                  max={6}
                  currency={currency}
                  locale={locale}
                />
              </>
            )}
          </Panel>
        </div>
      </div>

      <Panel
        className="mb-4"
        title="Cuentas"
        subtitle="Balance actual por cuenta"
        icon={<CreditCard size={16} />}
        actions={
          <label className="d-flex items-center gap-2 cursor-pointer" style={{ fontSize: 13 }}>
            <span className="muted-sm">{rollupEnabled ? 'Agrupando padres' : 'Cuentas individuales'}</span>
            <button
              type="button"
              onClick={() => updateSettings({ rollupAccountsByParent: !rollupEnabled })}
              style={{
                width: 38,
                height: 22,
                border: 'none',
                borderRadius: 999,
                background: rollupEnabled ? 'var(--primary)' : 'var(--gray-300)',
                position: 'relative',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              aria-pressed={rollupEnabled}
              aria-label="Agrupar cuentas padre"
            >
              <span
                style={{
                  position: 'absolute',
                  top: 2,
                  left: rollupEnabled ? 18 : 2,
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: 'white',
                  transition: 'left 0.2s',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                }}
              />
            </button>
          </label>
        }
      >
        {loading ? (
          <div style={{ height: 80 }} />
        ) : accountBalances.length === 0 ? (
          <EmptyState compact title="Sin cuentas" />
        ) : (
          <div>
            {accountBalances.map((acc) => (
              <div
                key={acc.id}
                className="cat-row"
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/app/accounts/${acc.id}`)}
                title="Ver cuenta"
              >
                {rollupEnabled && <Layers size={14} style={{ color: 'var(--primary)', opacity: 0.7 }} />}
                <span className="cat-row__name">{acc.name}</span>
                <span className="muted-sm" style={{ textTransform: 'capitalize' }}>{acc.type}</span>
                <span
                  className="cat-row__amount"
                  style={{ color: acc.balance >= 0 ? 'var(--text-primary)' : 'var(--danger)' }}
                >
                  {formatCurrency(acc.balance, locale)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title={t('summary.netWorth')}
        subtitle="Composición a fecha actual"
        icon={<Sparkles size={16} />}
      >
        {loading ? (
          <div style={{ height: 120 }} />
        ) : (
          <div className="dash-grid">
            <div className="col-3">
              <StatCard
                label="Cuentas"
                value={formatCurrency(netWorth?.cashBalance || 0, locale)}
                tone="primary"
                icon={<CreditCard size={18} />}
              />
            </div>
            <div className="col-3">
              <StatCard
                label="Inversiones"
                value={formatCurrency(netWorth?.investmentsValue || 0, locale)}
                tone="success"
                icon={<TrendingUp size={18} />}
              />
            </div>
            <div className="col-3">
              <StatCard
                label="Deudas"
                value={`-${formatCurrency(netWorth?.debtsPending || 0, locale)}`}
                tone="danger"
                icon={<Wallet size={18} />}
              />
            </div>
            <div className="col-3">
              <StatCard
                label="Patrimonio neto"
                value={formatCurrency(netWorth?.netWorth || 0, locale)}
                tone={(netWorth?.netWorth || 0) >= 0 ? 'success' : 'danger'}
                icon={<PiggyBank size={18} />}
                helper={netWorth && (netWorth.cashBalance + netWorth.investmentsValue) > 0
                  ? `${((netWorth.cashBalance / (netWorth.cashBalance + netWorth.investmentsValue)) * 100).toFixed(0)}% líquido`
                  : undefined}
              />
            </div>
          </div>
        )}
      </Panel>
    </div>
  )
}

// Inline simple bar chart (alt view)
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

function BarChartSimple({ data, height, currency, locale }: { data: { period: string; income: number; expense: number }[]; height: number; currency: string; locale: string }) {
  const compact = (n: number) => new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(n)
  const fmt = (n: number) => new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)
  return (
    <div className="chart-frame" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
          <XAxis dataKey="period" tickLine={false} axisLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} dy={6} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickFormatter={compact} width={54} />
          <Tooltip
            cursor={{ fill: 'var(--gray-100)', opacity: 0.35 }}
            contentStyle={{ borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}
            formatter={(value: any) => fmt(Number(value))}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} iconType="circle" iconSize={8} />
          <Bar dataKey="income" name="Ingresos" fill="#10b981" radius={[6, 6, 0, 0]} />
          <Bar dataKey="expense" name="Gastos" fill="#ef4444" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
