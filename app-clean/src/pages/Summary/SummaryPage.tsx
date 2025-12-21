import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import {
  getMonthlySummary,
  getMonthlyCategoryBreakdown,
  getNetWorthSummary,
  getBalanceHistory,
  formatCurrency,
  getAccountBalancesSummary,
  type MonthlySummary,
  type CategorySummary,
  type NetWorthSummary
} from '../../services/summaryService'
import { downloadFile, exportSummaryToExcel } from '../../services/exportService'
import { type AccountWithBalance } from '../../services/accountService'
import { useSettings } from '../../context/SettingsContext'
import { useI18n } from '../../hooks/useI18n'
import { RefreshCw, TrendingUp, TrendingDown, Wallet, PiggyBank, CreditCard, Download, Calendar, Layers, FileText, FileJson, Printer, Table } from 'lucide-react'
import { UiCard, UiCardHeader, UiCardBody } from '../../components/ui/UiCard'
import { UiSelect } from '../../components/ui/UiSelect'
import { UiSegmented } from '../../components/ui/UiSegmented'
import { UiDropdown, UiDropdownItem } from '../../components/ui/UiDropdown'

type PeriodType = 'monthly' | 'annual'

export default function SummaryPage() {
  const { t, language } = useI18n()
  const { settings, updateSettings } = useSettings()
  const locale = language === 'es' ? 'es-ES' : 'en-US'
  const now = new Date()
  const [periodType, setPeriodType] = useState<PeriodType>('monthly')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  
  // Roll-up state from context
  const rollupEnabled = settings.rollupAccountsByParent

  const [summary, setSummary] = useState<MonthlySummary | null>(null)
  const [categories, setCategories] = useState<CategorySummary[]>([])
  const [netWorth, setNetWorth] = useState<NetWorthSummary | null>(null)
  const [history, setHistory] = useState<MonthlySummary[]>([])
  const [accountBalances, setAccountBalances] = useState<AccountWithBalance[]>([])
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [rollupEnabled, periodType, year, month])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      // Common data
      const accountsPromise = getAccountBalancesSummary(user.id, { includeChildrenRollup: rollupEnabled })

      if (periodType === 'monthly') {
        const [summaryData, categoriesData, netWorthData, historyData, accountsData] = await Promise.all([
          getMonthlySummary(user.id, year, month),
          getMonthlyCategoryBreakdown(user.id, year, month),
          getNetWorthSummary(user.id),
          getBalanceHistory(user.id, 12),
          accountsPromise
        ])

        setSummary(summaryData)
        setCategories(categoriesData)
        setNetWorth(netWorthData)
        setHistory(historyData)
        setAccountBalances(accountsData)
      } else {
        // Annual
         const monthsPromises = Array.from({ length: 12 }, (_, i) => 
          getMonthlySummary(user.id, year, i + 1)
        )
        const categoriesPromises = Array.from({ length: 12 }, (_, i) =>
          getMonthlyCategoryBreakdown(user.id, year, i + 1)
        )
        
        const [monthsData, allCategories, netWorthData, accountsData] = await Promise.all([
          Promise.all(monthsPromises),
          Promise.all(categoriesPromises),
          getNetWorthSummary(user.id),
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

  const handleExportCSV = () => {
    if (!summary) return
    
    // Simple CSV construction
    const rows = [
      ['Concepto', 'Valor'],
      ['Ingresos', summary.income],
      ['Gastos', summary.expenses],
      ['Balance Neto', summary.net],
      ['Ahorro', summary.savingsChange],
      [],
      ['Categoría', 'Total', 'Porcentaje'],
      ...categories.map(c => [
        `"${c.categoryName}"`, 
        c.total, 
        ((c.total / Math.max(summary.expenses, 1)) * 100).toFixed(2) + '%'
      ])
    ]

    const csvContent = rows.map(e => e.join(",")).join("\n")
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const periodStr = periodType === 'monthly' ? `${month}-${year}` : `${year}`
    downloadFile(blob, `Resumen_${periodStr}.csv`, 'text/csv')
  }

  const handlePrint = () => {
    window.print()
  }

  const handleExportExcel = async () => {
    if (!summary) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      await exportSummaryToExcel(
        user.id,
        {
          mode: periodType === 'monthly' ? 'monthly' : 'yearly',
          year,
          month: periodType === 'monthly' ? month : undefined
        },
        {
          income: summary.income,
          expenses: summary.expenses,
          net: summary.net,
          savingsChange: summary.savingsChange
        },
        categories.map(c => ({
          categoryName: c.categoryName,
          total: c.total
        }))
      )
    } catch (error) {
      console.error('Error exporting:', error)
    }
  }

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
        
        <UiDropdown 
          trigger={
            <button className="btn btn-secondary" disabled={loading}>
              <Download size={18} />
              {t('summary.download')}
            </button>
          }
        >
          <UiDropdownItem onClick={handleExportExcel} icon={<Table size={16} />}>
            Excel (.xlsx)
          </UiDropdownItem>
          <UiDropdownItem onClick={handleExportCSV} icon={<FileText size={16} />}>
            CSV (.csv)
          </UiDropdownItem>
          <UiDropdownItem onClick={handleExportJSON} icon={<FileJson size={16} />}>
            JSON (.json)
          </UiDropdownItem>
          <div className="h-px bg-border my-1" />
          <UiDropdownItem onClick={handlePrint} icon={<Printer size={16} />}>
            Imprimir / PDF
          </UiDropdownItem>
        </UiDropdown>
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
                  <tr key={acc.id} className="border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
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
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '2fr 1fr', 
        gap: '1.5rem', 
        marginBottom: '1.5rem',
        minHeight: '320px',
        marginTop: '1.5rem'
      }}>
         {/* Evolution Chart */}
        <UiCard className="min-h-[320px] shadow-sm">
           <UiCardHeader title={periodType === 'monthly' ? t('summary.evolutionLast12') : t('summary.evolutionMonthly', { year })} />
           <UiCardBody>
             {loading ? (
               <div className="loading-container"><div className="spinner"></div></div>
             ) : history.length === 0 ? (
               <div className="h-[240px] flex items-center justify-center text-muted">
                 {t('summary.noDataHistory')}
               </div>
             ) : (
               <div className="h-[240px] flex flex-col">
                 <div className="flex-1 flex items-end gap-1 pb-2">
                  {history.map((h, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center h-full group relative">
                      {/* Bars */}
                      <div className="flex-1 flex gap-[2px] items-end w-full relative z-10">
                        <div 
                          className="flex-1 bg-success rounded-t-[2px] opacity-80 group-hover:opacity-100 transition-opacity min-h-[4px]"
                          style={{ height: `${(h.income / maxHistoryValue) * 100}%` }}
                          title={`${t('summary.income')}: ${formatCurrency(h.income, locale)}`}
                        />
                        <div 
                          className="flex-1 bg-danger rounded-t-[2px] opacity-80 group-hover:opacity-100 transition-opacity min-h-[4px]"
                          style={{ height: `${(h.expenses / maxHistoryValue) * 100}%` }}
                          title={`${t('summary.expenses')}: ${formatCurrency(h.expenses, locale)}`}
                        />
                      </div>
                      <span className="text-[10px] text-muted mt-2 whitespace-nowrap">
                        {h.month}/{String(h.year).slice(2)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-center gap-6 pt-3 border-t border-border">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="w-2.5 h-2.5 rounded-full bg-success" />
                    {t('summary.income')}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="w-2.5 h-2.5 rounded-full bg-danger" />
                    {t('summary.expenses')}
                  </div>
                </div>
               </div>
             )}
           </UiCardBody>
        </UiCard>
 
         {/* Category Breakdown */}
         <UiCard className="min-h-[320px] shadow-sm">
            <UiCardHeader title={t('summary.spendingBreakdown')} />
            <UiCardBody>
             {loading ? (
               <div className="loading-container"><div className="spinner"></div></div>
             ) : categories.length === 0 ? (
               <div className="h-[240px] flex items-center justify-center text-muted">
                 {t('summary.noDataSpending')}
               </div>
             ) : (
               <div className="flex flex-col gap-3">
                 {categories.slice(0, 6).map((cat) => (
                   <div key={cat.categoryId} className="flex flex-col gap-1">
                     <div className="flex justify-between items-center">
                       <span className="flex items-center gap-2 text-sm text-foreground">
                         <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                         {cat.categoryName}
                       </span>
                       <span className="text-sm font-semibold text-foreground">
                         {formatCurrency(cat.total, locale)}
                       </span>
                     </div>
                     <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                       <div className="h-full rounded-full transition-all duration-300" style={{ 
                         width: `${(cat.total / totalExpenses) * 100}%`,
                         background: cat.color 
                       }} />
                     </div>
                     <span className="text-[10px] text-muted">
                       {((cat.total / totalExpenses) * 100).toFixed(1)}%
                     </span>
                   </div>
                 ))}
                 {categories.length > 6 && (
                   <p className="text-xs text-secondary mt-2">
                     +{categories.length - 6} categorías más
                   </p>
                 )}
               </div>
             )}
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
               <div className="flex items-center gap-4">
               <div className="kpi-icon kpi-icon-primary">
                 <CreditCard size={28} />
               </div>
               <div>
                 <span className="block text-xs text-muted uppercase tracking-wider mb-1">
                   {t('summary.accountsBalance')}
                 </span>
                 <span className="block text-2xl font-bold text-foreground">
                   {formatCurrency(netWorth?.cashBalance || 0, locale)}
                 </span>
               </div>
             </div>
 
             <div className="flex items-center gap-4">
               <div className="kpi-icon kpi-icon-success">
                 <TrendingUp size={28} />
               </div>
               <div>
                 <span className="block text-xs text-muted uppercase tracking-wider mb-1">
                   {t('summary.investmentsValue')}
                 </span>
                 <span className="block text-2xl font-bold text-success">
                   {formatCurrency(netWorth?.investmentsValue || 0, locale)}
                 </span>
               </div>
             </div>
 
             <div className="flex items-center gap-4">
               <div className="kpi-icon kpi-icon-danger">
                 <Wallet size={28} />
               </div>
               <div>
                 <span className="block text-xs text-muted uppercase tracking-wider mb-1">
                   {t('summary.debtsPending')}
                 </span>
                 <span className="block text-2xl font-bold text-danger">
                   -{formatCurrency(netWorth?.debtsPending || 0, locale)}
                 </span>
               </div>
             </div>
 
             <div className={`flex items-center p-6 rounded-lg ${
               (netWorth?.netWorth || 0) >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'
             }`}>
               <div>
                 <span className="block text-sm text-secondary uppercase tracking-wider mb-1">
                   {t('summary.totalNetWorth')}
                 </span>
                 <span className={`block text-3xl font-bold ${
                   (netWorth?.netWorth || 0) >= 0 ? 'text-success' : 'text-danger'
                 }`}>
                   {formatCurrency(netWorth?.netWorth || 0, locale)}
                 </span>
               </div>
             </div>
           </div>
          </UiCardBody>
        )}
      </UiCard>
    </div>
  )
}
