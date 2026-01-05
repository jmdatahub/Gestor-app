import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { fetchAccountsSummary, type AccountWithBalance } from '../services/accountService'
import { getAccountBalancesSummary, getFinancialDistribution, type FinancialDistribution } from '../services/summaryService'
import { fetchMonthlyMovements, calculateMonthlySummary } from '../services/movementService'

import { warmup as warmupCache } from '../services/catalogCache'
import { ArrowUpDown, PiggyBank, TrendingUp, Wallet, Plus, ArrowRight, Layers } from 'lucide-react'
import { useI18n } from '../hooks/useI18n'
import { useSettings } from '../context/SettingsContext'
import { SkeletonDashboard } from '../components/Skeleton'
import { NetWorthInfo, NetWorthChart, useNetWorth } from '../components/ChartSection'

interface AccountSummary {
  totalBalance: number
  accountCount: number
}

interface MonthlySummary {
  income: number
  expense: number
  balance: number
}



export default function Dashboard() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const { settings } = useSettings()
  const [loading, setLoading] = useState(true)
  const [accountsSummary, setAccountsSummary] = useState<AccountSummary>({ totalBalance: 0, accountCount: 0 })
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary>({ income: 0, expense: 0, balance: 0 })
  const [financialOverview, setFinancialOverview] = useState<FinancialDistribution | null>(null)
  const [topAccounts, setTopAccounts] = useState<AccountWithBalance[]>([])

  useEffect(() => {
    loadDashboardData()
  }, [settings.rollupAccountsByParent])

  const loadDashboardData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      // Warmup catalog cache for faster subsequent loads
      warmupCache(user.id)
      
      const [accounts, movements, accountList, financialData] = await Promise.all([
        fetchAccountsSummary(user.id),
        fetchMonthlyMovements(user.id),
        getAccountBalancesSummary(user.id, { includeChildrenRollup: settings.rollupAccountsByParent }),
        getFinancialDistribution(user.id)
      ])

      if (accounts) {
        setAccountsSummary(accounts)
      }

      if (financialData) {
        setFinancialOverview(financialData)
      }

      if (accountList) {
        // Sort by balance desc and take top 5
        const sorted = [...accountList].sort((a, b) => b.balance - a.balance).slice(0, 5)
        setTopAccounts(sorted)
      }

      const summary = calculateMonthlySummary(movements || [])
      setMonthlySummary(summary)



    } catch (error) {
      console.error('Error loading dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount)
  }



  // Financial Overview Logic (Lifted State)
  const { 
      chartType, setChartType, 
      drillLevel, setDrillLevel, 
      currentData, currentTotal, 
      activeConfig 
  } = useNetWorth(financialOverview)

  if (loading) {
    return <SkeletonDashboard />
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('dashboard.title')}</h1>
          <p className="page-subtitle">{t('dashboard.subtitle')}</p>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="kpi-grid mb-6">
        <div className="kpi-card">
          <div className="kpi-icon kpi-icon-primary">
            <Wallet size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">{t('dashboard.balance')}</div>
            <div className="kpi-value">{formatCurrency(accountsSummary.totalBalance)}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon kpi-icon-success">
            <TrendingUp size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">{t('dashboard.income')}</div>
            <div className="kpi-value" style={{ color: 'var(--success)' }}>{formatCurrency(monthlySummary.income)}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon kpi-icon-danger">
            <ArrowUpDown size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">{t('dashboard.expenses')}</div>
            <div className="kpi-value" style={{ color: 'var(--danger)' }}>{formatCurrency(monthlySummary.expense)}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon kpi-icon-warning">
            <PiggyBank size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">{t('accounts.title')} ({t('dashboard.quickActions')})</div>
            <div className="kpi-value">{accountsSummary.accountCount}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
        {/* Quick Actions */}
        <div className="section-card">
          <h2 className="section-title">{t('dashboard.quickActions')}</h2>
          <div className="flex gap-3 flex-wrap">
            <button className="btn btn-primary" onClick={() => navigate('/app/movements')}>
              <Plus size={18} />
              {t('common.create')}
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/app/accounts')}>
              <Wallet size={18} />
              {t('accounts.title')}
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/app/summary')}>
              <TrendingUp size={18} />
              {t('nav.summary')}
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/app/settings')}>
               Ajustes
            </button>
          </div>
        </div>

        {/* Top Accounts */}
        <div className="section-card !p-10">
           <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
            <h2 className="section-title" style={{ margin: 0 }}>Top Cuentas</h2>
            <button className="btn btn-ghost" onClick={() => navigate('/app/summary')}>
              Ver todas
              <ArrowRight size={16} />
            </button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {topAccounts.length === 0 ? (
               <p className="text-muted">No hay cuentas</p>
            ) : (
              topAccounts.map(acc => (
                <div key={acc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }} />
                    <span style={{ color: 'var(--text-primary)' }}>{acc.name}</span>
                    {settings.rollupAccountsByParent && (acc as any).child_ids && (acc as any).child_ids.length > 0 && (
                        <Layers size={12} style={{ opacity: 0.5 }} />
                    )}
                  </div>
                  <span style={{ fontWeight: 600, color: acc.balance >= 0 ? 'var(--text-primary)' : 'var(--danger)' }}>
                    {formatCurrency(acc.balance)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 
         Bottom Section: Net Worth Split 
      */}
      {financialOverview && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
            <NetWorthInfo 
                drillLevel={drillLevel}
                setDrillLevel={setDrillLevel}
                currentData={currentData}
                currentTotal={currentTotal}
                formatCurrency={formatCurrency}
            />

            <NetWorthChart 
                drillLevel={drillLevel}
                setDrillLevel={setDrillLevel}
                currentData={currentData}
                currentTotal={currentTotal}
                formatCurrency={formatCurrency}
                chartType={chartType}
                setChartType={setChartType}
                activeConfig={activeConfig}
            />
        </div>
      )}
    </div>
  )
}
