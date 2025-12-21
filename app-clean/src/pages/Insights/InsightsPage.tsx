import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import {
  getMonthlyInsights,
  getInsightTypeLabel,
  getInsightIcon,
  type Insight
} from '../../services/insightService'
import { Lightbulb, RefreshCw, BarChart2 } from 'lucide-react'
import { Breadcrumbs } from '../../components/Breadcrumbs'
import { SkeletonKPI } from '../../components/Skeleton'
import { SpendingPieChart } from '../../components/charts/SpendingPieChart'
import { TrendBarChart } from '../../components/charts/TrendBarChart'
import { useI18n } from '../../hooks/useI18n'
import { useSettings } from '../../context/SettingsContext'
import { UiSelect } from '../../components/ui/UiSelect'
import { UiCard } from '../../components/ui/UiCard'
import { UiField } from '../../components/ui/UiField'

export default function InsightsPage() {
  const { t, language } = useI18n()
  const { settings } = useSettings()
  const locale = language === 'es' ? 'es-ES' : 'en-US'
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)
  
  // Chart Data State
  const [pieData, setPieData] = useState<{name: string, value: number}[]>([])
  const [trendData, setTrendData] = useState<{period: string, income: number, expense: number}[]>([])

  useEffect(() => {
    loadInsights()
  }, [])

  const loadInsights = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      const data = await getMonthlyInsights(user.id, year, month, t, locale)
      setInsights(data)
      await loadChartData(user.id)
    } catch (error) {
      console.error('Error loading insights:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadChartData = async (userId: string) => {
    // 1. Pie Chart: Expenses by Category for current month
    const startOfMonth = new Date(year, month - 1, 1).toISOString().split('T')[0]
    const endOfMonth = new Date(year, month, 0).toISOString().split('T')[0]

    const { data: movements } = await supabase
      .from('movements')
      .select('amount, category:categories(name)')
      .eq('user_id', userId)
      .eq('type', 'expense')
      .gte('date', startOfMonth)
      .lte('date', endOfMonth)

    const catMap: Record<string, number> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const safeMovements = (movements || []) as any[]
    
    safeMovements.forEach(m => {
      const catName = Array.isArray(m.category) ? m.category[0]?.name : m.category?.name || 'Otros'
      catMap[catName] = (catMap[catName] || 0) + m.amount
    })

    const newPieData = Object.entries(catMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6) // Top 6 categories

    setPieData(newPieData)

    // 2. Bar Chart: Last 6 months trend
    const trend = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const m = d.getMonth() + 1
      const y = d.getFullYear()
      const s = new Date(y, m - 1, 1).toISOString().split('T')[0]
      const e = new Date(y, m, 0).toISOString().split('T')[0]

      const { data: montlyMovs } = await supabase
        .from('movements')
        .select('type, amount')
        .eq('user_id', userId)
        .gte('date', s)
        .lte('date', e)
        .neq('type', 'transfer_out') // Exclude transfers
        .neq('type', 'transfer_in')

      const income = montlyMovs?.filter(x => x.type === 'income').reduce((acc, curr) => acc + curr.amount, 0) || 0
      const expense = montlyMovs?.filter(x => x.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0) || 0
      
      trend.push({
        period: `${m}/${y}`,
        income,
        expense
      })
    }
    setTrendData(trend)
  }

  const handleRefresh = () => {
    loadInsights()
  }

  const getSeverityStyle = (severity: Insight['severity']) => {
    switch (severity) {
      case 'success':
        return { 
          borderLeft: '4px solid var(--success)',
          background: 'linear-gradient(to right, rgba(16, 185, 129, 0.05), transparent)' 
        }
      case 'warning':
        return { 
          borderLeft: '4px solid var(--warning)',
          background: 'linear-gradient(to right, rgba(245, 158, 11, 0.05), transparent)' 
        }
      default:
        return { 
          borderLeft: '4px solid var(--primary)',
          background: 'linear-gradient(to right, rgba(99, 102, 241, 0.05), transparent)' 
        }
    }
  }

  const getSeverityBadge = (severity: Insight['severity']) => {
    switch (severity) {
      case 'success': return 'badge-success'
      case 'warning': return 'badge-warning'
      default: return 'badge-primary'
    }
  }

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i)
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: new Date(2000, i, 1).toLocaleString(language === 'es' ? 'es-ES' : 'en-US' , { month: 'long' }).replace(/^\w/, c => c.toUpperCase())
  }))


  return (
    <div className="page-container fade-in">
      <div className="page-header">
        <div>
          <Breadcrumbs items={[
            { label: 'Insights', icon: <BarChart2 size={16} /> }
          ]} />
          <h1 className="page-title mt-2">{t('insights.title')}</h1>
          <p className="page-subtitle">{t('insights.subtitle')}</p>
        </div>
        <div className="d-flex gap-2">
           <button 
            className="btn btn-secondary btn-icon" 
            onClick={handleRefresh}
            disabled={loading}
            title="Actualizar análisis"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <UiCard className="mb-6 p-4">
        <div className="d-flex flex-wrap gap-4 items-end">
          <div className="flex-1" style={{ minWidth: '120px' }}>
            <UiField label={t('summary.year')} className="mb-0">
                <UiSelect
                    value={year.toString()}
                    onChange={(val) => setYear(parseInt(val))}
                    options={years.map(y => ({ value: y.toString(), label: y.toString() }))}
                />
            </UiField>
          </div>
          <div className="flex-1" style={{ minWidth: '150px' }}>
             <UiField label={t('summary.month')} className="mb-0">
                <UiSelect
                    value={month.toString()}
                    onChange={(val) => setMonth(parseInt(val))}
                    options={months.map(m => ({ value: m.value.toString(), label: m.label }))}
                />
            </UiField>
          </div>
          <div>
            <button 
                className="btn btn-primary h-[38px]" 
                onClick={handleRefresh}
                disabled={loading}
                style={{ marginTop: 'auto' }}
            >
                {t('insights.analyzePeriod')}
            </button>
          </div>
        </div>
      </UiCard>

      {/* Loading State */}
      {loading && (
         <div className="kpi-grid">
          <SkeletonKPI />
          <SkeletonKPI />
          <SkeletonKPI />
          <SkeletonKPI />
        </div>
      )}

      {/* Charts Section (New) */}
      {!loading && (
        <div className="kpi-grid mb-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))' }}>
          <UiCard className="p-4">
            <h3 className="text-base font-bold text-gray-800 mb-4">{t('insights.spendingByCategory')}</h3>
            {pieData.length > 0 ? (
              <SpendingPieChart data={pieData} />
            ) : (
              <div className="h-64 d-flex items-center justify-center text-secondary">
                {t('insights.noDataSpending')}
              </div>
            )}
          </UiCard>
          <UiCard className="p-4">
            <h3 className="text-base font-bold text-gray-800 mb-4">{t('insights.incomeVsExpense')}</h3>
            <TrendBarChart data={trendData} />
          </UiCard>
        </div>
      )}

      {/* Empty state */}
      {!loading && insights.length === 0 && (
        <UiCard className="p-12 text-center">
          <div className="d-flex justify-center mb-4">
            <div className="p-4 bg-gray-100 rounded-full">
              <Lightbulb size={32} className="text-secondary" />
            </div>
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">{t('insights.noInsights')}</h3>
          <p className="text-secondary max-w-md mx-auto">
            {t('insights.noInsightsDesc')}
          </p>
        </UiCard>
      )}

      {/* Insights list */}
      {!loading && insights.length > 0 && (
        <>
          <h2 className="text-xl font-bold mb-4">{t('insights.detailedAnalysis')}</h2>
          <div className="d-grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))' }}>
            {insights.map((insight) => (
              <UiCard 
                key={insight.id} 
                className="transition-all hover:shadow-md"
                style={{
                  ...getSeverityStyle(insight.severity),
                  display: 'flex',
                  alignItems: 'start',
                  gap: '1rem',
                  padding: '1.5rem'
                }}
              >
                <div 
                  className="d-flex items-center justify-center bg-white shadow-sm border border-gray-100 rounded-xl"
                  style={{ width: 48, height: 48, fontSize: '1.5rem', flexShrink: 0 }}
                >
                  {getInsightIcon(insight.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="d-flex items-center gap-2 mb-2">
                    <span className={`badge ${getSeverityBadge(insight.severity)}`}>
                      {getInsightTypeLabel(insight.type, t)}
                    </span>
                    <span className="text-xs text-muted ml-auto">{insight.period}</span>
                  </div>
                  <h3 className="font-bold text-gray-800 mb-1">{insight.title}</h3>
                  <p className="text-sm text-secondary leading-relaxed">{insight.description}</p>
                </div>
              </UiCard>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
