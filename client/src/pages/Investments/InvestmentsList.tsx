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
  AlertTriangle, Zap,
} from 'lucide-react'
import { useI18n } from '../../hooks/useI18n'
import { UiDatePicker } from '../../components/ui/UiDatePicker'
import { formatISODateString } from '../../utils/date'
import { UiSelect } from '../../components/ui/UiSelect'
import { UiField } from '../../components/ui/UiField'
import { UiCard, UiCardBody } from '../../components/ui/UiCard'
import { UiInput } from '../../components/ui/UiInput'
import { UiNumber } from '../../components/ui/UiNumber'
import { UiModal, UiModalHeader, UiModalBody, UiModalFooter } from '../../components/ui/UiModal'
import { useToast } from '../../components/Toast'

// EUR/USD fallback rate when CoinGecko hasn't been queried yet
const FALLBACK_EUR_USD = 0.92

export default function InvestmentsList() {
  const navigate = useNavigate()
  const { t, language } = useI18n()
  const { user } = useAuth()
  const { currentWorkspace } = useWorkspace()
  const toast = useToast()
  const createMut  = useCreateInvestment()
  const updateMut  = useUpdateInvestment()
  const deleteMut  = useDeleteInvestment()
  const priceMut   = useUpdateInvestmentPrice()

  const [investments, setInvestments] = useState<Investment[]>([])
  const [loading,     setLoading]     = useState(true)
  const [accounts,    setAccounts]    = useState<AccountWithBalance[]>([])

  // Live rates from CoinGecko via server proxy  (symbol → {eur, usd})
  const [liveRates, setLiveRates] = useState<Record<string, { eur: number; usd: number }>>({})
  const [updatingPrices, setUpdatingPrices] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showPriceModal,  setShowPriceModal]  = useState(false)
  const [selectedInv,     setSelectedInv]     = useState<Investment | null>(null)
  const [editingId,       setEditingId]       = useState<string | null>(null)
  const [submitting,      setSubmitting]      = useState(false)

  // Create/edit form
  const [name,          setName]         = useState('')
  const [type,          setType]         = useState<string>('crypto')
  const [symbol,        setSymbol]       = useState('')
  const [quantity,      setQuantity]     = useState('')
  const [buyPrice,      setBuyPrice]     = useState('')
  const [currentPrice,  setCurrentPrice] = useState('')
  const [notes,         setNotes]        = useState('')
  const [accountId,     setAccountId]    = useState('')
  const [fundFromId,    setFundFromId]   = useState('')
  const [positionType,  setPositionType] = useState<PositionType>('spot')
  const [leverage,      setLeverage]     = useState('')
  const [marginAmount,  setMarginAmount] = useState('')
  const [isShort,       setIsShort]      = useState(false)
  const [liqPrice,      setLiqPrice]     = useState('')

  // Price update form
  const [newPrice,  setNewPrice]  = useState('')
  const [priceDate, setPriceDate] = useState(new Date().toISOString().split('T')[0])

  const fmt = useCallback((n: number, currency = 'EUR') =>
    new Intl.NumberFormat(language === 'es' ? 'es-ES' : 'en-US', { style: 'currency', currency })
      .format(n), [language])

  // ── EUR/USD conversion ───────────────────────────────────────────────────
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
    const eq = getPositionEquity(inv)
    return toEur(eq, inv.currency ?? 'EUR', inv.symbol ?? inv.ticker)
  }

  // ── Data loading ─────────────────────────────────────────────────────────
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

  // ── Batch price update (single CoinGecko call per tick) ──────────────────
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
        // Use USD price for USD-denominated positions, EUR otherwise
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

  // Auto-update every 90 seconds when there are crypto investments
  useEffect(() => {
    const hasCrypto = investments.some(i => (i.type ?? i.asset_type) === 'crypto')
    if (!hasCrypto || loading) return
    const t0 = setTimeout(() => runPriceUpdate(true), 2000)
    const iv = setInterval(() => runPriceUpdate(true), 90_000)
    return () => { clearTimeout(t0); clearInterval(iv) }
  }, [investments.length, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── CRUD ─────────────────────────────────────────────────────────────────
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
        quantity:     parseFloat(quantity)   || 0,
        buy_price:    parseFloat(buyPrice)   || null,
        current_price:parseFloat(currentPrice)||null,
        notes: notes || null,
        account_id: accountId || null,
        fund_from_account_id: !editingId ? (fundFromId || null) : undefined,
        position_type: positionType,
        leverage: parseFloat(leverage) || 1,
        margin_amount: parseFloat(marginAmount) || null,
        is_short: isShort,
        liquidation_price: parseFloat(liqPrice) || null,
        position_status: 'open',
      }
      if (editingId) {
        await updateMut.mutateAsync({ id: editingId, updates: input as any })
      } else {
        await createMut.mutateAsync(input)
      }
      setShowCreateModal(false)
      resetForm()
      loadData()
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

  // ── Render ────────────────────────────────────────────────────────────────
  const totals  = calculateTotals(investments)
  const hasCrypto = investments.some(i => (i.type ?? i.asset_type) === 'crypto')

  if (loading) return (
    <div className="d-flex items-center justify-center" style={{ minHeight: '200px' }}>
      <div className="spinner" />
    </div>
  )

  return (
    <div className="page-container">
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('investments.title')}</h1>
          <p className="page-subtitle">
            {t('investments.subtitle')}
            {lastUpdate && hasCrypto && (
              <span className="text-xs text-muted ml-2">
                · Precios: {lastUpdate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </p>
        </div>
        <div className="d-flex gap-2">
          {hasCrypto && (
            <button className="btn btn-secondary" onClick={() => runPriceUpdate(false)} disabled={updatingPrices}>
              <RefreshCw size={18} className={updatingPrices ? 'animate-spin' : ''} />
              {updatingPrices ? 'Actualizando…' : 'Actualizar precios'}
            </button>
          )}
          <button className="btn btn-primary" onClick={() => { resetForm(); setShowCreateModal(true) }}>
            <Plus size={20} /> {t('investments.new')}
          </button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="kpi-card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div className="kpi-label">Valor total (equity)</div>
          <div className="kpi-value">{fmt(investments.reduce((s, i) => s + equityEur(i), 0))}</div>
          <div className="kpi-sublabel text-xs text-muted">Capital real desplegado</div>
        </div>
        <div className="kpi-card" style={{ borderLeft: `4px solid ${totals.totalGain >= 0 ? 'var(--success)' : 'var(--danger)'}` }}>
          <div className="kpi-label">P&L total</div>
          <div className="kpi-value" style={{ color: totals.totalGain >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {totals.totalGain >= 0 ? '+' : ''}{fmt(totals.totalGain)}
          </div>
          <div className="kpi-sublabel text-xs text-muted">{totals.gainPercent.toFixed(2)}% sobre coste</div>
        </div>
        <div className="kpi-card" style={{ borderLeft: '4px solid var(--warning)' }}>
          <div className="kpi-label">Posiciones abiertas</div>
          <div className="kpi-value">{investments.filter(i => i.position_status !== 'closed').length}</div>
          <div className="kpi-sublabel text-xs text-muted">de {investments.length} totales</div>
        </div>
      </div>

      {/* ── Table ── */}
      {investments.length === 0 ? (
        <UiCard>
          <UiCardBody>
            <div className="text-center py-8 text-muted">
              <TrendingUp size={32} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
              <p>No hay inversiones registradas</p>
              <button className="btn btn-primary mt-3" onClick={() => { resetForm(); setShowCreateModal(true) }}>
                <Plus size={16} /> Nueva inversión
              </button>
            </div>
          </UiCardBody>
        </UiCard>
      ) : (
        <UiCard>
          <UiCardBody noPadding style={{ overflow: 'hidden' }}>
            <div className="table-container">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th style={{ padding: '0.75rem 1.5rem' }}>Nombre</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Tipo / Posición</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Precio actual</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Equity (EUR)</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>P&L</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Liquidación</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {investments.map(inv => {
                    const sym       = (inv.symbol ?? inv.ticker ?? '').toUpperCase()
                    const live      = liveRates[sym]
                    const curPrEur  = live ? (inv.currency === 'USD' ? live.usd * (live.eur / live.usd) : live.eur) : (inv.current_price ?? 0)
                    const eq        = equityEur(inv)
                    const pnl       = getUnrealisedPnl(inv)
                    const pnlEur    = pnl != null ? toEur(pnl, inv.currency ?? 'EUR', sym) : null
                    const pnlPct    = getPnlPercent(inv)
                    const isLev     = inv.position_type !== 'spot'
                    const liqDist   = inv.liquidation_price && inv.current_price
                      ? Math.abs(((inv.current_price - inv.liquidation_price) / inv.current_price) * 100) : null
                    const liqWarning = liqDist != null && liqDist < 20

                    return (
                      <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        {/* Name */}
                        <td style={{ padding: '0.75rem 1.5rem' }}>
                          <div style={{ fontWeight: 600 }} className="d-flex items-center gap-2">
                            {sym && <span className="text-xs badge badge-gray">{sym}</span>}
                            <span>{inv.name}</span>
                          </div>
                          {inv.notes && <div className="text-xs text-muted mt-1">{inv.notes}</div>}
                        </td>

                        {/* Type + position badges */}
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div className="d-flex flex-col gap-1">
                            <span className="badge badge-gray" style={{ fontSize: '0.7rem' }}>
                              {investmentTypes.find(t => t.value === (inv.type ?? inv.asset_type))?.label ?? inv.type}
                            </span>
                            {isLev && (
                              <div className="d-flex gap-1">
                                <span className="badge" style={{
                                  fontSize: '0.65rem',
                                  background: 'var(--warning)',
                                  color: '#000',
                                  fontWeight: 700,
                                }}>
                                  ×{inv.leverage}
                                </span>
                                <span className="badge" style={{
                                  fontSize: '0.65rem',
                                  background: inv.is_short ? 'var(--danger)' : 'var(--success)',
                                  color: '#fff',
                                }}>
                                  {inv.is_short ? 'SHORT' : 'LONG'}
                                </span>
                                <span className="badge badge-gray" style={{ fontSize: '0.65rem' }}>
                                  {positionTypeLabels[inv.position_type] ?? inv.position_type}
                                </span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Current price */}
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontFamily: 'monospace' }}>
                          {inv.current_price != null ? (
                            <div>
                              <div style={{ fontWeight: 600 }}>
                                {inv.currency === 'USD'
                                  ? `$${inv.current_price.toLocaleString('es-ES', { maximumFractionDigits: 0 })}`
                                  : fmt(inv.current_price)
                                }
                              </div>
                              {inv.currency === 'USD' && live && (
                                <div className="text-xs text-muted">{fmt(live.eur)}</div>
                              )}
                            </div>
                          ) : <span className="text-muted">—</span>}
                        </td>

                        {/* Equity */}
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                          <div style={{ fontWeight: 700 }}>{fmt(eq)}</div>
                          {isLev && inv.margin_amount != null && (
                            <div className="text-xs text-muted">
                              margen: {inv.currency === 'USD'
                                ? `$${inv.margin_amount.toLocaleString('es-ES')}`
                                : fmt(inv.margin_amount)
                              }
                            </div>
                          )}
                          {!isLev && inv.quantity != null && (
                            <div className="text-xs text-muted">{inv.quantity} unidades</div>
                          )}
                        </td>

                        {/* PnL */}
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                          {pnlEur != null ? (
                            <div className="d-flex items-center justify-end gap-1"
                              style={{ color: pnlEur >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                              {pnlEur >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                              <div>
                                <div style={{ fontWeight: 600 }}>
                                  {pnlEur >= 0 ? '+' : ''}{fmt(pnlEur)}
                                </div>
                                {pnlPct != null && (
                                  <div className="text-xs">
                                    {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : <span className="text-muted">—</span>}
                        </td>

                        {/* Liquidation price */}
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                          {inv.liquidation_price != null ? (
                            <div className={liqWarning ? 'text-danger' : 'text-muted'} style={{ fontSize: '0.85rem' }}>
                              {liqWarning && <AlertTriangle size={12} style={{ display: 'inline', marginRight: 3 }} />}
                              ${inv.liquidation_price.toLocaleString('es-ES')}
                              {liqDist != null && (
                                <div className="text-xs">{liqDist.toFixed(1)}% distancia</div>
                              )}
                            </div>
                          ) : <span className="text-muted" style={{ fontSize: '0.75rem' }}>—</span>}
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <div className="d-flex gap-1 justify-end">
                            <button className="btn btn-icon btn-secondary" onClick={() => openEditModal(inv)} title="Editar">
                              <Pencil size={15} />
                            </button>
                            {(inv.type ?? inv.asset_type) === 'crypto' && (
                              <button className="btn btn-icon btn-secondary"
                                onClick={() => { setSelectedInv(inv); setNewPrice(String(inv.current_price ?? '')); setPriceDate(new Date().toISOString().split('T')[0]); setShowPriceModal(true) }}
                                title="Actualizar precio">
                                <Zap size={15} />
                              </button>
                            )}
                            <button className="btn btn-icon btn-secondary" onClick={() => navigate(`/app/investments/${inv.id}`)} title="Ver detalle">
                              <Eye size={15} />
                            </button>
                            <button className="btn btn-icon btn-danger" onClick={() => handleDelete(inv)} title="Eliminar">
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </UiCardBody>
        </UiCard>
      )}

      {/* ── Create/Edit Modal ── */}
      <UiModal isOpen={showCreateModal} onClose={() => { setShowCreateModal(false); resetForm() }} width="620px">
        <form onSubmit={handleSave}>
          <UiModalHeader>
            <div className="d-flex items-center justify-between">
              <h3 className="text-xl font-bold">{editingId ? 'Editar inversión' : 'Nueva inversión'}</h3>
              <button type="button" onClick={() => { setShowCreateModal(false); resetForm() }}><X size={20} /></button>
            </div>
          </UiModalHeader>
          <UiModalBody>
            {/* Basic info */}
            <div className="d-flex gap-2 mb-3">
              <div style={{ flex: 2 }}>
                <UiInput label="Nombre" value={name} onChange={e => setName(e.target.value)} placeholder="Bitcoin, Lamine Yamal cards…" required />
              </div>
              <div style={{ flex: 1 }}>
                <UiInput label="Símbolo / Ticker" value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} placeholder="BTC, ETH, XMR…" />
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

            {/* Spot fields */}
            {positionType === 'spot' && (
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
            )}

            {/* Leveraged position fields */}
            {positionType !== 'spot' && (
              <>
                <div className="d-flex gap-2 mb-3">
                  <div style={{ flex: 1 }}>
                    <UiNumber label="Margen depositado ($)" value={marginAmount} onChange={setMarginAmount} step="0.01" min={0} required />
                  </div>
                  <div style={{ flex: 1 }}>
                    <UiNumber label="Apalancamiento (×)" value={leverage} onChange={setLeverage} step="0.1" min={1} placeholder="4" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <UiNumber label="Precio liquidación" value={liqPrice} onChange={setLiqPrice} step="0.01" min={0} />
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
                <div className="d-flex items-center gap-2 mb-3">
                  <input type="checkbox" id="isShort" checked={isShort} onChange={e => setIsShort(e.target.checked)} />
                  <label htmlFor="isShort" className="text-sm">Posición corta (SHORT)</label>
                </div>
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

      {/* ── Update Price Modal ── */}
      <UiModal isOpen={showPriceModal && !!selectedInv} onClose={() => setShowPriceModal(false)} width="380px">
        <form onSubmit={handleUpdatePrice}>
          <UiModalHeader>
            <div className="d-flex items-center justify-between">
              <h3 className="text-lg font-bold">Actualizar precio — {selectedInv?.name}</h3>
              <button type="button" onClick={() => setShowPriceModal(false)}><X size={20} /></button>
            </div>
          </UiModalHeader>
          <UiModalBody>
            <div className="mb-3">
              <UiNumber label={selectedInv?.currency === 'USD' ? 'Nuevo precio (USD)' : 'Nuevo precio (EUR)'}
                value={newPrice} onChange={setNewPrice} step="0.01" min={0} required />
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
