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
  formatCurrency,
  getAccountBalancesSummary,
  type MonthlySummary,
  type CategorySummary,
  type NetWorthSummary,
  type WeeklySummary
} from '../../services/summaryService'
import { downloadFile, exportSummaryToExcel } from '../../services/exportService'
import { type AccountWithBalance } from '../../services/accountService'
import { useSettings } from '../../context/SettingsContext'
import { useI18n } from '../../hooks/useI18n'
import { RefreshCw, TrendingUp, TrendingDown, Wallet, PiggyBank, CreditCard, Download, Calendar, Layers, FileText, FileJson, Printer, Table, BarChart3 } from 'lucide-react'
import { UiCard, UiCardHeader, UiCardBody } from '../../components/ui/UiCard'
import { UiSelect } from '../../components/ui/UiSelect'
import { UiSegmented } from '../../components/ui/UiSegmented'
import { UiDropdown, UiDropdownItem } from '../../components/ui/UiDropdown'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

type PeriodType = 'monthly' | 'annual'

export default function SummaryPage() {
  const navigate = useNavigate()
  const { t, language } = useI18n()
  const { settings, updateSettings } = useSettings()
  const { currentWorkspace } = useWorkspace()  // Add workspace context
  const locale = language === 'es' ? 'es-ES' : 'en-US'
  const now = new Date()
  const [periodType, setPeriodType] = useState<PeriodType>('monthly')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [chartGrouping, setChartGrouping] = useState<0.25 | 0.5 | 1 | 2 | 3>(1) // 0.25=bi-weekly, 0.5=weekly, 1=monthly, 2=bi-monthly, 3=quarterly
  const [historyMonths, setHistoryMonths] = useState<number>(12) // 3, 6, 12, or 24 months
  const [chartViewType, setChartViewType] = useState<'bars' | 'lines'>('bars') // Toggle between bar chart and line chart
  
  // Roll-up state from context
  const rollupEnabled = settings.rollupAccountsByParent

  const [summary, setSummary] = useState<MonthlySummary | null>(null)
  const [categories, setCategories] = useState<CategorySummary[]>([])
  const [netWorth, setNetWorth] = useState<NetWorthSummary | null>(null)
  const [history, setHistory] = useState<MonthlySummary[]>([])
  const [weeklyHistory, setWeeklyHistory] = useState<WeeklySummary[]>([])
  const [accountBalances, setAccountBalances] = useState<AccountWithBalance[]>([])
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Reload when workspace or settings change
  useEffect(() => {
    loadData()
  }, [rollupEnabled, periodType, year, month, historyMonths, chartGrouping, currentWorkspace])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      const orgId = currentWorkspace?.id || null  // Get current workspace
      
      // Common data
      const accountsPromise = getAccountBalancesSummary(user.id, { includeChildrenRollup: rollupEnabled }, orgId)

      if (periodType === 'monthly') {
        // Fetch monthly history always, and weekly if needed
        const weeksToFetch = historyMonths * 4 // ~4 weeks per month
        
        const [summaryData, categoriesData, netWorthData, historyData, weeklyData, accountsData] = await Promise.all([
          getMonthlySummary(user.id, year, month, { includeChildrenRollup: rollupEnabled }, orgId),
          getMonthlyCategoryBreakdown(user.id, year, month, orgId),
          getNetWorthSummary(user.id, new Date(), orgId),
          getBalanceHistory(user.id, historyMonths, orgId),
          (chartGrouping === 0.5 || chartGrouping === 0.25) ? getWeeklyHistory(user.id, weeksToFetch, orgId) : Promise.resolve([]),
          accountsPromise
        ])

        setSummary(summaryData)
        setCategories(categoriesData)
        setNetWorth(netWorthData)
        setHistory(historyData)
        setWeeklyHistory(weeklyData)
        setAccountBalances(accountsData)
      } else {
        // Annual
         const monthsPromises = Array.from({ length: 12 }, (_, i) => 
          getMonthlySummary(user.id, year, i + 1, { includeChildrenRollup: rollupEnabled }, orgId)
        )
        const categoriesPromises = Array.from({ length: 12 }, (_, i) =>
          getMonthlyCategoryBreakdown(user.id, year, i + 1, orgId)
        )
        
        const [monthsData, allCategories, netWorthData, accountsData] = await Promise.all([
          Promise.all(monthsPromises),
          Promise.all(categoriesPromises),
          getNetWorthSummary(user.id, new Date(), orgId),
          accountsPromise
        ])

        // Aggregate annual totals
        const annualSummary: MonthlySummary = {
          year,
          month: 0,
          income: monthsData.reduce((sum, m) => sum + m.income, 0),
          expenses: monthsData.reduce((sum, m) => sum + m.expenses, 0),
          net: monthsData.reduce((sum, m) => sum + m.net, 0),
          savingsChange: monthsData.reduce((sum, m) => sum + m.savingsChange, 0),
        }

        // Aggregate categories
        const categoryMap = new Map<string, CategorySummary>()
        allCategories.flat().forEach(cat => {
          const existing = categoryMap.get(cat.categoryId)
          if (existing) {
            existing.total += cat.total
          } else {
            categoryMap.set(cat.categoryId, { ...cat })
          }
        })
        const aggregatedCategories = Array.from(categoryMap.values())
          .sort((a, b) => b.total - a.total)

        setSummary(annualSummary)
        setCategories(aggregatedCategories)
        setNetWorth(netWorthData)
        setHistory(monthsData)
        setAccountBalances(accountsData)
      }
    } catch (err) {
      console.error('Error loading summary:', err)
      setError('Error al cargar los datos. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = () => {
    loadData()
  }

  const handleExportJSON = () => {
    if (!summary) return
    const data = {
      summary,
      categories,
      history,
      netWorth,
      generatedAt: new Date().toISOString()
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const periodStr = periodType === 'monthly' ? `${month}-${year}` : `${year}`
    downloadFile(blob, `Resumen_${periodStr}.json`, 'application/json')
  }

  // Export Data Preparation
  const exportColumns: ExcelColumn[] = [
    { header: 'SECCIÓN', key: 'section', width: 30 },
    { header: 'CONCEPTO', key: 'concept', width: 25 },
    { header: 'VALOR', key: 'value', width: 20 },
    { header: '% / TASA', key: 'percentage', width: 15 },
    { header: 'DETALLES / NOTAS', key: 'details', width: 40 }
  ]

  const exportData = useMemo(() => {
    if (!summary) return []
    
    const data: any[] = []
    const formatMoney = (val: number) => new Intl.NumberFormat(locale === 'en-US' ? 'en-US' : 'es-ES', { style: 'currency', currency: 'EUR' }).format(val)

    // 1. General Summary
    data.push({
      section: 'RESUMEN GENERAL',
      concept: 'Ingresos Totales',
      value: formatMoney(summary.income),
      percentage: '100%',
      details: 'Ingresos del periodo seleccionado'
    })
    data.push({
      section: 'RESUMEN GENERAL',
      concept: 'Gastos Totales',
      value: formatMoney(summary.expenses),
      percentage: summary.income > 0 ? ((summary.expenses / summary.income) * 100).toFixed(2) + '%' : '-',
      details: 'Gastos del periodo seleccionado'
    })
    data.push({
      section: 'RESUMEN GENERAL',
      concept: 'Balance Neto',
      value: formatMoney(summary.net),
      percentage: summary.income > 0 ? ((summary.net / summary.income) * 100).toFixed(2) + '%' : '-',
      details: 'Margen de beneficio'
    })
    data.push({
      section: 'RESUMEN GENERAL',
      concept: 'Ahorro (Cambio)',
      value: formatMoney(summary.savingsChange),
      percentage: '-',
      details: 'Incremento neto de ahorro en cuentas'
    })

    // 2. Categories Breakdown
    if (categories.length > 0) {
        categories.forEach(c => {
            data.push({
                section: 'DESGLOSE POR CATEGORÍA',
                concept: c.categoryName,
                value: formatMoney(c.total),
                percentage: summary.expenses > 0 ? ((c.total / summary.expenses) * 100).toFixed(2) + '%' : '-',
                details: 'Gasto por categoría' 
            })
        })
    }

    // 3. Historical Data
    if (history.length > 0) {
        history.forEach(h => {
             const label = h.month || 'Periodo'
             const val = (h as any).balance !== undefined ? (h as any).balance : (h as any).net
             
             data.push({
                 section: 'HISTORIAL',
                 concept: label,
                 value: formatMoney(val),
                 percentage: h.income > 0 ? ((val / h.income) * 100).toFixed(2) + '%' : '-',
                 details: `Ing: ${formatMoney(h.income)} | Gas: ${formatMoney(h.expenses)}`
             })
        })
    }

    return data
  }, [summary, categories, history, locale])

  // Helpers for dropdowns
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
  
  const periodLabel = periodType === 'monthly' 
    ? `${months.find(m => m.value === month)?.label} ${year}`
    : `${year}`

  const maxHistoryValue = Math.max(
      ...history.map(h => Math.max(h.income, h.expenses)), 
      100 // minimum scale
  )
  const totalExpenses = Math.max(categories.reduce((acc, cat) => acc + cat.total, 0), 1)

  return (
    <div className="page-container">
      {/* Header */}
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

       {/* Filters */}
      <UiCard className="mb-6">
        <UiCardBody>
          <div className="flex flex-wrap items-end gap-4">
            {/* Period Type Toggle */}
            <div className="form-group mb-0">
              <label className="label mb-2 block">{t('summary.period')}</label>
              <UiSegmented 
                 value={periodType}
                 onChange={(val) => setPeriodType(val as PeriodType)}
                 options={[
                    { value: 'monthly', label: t('summary.monthly'), icon: <Calendar size={14} /> },
                    { value: 'annual', label: t('summary.annual'), icon: <Calendar size={14} /> }
                 ]}
              />
            </div>
            
            <div className="form-group mb-0 w-32">
              <label className="label mb-2 block">{t('summary.year')}</label>
              <UiSelect 
                 value={year.toString()} 
                 onChange={(val) => setYear(parseInt(val))}
                 options={years.map(y => ({ value: y.toString(), label: y.toString() }))}
              />
            </div>
            
            {periodType === 'monthly' && (
              <div className="form-group mb-0 w-40">
                <label className="label mb-2 block">{t('summary.month')}</label>
                <UiSelect 
                   value={month.toString()} 
                   onChange={(val) => setMonth(parseInt(val))}
                   options={months.map(m => ({ value: m.value.toString(), label: m.label }))}
                />
              </div>
            )}
            
            <button 
              className="btn btn-primary ml-auto" 
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              {t('summary.update')}
            </button>
          </div>
        </UiCardBody>
      </UiCard>

      {error && (
        <UiCard className="mb-6 border-l-4 border-l-danger bg-red-50 dark:bg-red-900/10">
          <UiCardBody>
             <p className="text-danger m-0">{error}</p>
          </UiCardBody>
        </UiCard>
      )}

      {/* KPIs */}
      <div className="kpi-grid">
         <div className="kpi-card">
           <div className="kpi-icon kpi-icon-success">
             <TrendingUp size={24} />
           </div>
           <div className="kpi-content">
             <div className="kpi-label">{t('summary.income')}</div>
             <div className="kpi-value" style={{ color: 'var(--success)' }}>
               {loading ? '...' : formatCurrency(summary?.income || 0, locale)}
             </div>
           </div>
         </div>
         <div className="kpi-card">
           <div className="kpi-icon kpi-icon-danger">
             <TrendingDown size={24} />
           </div>
           <div className="kpi-content">
             <div className="kpi-label">{t('summary.expenses')}</div>
             <div className="kpi-value" style={{ color: 'var(--danger)' }}>
               {loading ? '...' : formatCurrency(summary?.expenses || 0, locale)}
             </div>
           </div>
         </div>
         <div className="kpi-card">
           <div className="kpi-icon kpi-icon-primary">
             <Wallet size={24} />
           </div>
           <div className="kpi-content">
             <div className="kpi-label">{t('summary.netBalance')}</div>
             <div className="kpi-value" style={{ color: (summary?.net || 0) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
               {loading ? '...' : formatCurrency(summary?.net || 0, locale)}
             </div>
           </div>
         </div>
         <div className="kpi-card">
           <div className="kpi-icon kpi-icon-primary">
             <PiggyBank size={24} />
           </div>
           <div className="kpi-content">
             <div className="kpi-label">{t('summary.savings')}</div>
             <div className="kpi-value" style={{ color: 'var(--primary)' }}>
               {loading ? '...' : formatCurrency(summary?.savingsChange || 0, locale)}
             </div>
           </div>
         </div>
      </div>

      {/* NEW SECTION: Accounts Breakdown with Roll-up Toggle */}
      <UiCard className="mt-6">
        <UiCardHeader
           title="Resumen por Cuentas (Actual)"
           action={
              <label className="flex items-center gap-3 cursor-pointer text-sm">
                <span className={rollupEnabled ? 'text-primary font-semibold' : 'text-gray-500'}>
                  Agrupar cuentas padre
                </span>
                 <div 
                  className={`w-10 h-6 rounded-full relative transition-colors ${rollupEnabled ? 'bg-primary' : 'bg-gray-300'}`}
                  onClick={(e) => {
                      e.preventDefault();
                      updateSettings({ rollupAccountsByParent: !rollupEnabled });
                  }}
                >
                  <div 
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all ${rollupEnabled ? 'left-[18px]' : 'left-0.5'}`}
                  />
                </div>
              </label>
           }
        />

        {loading ? (
             <UiCardBody><div className="loading-container"><div className="spinner"></div></div></UiCardBody>
        ) : (
          <UiCardBody noPadding className="overflow-hidden">
            <div className="table-container">
            <table className="table w-full">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left">Nombre</th>
                  <th className="px-6 py-3 text-left">Tipo</th>
                  <th className="px-6 py-3 text-right">Balance Actual</th>
                </tr>
              </thead>
              <tbody>
                {accountBalances.map(acc => (
                  <tr 
                    key={acc.id} 
                    className="border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50/50 dark:hover:bg-gray-800/50"
                    onClick={() => navigate(`/app/accounts/${acc.id}`)}
                    style={{ cursor: 'pointer' }}
                    title="Ver detalle de cuenta"
                  >
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                         {rollupEnabled && (
                           <span title="Cuenta Agrupada" className="flex">
                             <Layers size={14} className="text-primary opacity-70" />
                           </span>
                         )}
                         {acc.name}
                      </div>
                    </td>
                    <td className="capitalize px-6 py-3">{acc.type}</td>
                    <td className="px-6 py-3 text-right font-semibold" style={{ color: acc.balance >= 0 ? 'var(--text-primary)' : 'var(--danger)' }}>
                      {formatCurrency(acc.balance, locale)}
                    </td>
                  </tr>
                ))}
                {accountBalances.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center text-muted py-8">
                      No hay cuentas activas
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </UiCardBody>
        )}
      </UiCard>

       {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
         {/* Evolution Chart */}
        <UiCard>
           <UiCardHeader 
             title={`Evolución últimos ${historyMonths} meses`}
             action={
               <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                 {/* Period selector */}
                 <div style={{ display: 'flex', gap: '0.125rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '0.5rem', padding: '0.125rem' }}>
                   {[3, 6, 12, 24].map(m => (
                     <button
                       key={m}
                       onClick={() => setHistoryMonths(m)}
                       style={{
                         padding: '0.25rem 0.5rem',
                         fontSize: '0.7rem',
                         fontWeight: historyMonths === m ? 600 : 400,
                         borderRadius: '0.375rem',
                         border: 'none',
                         cursor: 'pointer',
                         background: historyMonths === m ? '#6366f1' : 'transparent',
                         color: historyMonths === m ? 'white' : 'inherit'
                       }}
                     >
                       {m}m
                     </button>
                   ))}
                 </div>
                 
                 {/* Grouping selector */}
                 <div style={{ display: 'flex', gap: '0.125rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '0.5rem', padding: '0.125rem' }}>
                   {([
                     { value: 0.5 as const, label: 'Sem' },
                     { value: 0.25 as const, label: '2Sem' },
                     { value: 1 as const, label: 'Mes' },
                     { value: 2 as const, label: 'Bim' },
                     { value: 3 as const, label: 'Trim' }
                   ]).map(opt => (
                     <button
                       key={opt.value}
                       onClick={() => setChartGrouping(opt.value)}
                       style={{
                         padding: '0.25rem 0.5rem',
                         fontSize: '0.7rem',
                         fontWeight: chartGrouping === opt.value ? 600 : 400,
                         borderRadius: '0.375rem',
                         border: 'none',
                         cursor: 'pointer',
                         background: chartGrouping === opt.value ? '#10b981' : 'transparent',
                         color: chartGrouping === opt.value ? 'white' : 'inherit'
                       }}
                     >
                       {opt.label}
                     </button>
                   ))}
                 </div>
                  
                  {/* Chart Type Toggle (Bars/Lines) */}
                  <div style={{ display: 'flex', gap: '0.125rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '0.5rem', padding: '0.125rem' }}>
                    <button
                      onClick={() => setChartViewType('bars')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.7rem',
                        fontWeight: chartViewType === 'bars' ? 600 : 400,
                        borderRadius: '0.375rem',
                        border: 'none',
                        cursor: 'pointer',
                        background: chartViewType === 'bars' ? '#3b82f6' : 'transparent',
                        color: chartViewType === 'bars' ? 'white' : 'inherit'
                      }}
                    >
                      <BarChart3 size={12} />
                      Barras
                    </button>
                    <button
                      onClick={() => setChartViewType('lines')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.7rem',
                        fontWeight: chartViewType === 'lines' ? 600 : 400,
                        borderRadius: '0.375rem',
                        border: 'none',
                        cursor: 'pointer',
                        background: chartViewType === 'lines' ? '#3b82f6' : 'transparent',
                        color: chartViewType === 'lines' ? 'white' : 'inherit'
                      }}
                    >
                      <TrendingUp size={12} />
                      Líneas
                    </button>
                  </div>
                </div>
              }
           />
           <UiCardBody>
             {loading ? (
               <div className="loading-container"><div className="spinner"></div></div>
             ) : ((chartGrouping === 0.5 || chartGrouping === 0.25) ? weeklyHistory.length === 0 : history.length === 0) ? (
               <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
                 {t('summary.noDataHistory')}
               </div>
             ) : (() => {
               // Group data based on chartGrouping mode
               let chartData: { label: string; income: number; expenses: number }[] = []
               
               if (chartGrouping === 0.5) {
                 // Weekly data - single weeks
                 chartData = weeklyHistory.map(w => ({
                   label: w.weekLabel,
                   income: w.income,
                   expenses: w.expenses
                 }))
               } else if (chartGrouping === 0.25) {
                 // Bi-weekly data - group 2 weeks together
                 for (let i = 0; i < weeklyHistory.length; i += 2) {
                   const w1 = weeklyHistory[i]
                   const w2 = weeklyHistory[i + 1]
                   if (w1 && w2) {
                     chartData.push({
                       label: `${w1.weekLabel.split(' ')[0]}-${w2.weekLabel}`,
                       income: w1.income + w2.income,
                       expenses: w1.expenses + w2.expenses
                     })
                   } else if (w1) {
                     chartData.push({
                       label: w1.weekLabel,
                       income: w1.income,
                       expenses: w1.expenses
                     })
                   }
                 }
               } else {
                 // Monthly grouping
                 const groupSize = chartGrouping // 1, 2, or 3 months per bar
                 
                 for (let i = 0; i < history.length; i += groupSize) {
                   const group = history.slice(i, i + groupSize)
                   if (group.length > 0) {
                     const firstMonth = group[0]
                     const lastMonth = group[group.length - 1]
                     let label: string
                     
                     if (groupSize === 1) {
                       label = `${firstMonth.month}/${String(firstMonth.year).slice(2)}`
                     } else if (groupSize === 2) {
                       label = `${firstMonth.month}-${lastMonth.month}/${String(lastMonth.year).slice(2)}`
                     } else {
                       label = `T${Math.ceil((firstMonth.month) / 3)}/${String(firstMonth.year).slice(2)}`
                     }
                     
                     chartData.push({
                       label,
                       income: group.reduce((sum, h) => sum + h.income, 0),
                       expenses: group.reduce((sum, h) => sum + h.expenses, 0)
                     })
                   }
                 }
               }
               
                const maxValue = Math.max(...chartData.flatMap(d => [d.income, d.expenses]), 1)
                const formatShort = (n: number) => n >= 1000 ? `${(n/1000).toFixed(0)}k` : n.toFixed(0)
                
                // Add profit to data for line chart
                const lineChartData = chartData.map(d => ({
                  ...d,
                  profit: d.income - d.expenses
                }))
                
                // Line Chart View
                if (chartViewType === 'lines') {
                  return (
                    <div style={{ height: '260px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={lineChartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                          <XAxis 
                            dataKey="label" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: '#6b7280', fontSize: 11 }}
                            dy={8}
                          />
                          <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: '#6b7280', fontSize: 11 }}
                            tickFormatter={formatShort}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                              border: '1px solid #334155',
                              borderRadius: 8,
                              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                            }}
                            labelStyle={{ color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}
                            itemStyle={{ color: '#e2e8f0' }}
                            formatter={(value) => [formatCurrency(Number(value) || 0, locale), '']}
                          />
                          <Legend 
                            iconType="circle"
                            iconSize={8}
                            wrapperStyle={{ paddingTop: 12 }}
                            formatter={(value) => <span style={{ color: '#6b7280', fontSize: 12 }}>{value}</span>}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="income" 
                            name={t('summary.income')} 
                            stroke="#10b981" 
                            strokeWidth={3}
                            dot={{ fill: '#10b981', strokeWidth: 0, r: 4 }}
                            activeDot={{ r: 6, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="expenses" 
                            name={t('summary.expenses')} 
                            stroke="#ef4444" 
                            strokeWidth={3}
                            dot={{ fill: '#ef4444', strokeWidth: 0, r: 4 }}
                            activeDot={{ r: 6, fill: '#ef4444', stroke: '#fff', strokeWidth: 2 }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="profit" 
                            name="Beneficio" 
                            stroke="#3b82f6" 
                            strokeWidth={3}
                            strokeDasharray="5 5"
                            dot={{ fill: '#3b82f6', strokeWidth: 0, r: 4 }}
                            activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )
                }
                
                // Bar Chart View (existing)
                return (
                  <div style={{ height: '220px', display: 'flex', flexDirection: 'column' }}>
                    {/* Bars area */}
                     <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: chartData.length <= 12 ? 'space-around' : 'space-between', gap: '2px', paddingBottom: '0.5rem', paddingTop: '1.5rem', position: 'relative' }}>
                      {/* Background grid lines */}
                     <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none' }}>
                       {[0, 1, 2, 3].map((_, i) => (
                         <div key={i} style={{ borderBottom: '1px solid rgba(156, 163, 175, 0.15)' }} />
                       ))}
                     </div>
                                          {chartData.map((d, i) => {
                        const incomeHeight = maxValue > 0 ? (d.income / maxValue) * 100 : 0
                        const expenseHeight = maxValue > 0 ? (d.expenses / maxValue) * 100 : 0
                        const isSmallChart = chartData.length <= 12
                        
                        return (
                          <div key={i} style={{ 
                            flex: '1 1 0',
                            display: 'flex', 
                            flexDirection: 'column', 
                            alignItems: 'center', 
                            minWidth: '0',
                            maxWidth: isSmallChart ? '80px' : '35px',
                            position: 'relative',
                            marginTop: '1.5rem'
                          }}>
                            {/* Values on top - show if enough space */}
                            {chartData.length <= 30 && (
                              <div style={{ 
                                position: 'absolute', 
                                top: '-1.5rem', 
                                left: '-50%', 
                                right: '-50%', 
                                display: 'flex', 
                                flexDirection: 'column',
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                gap: '0',
                                fontSize: chartData.length <= 12 ? '0.6rem' : '0.45rem',
                                opacity: 0.9,
                                zIndex: 20,
                                textAlign: 'center'
                              }}>
                                <span style={{ color: d.income > 0 ? '#059669' : '#9ca3af', fontWeight: d.income > 0 ? 600 : 400, lineHeight: 1 }}>
                                  {formatShort(d.income)}
                                </span>
                                <span style={{ color: d.expenses > 0 ? '#dc2626' : '#9ca3af', fontWeight: d.expenses > 0 ? 600 : 400, lineHeight: 1 }}>
                                  {formatShort(d.expenses)}
                                </span>
                              </div>
                            )}

                            {/* Bars Container - fixed height, align to bottom */}
                            <div style={{ 
                              height: '130px',
                              display: 'flex', 
                              gap: isSmallChart ? '3px' : '2px', 
                              alignItems: 'flex-end', 
                              width: '100%', 
                              padding: isSmallChart ? '0 3px' : '0 1px'
                            }}>
                              {/* Income Bar */}
                              <div 
                                style={{ 
                                  flex: 1,
                                  background: 'linear-gradient(to top, #059669, #34d399)',
                                  borderRadius: isSmallChart ? '4px 4px 0 0' : '3px 3px 0 0',
                                  height: `${Math.max(incomeHeight, 3)}%`,
                                  minHeight: d.income > 0 ? '6px' : '2px',
                                  transition: 'all 0.3s ease',
                                  boxShadow: d.income > 0 ? '0 2px 6px rgba(16, 185, 129, 0.35)' : 'none',
                                  cursor: 'pointer'
                                }}
                                title={`Ingresos: ${formatCurrency(d.income, locale)}`}
                              />
                              {/* Expense Bar */}
                              <div 
                                style={{ 
                                  flex: 1,
                                  background: 'linear-gradient(to top, #dc2626, #f87171)',
                                  borderRadius: isSmallChart ? '4px 4px 0 0' : '3px 3px 0 0',
                                  height: `${Math.max(expenseHeight, 3)}%`,
                                  minHeight: d.expenses > 0 ? '6px' : '2px',
                                  transition: 'all 0.3s ease',
                                  boxShadow: d.expenses > 0 ? '0 2px 6px rgba(239, 68, 68, 0.35)' : 'none',
                                  cursor: 'pointer'
                                }}
                                title={`Gastos: ${formatCurrency(d.expenses, locale)}`}
                              />
                            </div>
                            
                            {/* Period Label */}
                            {chartData.length <= 26 && (
                              <span style={{ 
                                fontSize: isSmallChart ? '0.6rem' : '0.5rem', 
                                color: '#9ca3af', 
                                marginTop: '3px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                width: '100%',
                                textAlign: 'center',
                                fontWeight: 500
                              }}>
                                {d.label}
                              </span>
                            )}
                          </div>
                        )
                      })}
                   </div>
                   
                   {/* Legend */}
                   <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(156, 163, 175, 0.2)' }}>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                       <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'linear-gradient(to top, #10b981, #34d399)' }} />
                       <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{t('summary.income')}</span>
                     </div>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                       <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'linear-gradient(to top, #ef4444, #f87171)' }} />
                       <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{t('summary.expenses')}</span>
                     </div>
                   </div>
                 </div>
               )
             })()}
           </UiCardBody>
        </UiCard>
 
         {/* Category Breakdown */}
         <UiCard>
            <UiCardHeader title={t('summary.spendingBreakdown')} />
            <UiCardBody>
             {loading ? (
               <div className="loading-container"><div className="spinner"></div></div>
             ) : categories.length === 0 ? (
               <div className="h-[280px] flex items-center justify-center text-muted">
                 {t('summary.noDataSpending')}
               </div>
             ) : (() => {
               const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6']
               const topCategories = categories.slice(0, 6)
               let cumulativePercent = 0
               
               return (
                 <div className="flex flex-col items-center gap-4">
                   {/* Donut Chart */}
                   <div className="relative">
                     <svg width="160" height="160" viewBox="0 0 160 160">
                       {topCategories.map((cat, index) => {
                         const percent = (cat.total / totalExpenses) * 100
                         const color = cat.color || colors[index % colors.length]
                         
                         // Calculate SVG arc
                         const radius = 60
                         const circumference = 2 * Math.PI * radius
                         const strokeDasharray = (percent / 100) * circumference
                         const strokeDashoffset = -cumulativePercent / 100 * circumference
                         cumulativePercent += percent
                         
                         return (
                           <circle
                             key={cat.categoryId}
                             cx="80"
                             cy="80"
                             r={radius}
                             fill="none"
                             stroke={color}
                             strokeWidth="24"
                             strokeDasharray={`${strokeDasharray} ${circumference}`}
                             strokeDashoffset={strokeDashoffset}
                             transform="rotate(-90 80 80)"
                             className="transition-all duration-500"
                             style={{ filter: `drop-shadow(0 0 4px ${color}40)` }}
                           />
                         )
                       })}
                       {/* Center text */}
                       <text x="80" y="75" textAnchor="middle" className="text-2xl font-bold fill-current">
                         {formatCurrency(totalExpenses, locale).replace(/[^\d.,€$]/g, '').slice(0, 8)}
                       </text>
                       <text x="80" y="95" textAnchor="middle" className="text-xs fill-muted">
                         Total
                       </text>
                     </svg>
                   </div>
                   
                   {/* Legend */}
                   <div className="w-full space-y-2">
                     {topCategories.map((cat, index) => {
                       const percent = (cat.total / totalExpenses) * 100
                       const color = cat.color || colors[index % colors.length]
                       
                       return (
                         <div key={cat.categoryId} className="flex items-center justify-between text-sm">
                           <div className="flex items-center gap-2">
                             <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                             <span className="text-foreground truncate max-w-[120px]">
                               {cat.categoryName || t('common.noCategory')}
                             </span>
                           </div>
                           <div className="flex items-center gap-2 text-muted">
                             <span className="text-xs">({formatCurrency(cat.total, locale)})</span>
                             <span className="font-semibold text-foreground">{percent.toFixed(0)}%</span>
                           </div>
                         </div>
                       )
                     })}
                   </div>
                 </div>
               )
             })()}
            </UiCardBody>
         </UiCard>
      </div>
      
      {/* Net Worth Section */}
      <UiCard className="mt-6">
          <UiCardHeader title={t('summary.netWorth')} />
        {loading ? (
          <UiCardBody><div className="loading-container"><div className="spinner"></div></div></UiCardBody>
        ) : (
          <UiCardBody>
            {/* Main Layout: 3 small cards + 1 big card */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.5fr', gap: '1rem' }}>
              
              <div style={{
                position: 'relative',
                padding: '0.875rem 1rem',
                borderRadius: '0.75rem',
                background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
                border: '1px solid #c7d2fe'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div style={{
                    width: '2rem',
                    height: '2rem',
                    borderRadius: '0.5rem',
                    background: '#6366f1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white'
                  }}>
                    <CreditCard size={16} />
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4f46e5', textTransform: 'uppercase' }}>
                    Cuentas
                  </span>
                </div>
                <span style={{ display: 'block', fontSize: '1.25rem', fontWeight: 700, color: '#4338ca' }}>
                  {formatCurrency(netWorth?.cashBalance || 0, locale)}
                </span>
              </div>
              
              <div style={{
                position: 'relative',
                padding: '0.875rem 1rem',
                borderRadius: '0.75rem',
                background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
                border: '1px solid #a7f3d0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div style={{
                    width: '2rem',
                    height: '2rem',
                    borderRadius: '0.5rem',
                    background: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white'
                  }}>
                    <TrendingUp size={16} />
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#059669', textTransform: 'uppercase' }}>
                    Inversiones
                  </span>
                </div>
                <span style={{ display: 'block', fontSize: '1.25rem', fontWeight: 700, color: '#047857' }}>
                  {formatCurrency(netWorth?.investmentsValue || 0, locale)}
                </span>
              </div>
              
              <div style={{
                position: 'relative',
                padding: '0.875rem 1rem',
                borderRadius: '0.75rem',
                background: 'linear-gradient(135deg, #fef2f2 0%, #fecaca 100%)',
                border: '1px solid #fca5a5'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div style={{
                    width: '2rem',
                    height: '2rem',
                    borderRadius: '0.5rem',
                    background: '#ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white'
                  }}>
                    <Wallet size={16} />
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#dc2626', textTransform: 'uppercase' }}>
                    Deudas
                  </span>
                </div>
                <span style={{ display: 'block', fontSize: '1.25rem', fontWeight: 700, color: '#b91c1c' }}>
                  -{formatCurrency(netWorth?.debtsPending || 0, locale)}
                </span>
              </div>
              
              {/* Total Net Worth - Featured Card */}
              <div style={{
                position: 'relative',
                padding: '0.875rem 1rem',
                borderRadius: '0.75rem',
                overflow: 'hidden',
                background: (netWorth?.netWorth || 0) >= 0 
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 50%, #0d9488 100%)' 
                  : 'linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #e11d48 100%)'
              }}>
                {/* Decorative circles */}
                <div style={{
                  position: 'absolute',
                  right: '-1.5rem',
                  top: '-1.5rem',
                  width: '6rem',
                  height: '6rem',
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '50%'
                }} />
                <div style={{
                  position: 'absolute',
                  right: '-0.5rem',
                  bottom: '-2rem',
                  width: '4rem',
                  height: '4rem',
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '50%'
                }} />
                
                <div style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.25rem' }}>
                    <PiggyBank size={20} style={{ color: 'rgba(255,255,255,0.8)' }} />
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Patrimonio Neto
                    </span>
                  </div>
                  <span style={{ display: 'block', fontSize: '1.5rem', fontWeight: 700, color: 'white' }}>
                    {formatCurrency(netWorth?.netWorth || 0, locale)}
                  </span>
                  
                  {/* Mini composition preview */}
                  <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ flex: 1, height: '0.375rem', borderRadius: '9999px', background: 'rgba(255,255,255,0.2)', overflow: 'hidden', display: 'flex' }}>
                      {(() => {
                        const total = (netWorth?.cashBalance || 0) + (netWorth?.investmentsValue || 0)
                        const cashP = total > 0 ? ((netWorth?.cashBalance || 0) / total) * 100 : 50
                        return (
                          <>
                            <div style={{ height: '100%', background: 'rgba(255,255,255,0.5)', width: `${cashP}%` }} />
                            <div style={{ height: '100%', background: 'rgba(255,255,255,0.8)', width: `${100 - cashP}%` }} />
                          </>
                        )
                      })()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.625rem', color: 'rgba(255,255,255,0.6)', marginTop: '0.25rem' }}>
                    <span>Cuentas</span>
                    <span>Inversiones</span>
                  </div>
                </div>
              </div>
            </div>
          </UiCardBody>
        )}
      </UiCard>
    </div>
  )
}
