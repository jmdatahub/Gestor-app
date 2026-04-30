import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useWorkspace } from '../../context/WorkspaceContext'
import {
  getUserInvestments, calculateTotals, investmentTypes, positionTypeLabels,
  fetchCryptoPrices, getPositionEquity, getUnrealisedPnl, getPnlPercent,
  type Investment, type CreateInvestmentInput, type PositionType,
} from '../../services/investmentService'
import {
  useCreateInvestment, useUpdateInvestment, useDeleteInvestment, useUpdateInvestmentPrice,
} from '../../hooks/queries/useInvestmentMutations'
import { getAccountsWithBalances, type AccountWithBalance } from '../../services/accountService'
import {
  Plus, TrendingUp, TrendingDown, RefreshCw, Trash2, Eye, X, Pencil,
  AlertTriangle, Zap, Activity, DollarSign, BarChart2, Shield,
} from 'lucide-react'
import { useI18n } from '../../hooks/useI18n'
import { UiDatePicker } from '../../components/ui/UiDatePicker'
import { formatISODateString } from '../../utils/date'
import { UiSelect } from '../../components/ui/UiSelect'
import { UiField } from '../../components/ui/UiField'
import { UiInput } from '../../components/ui/UiInput'
import { UiNumber } from '../../components/ui/UiNumber'
import { UiModal, UiModalHeader, UiModalBody, UiModalFooter } from '../../components/ui/UiModal'
import { useToast } from '../../components/Toast'

const FALLBACK_EUR_USD = 0.92

// ── Inline styles ────────────────────────────────────────────────────────────
const S = {
  posCard: {
    borderRadius: '12px',
    border: '1px solid var(--border)',
    background: 'var(--card-bg)',
    overflow: 'hidden',
    transition: 'box-shadow 0.15s',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  posCardHeader: (pnlPos: boolean | null) => ({
    padding: '12px 16px',
    borderBottom: '1px solid var(--border)',
    borderLeft: `3px solid ${pnlPos === null ? 'var(--border)' : pnlPos ? 'var(--success)' : 'var(--danger)'}`,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '8px',
  }),
  symbolBadge: (type: string) => ({
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: type === 'crypto' ? 'rgba(139,92,246,0.15)' : type === 'stock' ? 'rgba(59,130,246,0.15)' : 'rgba(107,114,128,0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: '0.7rem',
    color: type === 'crypto' ? '#8b5cf6' : type === 'stock' ? '#3b82f6' : 'var(--text-muted)',
    flexShrink: 0,
    letterSpacing: '-0.5px',
  }),
  posCardBody: {
    padding: '14px 16px',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    flex: 1,
  },
  statBlock: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
  },
  statLabel: {
    fontSize: '0.68rem',
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    fontWeight: 600,
  },
  statValue: (size: 'sm' | 'md' | 'lg' = 'md') => ({
    fontSize: size === 'lg' ? '1.15rem' : size === 'md' ? '0.95rem' : '0.82rem',
    fontWeight: 700,
    fontFamily: 'monospace',
    lineHeight: 1.2,
  }),
  posCardFooter: {
    padding: '10px 16px',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '6px',
  },
  liqBadge: (warn: boolean) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '3px 8px',
    borderRadius: '6px',
    fontSize: '0.72rem',
    fontWeight: 600,
    fontFamily: 'monospace',
    background: warn ? 'rgba(239,68,68,0.12)' : 'rgba(107,114,128,0.08)',
    color: warn ? 'var(--danger)' : 'var(--text-muted)',
    border: `1px solid ${warn ? 'rgba(239,68,68,0.25)' : 'var(--border)'}`,
  }),
  pnlBadge: (pos: boolean) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    fontSize: '0.78rem',
    fontWeight: 700,
    color: pos ? 'var(--success)' : 'var(--danger)',
  }),
  kpiCard: (color: string) => ({
    borderRadius: '12px',
    border: '1px solid var(--border)',
    borderLeft: `4px solid ${color}`,
    background: 'var(--card-bg)',
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  }),
  leverageBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '1px 6px',
    borderRadius: '4px',
    fontSize: '0.65rem',
    fontWeight: 700,
    background: 'rgba(245,158,11,0.15)',
    color: '#f59e0b',
    border: '1px solid rgba(245,158,11,0.3)',
  },
  dirBadge: (isShort: boolean) => ({
    display: 'inline-flex',
    alignItems: 'center',
    padding: '1px 6px',
    borderRadius: '4px',
    fontSize: '0.65rem',
    fontWeight: 700,
    background: isShort ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
    color: isShort ? 'var(--danger)' : 'var(--success)',
    border: `1px solid ${isShort ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)'}`,
  }),
  typeBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '1px 6px',
    borderRadius: '4px',
    fontSize: '0.65rem',
    fontWeight: 500,
    background: 'rgba(107,114,128,0.1)',
    color: 'var(--text-muted)',
    border: '1px solid var(--border)',
  },
  divider: {
    borderTop: '1px solid var(--border)',
    margin: '0 -16px',
    gridColumn: '1 / -1' as const,
  },
}

export default function InvestmentsList() {
  const navigate = useNavigate()
  const { t, language } = useI18n()
  const { user } = useAuth()
  const { currentWorkspace } = useWorkspace()
  const toast = useToast()
  const createMut = useCreateInvestment()
  const updateMut = useUpdateInvestment()
  const deleteMut = useDeleteInvestment()
  const priceMut  = useUpdateInvestmentPrice()

  const [investments, setInvestments] = useState<Investment[]>([])
  const [loading,     setLoading]     = useState(true)
  const [accounts,    setAccounts]    = useState<AccountWithBalance[]>([])

  const [liveRates,      setLiveRates]      = useState<Record<string, { eur: number; usd: number }>>({})
  const [updatingPrices, setUpdatingPrices] = useState(false)
  const [lastUpdate,     setLastUpdate]     = useState<Date | null>(null)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showPriceModal,  setShowPriceModal]  = useState(false)
  const [selectedInv,     setSelectedInv]     = useState<Investment | null>(null)
  const [editingId,       setEditingId]       = useState<string | null>(null)
  const [submitting,      setSubmitting]      = useState(false)

  const [name,         setName]        = useState('')
  const [type,         setType]        = useState<string>('crypto')
  const [symbol,       setSymbol]      = useState('')
  const [quantity,     setQuantity]    = useState('')
  const [buyPrice,     setBuyPrice]    = useState('')
  const [currentPrice, setCurrentPrice]= useState('')
  const [notes,        setNotes]       = useState('')
  const [accountId,    setAccountId]   = useState('')
  const [fundFromId,   setFundFromId]  = useState('')
  const [positionType, setPositionType]= useState<PositionType>('spot')
  const [leverage,     setLeverage]    = useState('')
  const [marginAmount, setMarginAmount]= useState('')
  const [isShort,      setIsShort]     = useState(false)
  const [liqPrice,     setLiqPrice]    = useState('')

  const [newPrice,  setNewPrice]  = useState('')
  const [priceDate, setPriceDate] = useState(new Date().toISOString().split('T')[0])

  const fmt = useCallback((n: number, currency = 'EUR') =>
    new Intl.NumberFormat(language === 'es' ? 'es-ES' : 'en-US', { style: 'currency', currency })
      .format(n), [language])

  function toEur(amount: number, currency: string, sym?: string | null): number {
    if (!amount || currency === 'EUR') return amount
    if (currency === 'USD') {
      const rate = sym ? liveRates[sym.toUpperCase()] : null
      const eurUsd = (rate && rate.usd > 0) ? rate.eur / rate.usd : FALLBACK_EUR_USD
      return amount * eurUsd
    }
    return amount
  }

  function equityEur(inv: Investment): number {
    return toEur(getPositionEquity(inv), inv.currency ?? 'EUR', inv.symbol ?? inv.ticker)
  }

  const loadData = useCallback(async () => {
    if (!user) return
    try {
      const orgId = currentWorkspace?.id ?? null
      const [data, accs] = await Promise.all([
        getUserInvestments(user.id, orgId),
        getAccountsWithBalances(user.id, orgId),
      ])
      setInvestments(data)
      setAccounts(accs)
    } catch (e) {
      console.error('Error loading investments:', e)
    } finally {
      setLoading(false)
    }
  }, [user, currentWorkspace])

  useEffect(() => { loadData() }, [loadData])

  const runPriceUpdate = useCallback(async (silent = true) => {
    if (!user || updatingPrices) return
    const cryptoInvs = investments.filter(i => (i.type ?? i.asset_type) === 'crypto')
    const symbols = [...new Set(
      cryptoInvs.map(i => (i.symbol ?? i.ticker ?? '').toUpperCase()).filter(Boolean)
    )]
    if (!symbols.length) return

    setUpdatingPrices(true)
    try {
      const prices = await fetchCryptoPrices(symbols)
      if (!Object.keys(prices).length) return
      setLiveRates(prev => ({ ...prev, ...prices }))

      let updated = 0
      for (const inv of cryptoInvs) {
        const sym = (inv.symbol ?? inv.ticker ?? '').toUpperCase()
        if (!prices[sym]) continue
        const newP = inv.currency === 'USD' ? prices[sym].usd : prices[sym].eur
        if (!newP) continue
        const diff = Math.abs(newP - (inv.current_price ?? 0))
        if (diff < 0.01) continue
        const changePct = inv.current_price
          ? ((newP - inv.current_price) / inv.current_price) * 100 : 0
        await priceMut.mutateAsync({
          id: inv.id, userId: user.id,
          price: newP, date: new Date().toISOString().split('T')[0],
        })
        updated++
        if (!silent && Math.abs(changePct) >= 3) {
          const dir = changePct > 0 ? '📈' : '📉'
          toast[changePct > 0 ? 'success' : 'warning'](
            `${dir} ${inv.name}: ${changePct > 0 ? '+' : ''}${changePct.toFixed(1)}%`,
            `${inv.currency === 'USD' ? '$' : '€'}${newP.toLocaleString('es-ES', { maximumFractionDigits: 0 })}`
          )
        }
      }
      setLastUpdate(new Date())
      if (updated) await loadData()
      if (!silent && !updated) toast.info('Los precios ya están actualizados')
    } catch (e) {
      console.error('[price-update]', e)
      if (!silent) toast.error('Error al actualizar precios')
    } finally {
      setUpdatingPrices(false)
    }
  }, [user, updatingPrices, investments, priceMut, loadData, toast])

  useEffect(() => {
    const hasCrypto = investments.some(i => (i.type ?? i.asset_type) === 'crypto')
    if (!hasCrypto || loading) return
    const t0 = setTimeout(() => runPriceUpdate(true), 2000)
    const iv = setInterval(() => runPriceUpdate(true), 90_000)
    return () => { clearTimeout(t0); clearInterval(iv) }
  }, [investments.length, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSubmitting(true)
    try {
      const input: CreateInvestmentInput = {
        user_id: user.id,
        organization_id: currentWorkspace?.id ?? null,
        name, type,
        symbol: symbol || null,
        ticker: symbol || null,
        quantity:          parseFloat(quantity)    || 0,
        buy_price:         parseFloat(buyPrice)    || null,
        current_price:     parseFloat(currentPrice)|| null,
        notes: notes || null,
        account_id: accountId || null,
        fund_from_account_id: !editingId ? (fundFromId || null) : undefined,
        position_type: positionType,
        leverage:          parseFloat(leverage)    || 1,
        margin_amount:     parseFloat(marginAmount)|| null,
        is_short: isShort,
        liquidation_price: parseFloat(liqPrice)   || null,
        position_status: 'open',
      }
      if (editingId) {
        await updateMut.mutateAsync({ id: editingId, updates: input as any })
      } else {
        await createMut.mutateAsync(input)
      }
      setShowCreateModal(false); resetForm(); loadData()
    } catch (e) { console.error(e) }
    finally { setSubmitting(false) }
  }

  const handleUpdatePrice = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedInv || !user) return
    setSubmitting(true)
    try {
      await priceMut.mutateAsync({
        id: selectedInv.id, userId: user.id,
        price: parseFloat(newPrice), date: priceDate,
      })
      setShowPriceModal(false); setSelectedInv(null); setNewPrice('')
      loadData()
    } catch (e) { console.error(e) }
    finally { setSubmitting(false) }
  }

  const handleDelete = async (inv: Investment) => {
    if (!confirm(`¿Eliminar la inversión "${inv.name}"?`)) return
    try { await deleteMut.mutateAsync(inv.id); loadData() }
    catch (e) { console.error(e) }
  }

  const resetForm = () => {
    setEditingId(null); setName(''); setType('crypto'); setSymbol('')
    setQuantity(''); setBuyPrice(''); setCurrentPrice(''); setNotes('')
    setAccountId(''); setFundFromId(''); setPositionType('spot')
    setLeverage(''); setMarginAmount(''); setIsShort(false); setLiqPrice('')
  }

  const openEditModal = (inv: Investment) => {
    setEditingId(inv.id); setName(inv.name)
    setType(inv.type ?? 'other')
    setSymbol(inv.symbol ?? inv.ticker ?? '')
    setQuantity(String(inv.quantity ?? ''))
    setBuyPrice(String(inv.buy_price ?? inv.avg_buy_price ?? ''))
    setCurrentPrice(String(inv.current_price ?? ''))
    setNotes(inv.notes ?? '')
    setAccountId(inv.account_id ?? '')
    setPositionType(inv.position_type ?? 'spot')
    setLeverage(String(inv.leverage ?? 1))
    setMarginAmount(String(inv.margin_amount ?? ''))
    setIsShort(inv.is_short ?? false)
    setLiqPrice(String(inv.liquidation_price ?? ''))
    setShowCreateModal(true)
  }

  // ── Derived data ──────────────────────────────────────────────────────────
  const totals   = calculateTotals(investments)
  const hasCrypto = investments.some(i => (i.type ?? i.asset_type) === 'crypto')
  const totalEquityEur = investments.reduce((s, i) => s + equityEur(i), 0)

  if (loading) return (
    <div className="d-flex items-center justify-center" style={{ minHeight: 200 }}>
      <div className="spinner" />
    </div>
  )

  return (
    <div className="page-container">

      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('investments.title')}</h1>
          <p className="page-subtitle" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {t('investments.subtitle')}
            {lastUpdate && hasCrypto && (
              <span style={{
                fontSize: '0.72rem', color: 'var(--success)',
                background: 'rgba(34,197,94,0.1)', padding: '2px 8px',
                borderRadius: 20, border: '1px solid rgba(34,197,94,0.2)',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                <Activity size={10} />
                En vivo · {lastUpdate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </p>
        </div>
        <div className="d-flex gap-2">
          {hasCrypto && (
            <button className="btn btn-secondary" onClick={() => runPriceUpdate(false)} disabled={updatingPrices}>
              <RefreshCw size={16} className={updatingPrices ? 'animate-spin' : ''} />
              {updatingPrices ? 'Actualizando…' : 'Actualizar precios'}
            </button>
          )}
          <button className="btn btn-primary" onClick={() => { resetForm(); setShowCreateModal(true) }}>
            <Plus size={18} /> Nueva inversión
          </button>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '1.5rem' }}>
        <div style={S.kpiCard('var(--primary)')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <DollarSign size={13} /> Equity total
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'monospace' }}>
            {fmt(totalEquityEur)}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Capital real desplegado</div>
        </div>

        <div style={S.kpiCard(totals.totalGain >= 0 ? 'var(--success)' : 'var(--danger)')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <BarChart2 size={13} /> P&L total
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'monospace', color: totals.totalGain >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {totals.totalGain >= 0 ? '+' : ''}{fmt(totals.totalGain)}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {totals.gainPercent >= 0 ? '+' : ''}{totals.gainPercent.toFixed(2)}% sobre coste
          </div>
        </div>

        <div style={S.kpiCard('var(--warning)')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <Shield size={13} /> Posiciones abiertas
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>
            {investments.filter(i => i.position_status !== 'closed').length}
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 400 }}> / {investments.length}</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {investments.filter(i => i.position_type !== 'spot').length} apalancadas
          </div>
        </div>
      </div>

      {/* ── Investment cards ── */}
      {investments.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          border: '2px dashed var(--border)', borderRadius: 12,
          color: 'var(--text-muted)',
        }}>
          <TrendingUp size={40} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
          <p style={{ marginBottom: 16 }}>No hay inversiones registradas</p>
          <button className="btn btn-primary" onClick={() => { resetForm(); setShowCreateModal(true) }}>
            <Plus size={16} /> Nueva inversión
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
          {investments.map(inv => {
            const sym     = (inv.symbol ?? inv.ticker ?? '').toUpperCase()
            const live    = liveRates[sym]
            const isLev   = inv.position_type !== 'spot'
            const assetType = inv.type ?? inv.asset_type ?? 'other'

            const pnlRaw  = getUnrealisedPnl(inv)
            const pnlEur  = pnlRaw != null ? toEur(pnlRaw, inv.currency ?? 'EUR', sym) : null
            const pnlPct  = getPnlPercent(inv)
            const eq      = equityEur(inv)
            const pnlPos  = pnlEur != null ? pnlEur >= 0 : null

            const liqPx   = inv.liquidation_price
            const curPx   = inv.current_price
            const liqDist = liqPx && curPx
              ? Math.abs(((curPx - liqPx) / curPx) * 100) : null
            const liqWarn = liqDist != null && liqDist < 20

            const typeLabel = investmentTypes.find(t => t.value === assetType)?.label ?? assetType

            return (
              <div key={inv.id} style={S.posCard}>

                {/* ── Card header ── */}
                <div style={S.posCardHeader(pnlPos)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={S.symbolBadge(assetType)}>
                      {sym ? sym.slice(0, 4) : '?'}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {inv.name}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 3 }}>
                        <span style={S.typeBadge}>{typeLabel}</span>
                        {isLev && (
                          <>
                            <span style={S.leverageBadge}>×{inv.leverage}</span>
                            <span style={S.dirBadge(inv.is_short ?? false)}>
                              {inv.is_short ? 'SHORT' : 'LONG'}
                            </span>
                            <span style={S.typeBadge}>{positionTypeLabels[inv.position_type] ?? inv.position_type}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* P&L badge top-right */}
                  {pnlEur != null && (
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={S.pnlBadge(pnlEur >= 0)}>
                        {pnlEur >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                        {pnlEur >= 0 ? '+' : ''}{fmt(pnlEur)}
                      </div>
                      {pnlPct != null && (
                        <div style={{ fontSize: '0.7rem', color: pnlEur >= 0 ? 'var(--success)' : 'var(--danger)', textAlign: 'right', marginTop: 1 }}>
                          {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ── Card body ── */}
                <div style={S.posCardBody}>

                  {/* Precio actual */}
                  <div style={S.statBlock}>
                    <span style={S.statLabel}>Precio actual</span>
                    {curPx != null ? (
                      <>
                        <span style={{ ...S.statValue('lg'), color: 'var(--text)' }}>
                          {inv.currency === 'USD'
                            ? `$${curPx.toLocaleString('es-ES', { maximumFractionDigits: 0 })}`
                            : fmt(curPx)
                          }
                        </span>
                        {inv.currency === 'USD' && live && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            ≈ {fmt(live.eur)}
                          </span>
                        )}
                      </>
                    ) : (
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Sin precio</span>
                    )}
                  </div>

                  {/* Equity */}
                  <div style={{ ...S.statBlock, textAlign: 'right' }}>
                    <span style={S.statLabel}>Equity</span>
                    <span style={{ ...S.statValue('lg'), color: 'var(--text)' }}>{fmt(eq)}</span>
                    {isLev && inv.margin_amount != null && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        Margen: {inv.currency === 'USD' ? `$${Number(inv.margin_amount).toLocaleString('es-ES')}` : fmt(Number(inv.margin_amount))}
                      </span>
                    )}
                    {!isLev && inv.quantity != null && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {inv.quantity} uds
                      </span>
                    )}
                  </div>

                  {/* Precio entrada */}
                  {(inv.buy_price ?? inv.avg_buy_price) != null && (
                    <div style={S.statBlock}>
                      <span style={S.statLabel}>Precio entrada</span>
                      <span style={S.statValue('sm')}>
                        {inv.currency === 'USD'
                          ? `$${Number(inv.buy_price ?? inv.avg_buy_price).toLocaleString('es-ES', { maximumFractionDigits: 0 })}`
                          : fmt(Number(inv.buy_price ?? inv.avg_buy_price))
                        }
                      </span>
                    </div>
                  )}

                  {/* Liq price or empty filler */}
                  {liqPx != null ? (
                    <div style={{ ...S.statBlock, textAlign: 'right' }}>
                      <span style={S.statLabel}>Liquidación</span>
                      <div style={S.liqBadge(liqWarn)}>
                        {liqWarn && <AlertTriangle size={10} />}
                        ${Number(liqPx).toLocaleString('es-ES', { maximumFractionDigits: 0 })}
                      </div>
                      {liqDist != null && (
                        <span style={{ fontSize: '0.68rem', color: liqWarn ? 'var(--danger)' : 'var(--text-muted)', marginTop: 2 }}>
                          {liqDist.toFixed(1)}% distancia
                        </span>
                      )}
                    </div>
                  ) : null}

                  {/* Notes */}
                  {inv.notes && (
                    <div style={{ gridColumn: '1 / -1', fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                      {inv.notes}
                    </div>
                  )}
                </div>

                {/* ── Card footer / actions ── */}
                <div style={S.posCardFooter}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {inv.position_status === 'closed' ? (
                      <span style={{ color: 'var(--danger)', fontWeight: 600 }}>● Cerrada</span>
                    ) : (
                      <span style={{ color: 'var(--success)', fontWeight: 600 }}>● Abierta</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-icon btn-secondary" onClick={() => openEditModal(inv)} title="Editar" style={{ width: 30, height: 30 }}>
                      <Pencil size={13} />
                    </button>
                    {assetType === 'crypto' && (
                      <button className="btn btn-icon btn-secondary"
                        onClick={() => { setSelectedInv(inv); setNewPrice(String(inv.current_price ?? '')); setPriceDate(new Date().toISOString().split('T')[0]); setShowPriceModal(true) }}
                        title="Actualizar precio"
                        style={{ width: 30, height: 30 }}>
                        <Zap size={13} />
                      </button>
                    )}
                    <button className="btn btn-icon btn-secondary" onClick={() => navigate(`/app/investments/${inv.id}`)} title="Ver detalle" style={{ width: 30, height: 30 }}>
                      <Eye size={13} />
                    </button>
                    <button className="btn btn-icon btn-danger" onClick={() => handleDelete(inv)} title="Eliminar" style={{ width: 30, height: 30 }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Create / Edit modal ── */}
      <UiModal isOpen={showCreateModal} onClose={() => { setShowCreateModal(false); resetForm() }} width="640px">
        <form onSubmit={handleSave}>
          <UiModalHeader>
            <div className="d-flex items-center justify-between">
              <h3 className="text-xl font-bold">{editingId ? 'Editar inversión' : 'Nueva inversión'}</h3>
              <button type="button" onClick={() => { setShowCreateModal(false); resetForm() }}><X size={20} /></button>
            </div>
          </UiModalHeader>
          <UiModalBody>
            <div className="d-flex gap-2 mb-3">
              <div style={{ flex: 2 }}>
                <UiInput label="Nombre" value={name} onChange={e => setName(e.target.value)} placeholder="Bitcoin, Lamine Yamal cards…" required />
              </div>
              <div style={{ flex: 1 }}>
                <UiInput label="Símbolo" value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} placeholder="BTC, ETH…" />
              </div>
            </div>

            <div className="d-flex gap-2 mb-3">
              <div style={{ flex: 1 }}>
                <UiField label="Tipo de activo">
                  <UiSelect value={type} onChange={setType}
                    options={investmentTypes.map(t => ({ value: t.value, label: t.label }))} />
                </UiField>
              </div>
              <div style={{ flex: 1 }}>
                <UiField label="Tipo de posición">
                  <UiSelect value={positionType} onChange={v => setPositionType(v as PositionType)}
                    options={[
                      { value: 'spot',      label: 'Spot (directo)' },
                      { value: 'margin',    label: 'Margen' },
                      { value: 'futures',   label: 'Futuros' },
                      { value: 'perpetual', label: 'Perpetuo' },
                    ]} />
                </UiField>
              </div>
            </div>

            {positionType === 'spot' ? (
              <div className="d-flex gap-2 mb-3">
                <div style={{ flex: 1 }}>
                  <UiNumber label="Cantidad" value={quantity} onChange={setQuantity} step="any" min={0} required />
                </div>
                <div style={{ flex: 1 }}>
                  <UiNumber label="Precio entrada" value={buyPrice} onChange={setBuyPrice} step="0.01" min={0} />
                </div>
                <div style={{ flex: 1 }}>
                  <UiNumber label="Precio actual" value={currentPrice} onChange={setCurrentPrice} step="0.01" min={0} />
                </div>
              </div>
            ) : (
              <>
                <div className="d-flex gap-2 mb-3">
                  <div style={{ flex: 1 }}>
                    <UiNumber label="Margen ($)" value={marginAmount} onChange={setMarginAmount} step="0.01" min={0} required />
                  </div>
                  <div style={{ flex: 1 }}>
                    <UiNumber label="Apalancamiento ×" value={leverage} onChange={setLeverage} step="0.1" min={1} placeholder="4" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <UiNumber label="Liq. price ($)" value={liqPrice} onChange={setLiqPrice} step="0.01" min={0} />
                  </div>
                </div>
                <div className="d-flex gap-2 mb-3">
                  <div style={{ flex: 1 }}>
                    <UiNumber label="Cantidad (unidades)" value={quantity} onChange={setQuantity} step="any" min={0} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <UiNumber label="Precio entrada ($)" value={buyPrice} onChange={setBuyPrice} step="0.01" min={0} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <UiNumber label="Precio actual ($)" value={currentPrice} onChange={setCurrentPrice} step="0.01" min={0} />
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, cursor: 'pointer', userSelect: 'none' }}>
                  <input type="checkbox" checked={isShort} onChange={e => setIsShort(e.target.checked)} style={{ width: 16, height: 16 }} />
                  <span style={{ fontSize: '0.875rem' }}>Posición corta (SHORT)</span>
                </label>
              </>
            )}

            <div className="mb-3">
              <UiField label="Cuenta custodia (opcional)">
                <UiSelect value={accountId} onChange={setAccountId}
                  options={[{ value: '', label: 'Sin asignar' }, ...accounts.map(a => ({ value: a.id, label: a.name }))]} />
              </UiField>
            </div>

            {!editingId && (
              <div className="mb-3">
                <UiField label="Pagar con fondos de… (opcional)">
                  <UiSelect value={fundFromId} onChange={setFundFromId}
                    options={[{ value: '', label: 'Solo registrar' }, ...accounts.map(a => ({ value: a.id, label: `${a.name} (${fmt(a.balance)})` }))]} />
                </UiField>
              </div>
            )}

            <UiInput label="Notas (opcional)" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Contexto adicional…" />
          </UiModalBody>
          <UiModalFooter>
            <button type="button" className="btn btn-secondary" onClick={() => { setShowCreateModal(false); resetForm() }}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Guardando…' : (editingId ? 'Guardar cambios' : 'Crear inversión')}
            </button>
          </UiModalFooter>
        </form>
      </UiModal>

      {/* ── Price update modal ── */}
      <UiModal isOpen={showPriceModal && !!selectedInv} onClose={() => setShowPriceModal(false)} width="380px">
        <form onSubmit={handleUpdatePrice}>
          <UiModalHeader>
            <div className="d-flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Actualizar precio</h3>
                {selectedInv && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    {selectedInv.symbol && <strong>{selectedInv.symbol} · </strong>}
                    {selectedInv.name}
                    {selectedInv.current_price != null && (
                      <span style={{ marginLeft: 8, color: 'var(--text-muted)' }}>
                        Actual: {selectedInv.currency === 'USD' ? `$${selectedInv.current_price.toLocaleString('es-ES')}` : fmt(selectedInv.current_price)}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <button type="button" onClick={() => setShowPriceModal(false)}><X size={20} /></button>
            </div>
          </UiModalHeader>
          <UiModalBody>
            <div className="mb-3">
              <UiNumber
                label={`Nuevo precio (${selectedInv?.currency === 'USD' ? 'USD $' : 'EUR €'})`}
                value={newPrice} onChange={setNewPrice} step="0.01" min={0} required
              />
              {selectedInv?.currency === 'USD' && newPrice && !isNaN(parseFloat(newPrice)) && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  ≈ {fmt(parseFloat(newPrice) * FALLBACK_EUR_USD)} (tipo de cambio ~0.92)
                </div>
              )}
            </div>
            <UiField label="Fecha">
              <UiDatePicker value={priceDate} onChange={d => setPriceDate(d ? formatISODateString(d) : '')} required />
            </UiField>
          </UiModalBody>
          <UiModalFooter>
            <button type="button" className="btn btn-secondary" onClick={() => setShowPriceModal(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Guardando…' : 'Actualizar'}
            </button>
          </UiModalFooter>
        </form>
      </UiModal>
    </div>
  )
}
