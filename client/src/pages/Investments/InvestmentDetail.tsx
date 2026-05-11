import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import {
  getInvestmentById,
  getPriceHistory,
  updatePrice,
  investmentTypes,
  fetchInvestmentMovements,
  deleteInvestmentMovement,
  type Investment,
  type PriceHistoryEntry,
  type InvestmentMovement,
} from '../../services/investmentService'
import { ArrowLeft, TrendingUp, TrendingDown, Plus, RefreshCw, Trash2, Inbox } from 'lucide-react'
import { UiDatePicker } from '../../components/ui/UiDatePicker'
import { formatISODateString } from '../../utils/date'
import { UiNumber } from '../../components/ui/UiNumber'
import { useToast } from '../../components/Toast'
import { useSettings } from '../../context/SettingsContext'
import { formatEUR, formatDate as formatDateUtil } from '../../utils/format'

const MOVEMENTS_PAGE_SIZE = 20

export default function InvestmentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const toast = useToast()
  const { settings } = useSettings()
  const queryClient = useQueryClient()
  const [investment, setInvestment] = useState<Investment | null>(null)
  const [history, setHistory] = useState<PriceHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  // Update price form
  const [showPriceForm, setShowPriceForm] = useState(false)
  const [newPrice, setNewPrice] = useState('')
  const [priceDate, setPriceDate] = useState(new Date().toISOString().split('T')[0])
  const [submitting, setSubmitting] = useState(false)

  // Chart type preference (persisted)
  const [chartType, setChartType] = useState<'bars' | 'line'>(() => {
    if (typeof window === 'undefined') return 'bars'
    return (window.localStorage.getItem('investment-chart-type') as 'bars' | 'line') || 'bars'
  })
  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem('investment-chart-type', chartType)
  }, [chartType])

  // Movements
  const [movementsPage, setMovementsPage] = useState(1)
  const [deletingMovementId, setDeletingMovementId] = useState<string | null>(null)
  const investmentId = id ?? ''

  const movementsQuery = useQuery<{ data: InvestmentMovement[]; total: number }>({
    queryKey: ['investment-movements', investmentId, movementsPage],
    queryFn: () => fetchInvestmentMovements(investmentId, {
      limit: MOVEMENTS_PAGE_SIZE,
      offset: (movementsPage - 1) * MOVEMENTS_PAGE_SIZE,
    }),
    enabled: !!investmentId,
  })

  const movements = movementsQuery.data?.data ?? []
  const movementsTotal = movementsQuery.data?.total ?? 0
  const hasMoreMovements = movementsPage * MOVEMENTS_PAGE_SIZE < movementsTotal

  useEffect(() => {
    if (id) loadData()
  }, [id])

  const loadData = async () => {
    if (!id) return
    try {
      const [inv, hist] = await Promise.all([
        getInvestmentById(id),
        getPriceHistory(id)
      ])
      setInvestment(inv)
      setHistory(hist)
    } catch (error) {
      console.error('Error loading investment:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdatePrice = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !investment) return
    setSubmitting(true)

    if (!user) {
      setSubmitting(false)
      return
    }

    try {
      await updatePrice(id, user.id, parseFloat(newPrice), priceDate)
      setShowPriceForm(false)
      setNewPrice('')
      loadData()
      toast.success('Precio actualizado', 'El precio se ha registrado correctamente')
    } catch (error: any) {
      console.error('Error updating price:', error)
      toast.error('Error al actualizar precio', error?.message || 'No se pudo actualizar el precio')
    } finally {
      setSubmitting(false)
    }
  }



  const handleDeleteMovement = async (movement: InvestmentMovement) => {
    if (!id) return
    const ok = window.confirm('¿Eliminar este movimiento? Esta acción no se puede deshacer.')
    if (!ok) return
    setDeletingMovementId(movement.id)
    try {
      await deleteInvestmentMovement(id, movement.id)
      queryClient.invalidateQueries({ queryKey: ['investment-movements', id] })
      queryClient.invalidateQueries({ queryKey: ['investments'] })
      // Refresh the investment detail (positions update after movement deletion).
      loadData()
      toast.success('Movimiento eliminado', 'El movimiento se ha eliminado correctamente')
    } catch (error: any) {
      console.error('Error deleting movement:', error)
      toast.error('Error al eliminar movimiento', error?.message || 'No se pudo eliminar el movimiento')
    } finally {
      setDeletingMovementId(null)
    }
  }

  const formatCurrency = (amount: number) => {
    return formatEUR(amount, settings)
  }

  const formatDate = (date: string) => {
    return formatDateUtil(date, settings)
  }

  const getTypeName = (typeVal: string) => {
    return investmentTypes.find(t => t.value === typeVal)?.label || typeVal
  }

  const assetType = investment?.type ?? investment?.asset_type ?? ''
  const quantityDecimals = assetType === 'crypto' ? 8 : 2

  const formatQuantity = (qty: number, decimals = quantityDecimals) => {
    const locale = settings.language === 'es' ? 'es-ES' : 'en-US'
    return qty.toLocaleString(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    })
  }

  const formatSignedCurrency = (amount: number) => {
    if (!amount) return '-'
    const formatted = formatCurrency(Math.abs(amount))
    return amount > 0 ? `+${formatted}` : `-${formatted}`
  }

  const formatSignedQuantity = (qty: number) => {
    if (!qty) return '-'
    const formatted = formatQuantity(Math.abs(qty))
    return qty > 0 ? `+${formatted}` : `-${formatted}`
  }

  const formatMovementDate = (date: string) => {
    const locale = settings.language === 'es' ? 'es-ES' : 'en-US'
    return new Date(date).toLocaleDateString(locale)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '200px' }}>
        <div className="animate-spin" style={{ 
          width: '40px', 
          height: '40px', 
          border: '3px solid var(--gray-200)', 
          borderTopColor: 'var(--primary)', 
          borderRadius: '50%' 
        }}></div>
      </div>
    )
  }

  if (!investment) {
    return (
      <div className="card text-center" style={{ padding: '3rem' }}>
        <p className="text-gray-500">Inversión no encontrada</p>
        <button className="btn btn-primary mt-4" onClick={() => navigate('/app/investments')}>
          Volver a Inversiones
        </button>
      </div>
    )
  }

  const curPr = investment.current_price ?? 0
  const buyPr = investment.buy_price ?? investment.avg_buy_price ?? 0
  const totalValue = (investment.quantity ?? 0) * curPr
  const profitLoss = (curPr - buyPr) * (investment.quantity ?? 0)
  const profitPct = buyPr > 0
    ? ((curPr - buyPr) / buyPr) * 100
    : 0

  // Simple chart visualization
  const maxPrice = Math.max(...history.map(h => h.price), curPr)
  const minPrice = Math.min(...history.map(h => h.price), curPr)
  const priceRange = maxPrice - minPrice || 1

  return (
    <div>
      {/* Back */}
      <button onClick={() => navigate('/app/investments')} style={styles.backBtn}>
        <ArrowLeft size={20} />
        Volver
      </button>

      {/* Main Info */}
      <div className="card mb-6">
        <div style={styles.cardHeader}>
          <div>
            <h2 style={styles.invName}>{investment.name}</h2>
            <span className="badge badge-gray">{getTypeName(investment.type ?? investment.asset_type)}</span>
          </div>
          <button className="btn btn-primary" onClick={() => setShowPriceForm(!showPriceForm)}>
            <RefreshCw size={18} />
            Actualizar precio
          </button>
        </div>

        {/* Summary Grid */}
        <div style={styles.detailsGrid}>
          <div style={styles.detailItem}>
            <span style={styles.detailLabel}>Cantidad</span>
            <span style={styles.detailValue}>{investment.quantity}</span>
          </div>
          <div style={styles.detailItem}>
            <span style={styles.detailLabel}>Precio Compra</span>
            <span style={styles.detailValue}>{formatCurrency(buyPr)}</span>
          </div>
          <div style={styles.detailItem}>
            <span style={styles.detailLabel}>Precio Actual</span>
            <span style={{ ...styles.detailValue, color: 'var(--primary)' }}>
              {formatCurrency(curPr)}
            </span>
          </div>
          <div style={styles.detailItem}>
            <span style={styles.detailLabel}>Valor Total</span>
            <span style={{ ...styles.detailValue, fontSize: '1.25rem' }}>
              {formatCurrency(totalValue)}
            </span>
          </div>
          <div style={styles.detailItem}>
            <span style={styles.detailLabel}>Beneficio / Pérdida</span>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              color: profitLoss >= 0 ? 'var(--success)' : 'var(--danger)'
            }}>
              {profitLoss >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
              <span style={{ fontWeight: 700, fontSize: '1.25rem' }}>
                {profitLoss >= 0 ? '+' : ''}{formatCurrency(profitLoss)}
              </span>
              <span>({profitPct >= 0 ? '+' : ''}{profitPct.toFixed(2)}%)</span>
            </div>
          </div>
        </div>

        {investment.notes && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--gray-50)', borderRadius: 'var(--border-radius)' }}>
            <strong>Notas:</strong> {investment.notes}
          </div>
        )}

        {/* Update Price Form */}
        {showPriceForm && (
          <form onSubmit={handleUpdatePrice} style={styles.priceForm}>
            <h4 style={{ marginBottom: '1rem', fontWeight: 600 }}>Actualizar Precio</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <UiNumber
                  label="Nuevo Precio (€)"
                  value={newPrice}
                  onChange={(val: string) => setNewPrice(val)}
                  step="0.01"
                  min={0}
                  required
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="label">Fecha</label>
                <UiDatePicker
                  value={priceDate}
                  onChange={(d) => setPriceDate(d ? formatISODateString(d) : '')}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Price Chart (Simple) */}
      <div className="card mb-6">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h3 style={styles.sectionTitle}>Evolución del Precio</h3>
          {history.length > 0 && (
            <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 8, background: 'rgba(107,114,128,0.08)', border: '1px solid var(--border)' }}>
              <button
                type="button"
                onClick={() => setChartType('bars')}
                style={{ padding: '4px 10px', fontSize: '0.78rem', fontWeight: 600, border: 'none', cursor: 'pointer', borderRadius: 6, background: chartType === 'bars' ? 'var(--primary)' : 'transparent', color: chartType === 'bars' ? '#fff' : 'var(--text-muted)' }}
              >Barras</button>
              <button
                type="button"
                onClick={() => setChartType('line')}
                style={{ padding: '4px 10px', fontSize: '0.78rem', fontWeight: 600, border: 'none', cursor: 'pointer', borderRadius: 6, background: chartType === 'line' ? 'var(--primary)' : 'transparent', color: chartType === 'line' ? '#fff' : 'var(--text-muted)' }}
              >Líneas</button>
            </div>
          )}
        </div>

        {history.length === 0 ? (
          <p className="text-gray-500 text-center" style={{ padding: '2rem' }}>
            No hay histórico de precios
          </p>
        ) : chartType === 'bars' ? (
          <div style={styles.chartContainer}>
            <div style={styles.chart}>
              {[...history]
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .map((entry, i, arr) => {
                  const height = ((entry.price - minPrice) / priceRange) * 100
                  return (
                    <div key={entry.id} style={styles.chartBar}>
                      <div
                        style={{
                          ...styles.bar,
                          height: `${Math.max(5, height)}%`,
                          background: i === arr.length - 1 ? 'var(--primary)' : 'var(--gray-300)'
                        }}
                        title={`${formatDate(entry.date)}: ${formatCurrency(entry.price)}`}
                      />
                      <span style={styles.chartLabel}>
                        {new Date(entry.date).toLocaleDateString(settings.language === 'es' ? 'es-ES' : 'en-US', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                  )
                })}
            </div>
            <div style={styles.chartAxis}>
              <span>{formatCurrency(maxPrice)}</span>
              <span>{formatCurrency(minPrice)}</span>
            </div>
          </div>
        ) : (
          (() => {
            const sorted = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            const W = 800, H = 200, padX = 24, padY = 12
            const innerW = W - padX * 2, innerH = H - padY * 2
            const n = sorted.length
            const xFor = (i: number) => n === 1 ? padX + innerW / 2 : padX + (i / (n - 1)) * innerW
            const yFor = (p: number) => priceRange === 0 ? padY + innerH / 2 : padY + innerH - ((p - minPrice) / priceRange) * innerH
            const points = sorted.map((e, i) => `${xFor(i)},${yFor(e.price)}`).join(' ')
            const areaPath = `M ${xFor(0)},${padY + innerH} L ${sorted.map((e, i) => `${xFor(i)},${yFor(e.price)}`).join(' L ')} L ${xFor(n - 1)},${padY + innerH} Z`
            return (
              <div style={styles.chartContainer}>
                <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ flex: 1, width: '100%', height: '200px' }}>
                  <path d={areaPath} fill="var(--primary)" fillOpacity={0.12} />
                  <polyline points={points} fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                  {sorted.map((e, i) => (
                    <circle key={e.id} cx={xFor(i)} cy={yFor(e.price)} r={i === n - 1 ? 4 : 2.5} fill={i === n - 1 ? 'var(--primary)' : 'var(--gray-400)'}>
                      <title>{`${formatDate(e.date)}: ${formatCurrency(e.price)}`}</title>
                    </circle>
                  ))}
                </svg>
                <div style={styles.chartAxis}>
                  <span>{formatCurrency(maxPrice)}</span>
                  <span>{formatCurrency(minPrice)}</span>
                </div>
              </div>
            )
          })()
        )}
      </div>

      {/* Price History Table */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={styles.sectionTitle}>Histórico de Precios</h3>
          <button className="btn btn-secondary" onClick={() => setShowPriceForm(true)}>
            <Plus size={18} />
            Añadir entrada
          </button>
        </div>

        {history.length === 0 ? (
          <p className="text-gray-500 text-center" style={{ padding: '1rem' }}>
            No hay entradas en el histórico
          </p>
        ) : (
          <table className="table responsive-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th style={{ textAlign: 'right' }}>Precio</th>
                <th style={{ textAlign: 'right' }}>Valor Total</th>
              </tr>
            </thead>
            <tbody>
              {[...history].reverse().map((entry) => (
                <tr key={entry.id}>
                  <td data-label="Fecha">{formatDate(entry.date)}</td>
                  <td data-label="Precio" style={{ textAlign: 'right', fontWeight: 500 }}>
                    {formatCurrency(entry.price)}
                  </td>
                  <td data-label="Valor total" style={{ textAlign: 'right' }}>
                    {formatCurrency((investment.quantity ?? 0) * entry.price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Movements */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={styles.sectionTitle}>Movimientos</h3>
          {movementsTotal > 0 && (
            <span style={{ fontSize: '0.875rem', color: 'var(--gray-500)' }}>
              {movementsTotal} {movementsTotal === 1 ? 'movimiento' : 'movimientos'}
            </span>
          )}
        </div>

        {movementsQuery.isLoading ? (
          <div className="flex items-center justify-center" style={{ padding: '2rem' }}>
            <div className="animate-spin" style={{
              width: '28px',
              height: '28px',
              border: '3px solid var(--gray-200)',
              borderTopColor: 'var(--primary)',
              borderRadius: '50%',
            }}></div>
          </div>
        ) : movementsQuery.isError ? (
          <p className="text-gray-500 text-center" style={{ padding: '1rem' }}>
            Error al cargar los movimientos
          </p>
        ) : movements.length === 0 ? (
          <div
            className="text-gray-500 text-center"
            style={{
              padding: '2rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Inbox size={32} style={{ opacity: 0.5 }} />
            <span>Sin movimientos registrados</span>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="table responsive-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th style={{ textAlign: 'right' }}>Cantidad</th>
                    <th style={{ textAlign: 'right' }}>Precio</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th style={{ textAlign: 'right' }}>Δ Margen</th>
                    <th style={{ textAlign: 'right' }}>Δ Spot</th>
                    <th style={{ textAlign: 'right' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((mov) => (
                    <tr key={mov.id}>
                      <td data-label="Fecha">{formatMovementDate(mov.date)}</td>
                      <td data-label="Tipo">
                        <span className={`badge ${mov.type === 'buy' ? 'badge-success' : 'badge-danger'}`}>
                          {mov.type === 'buy' ? 'Compra' : 'Venta'}
                        </span>
                      </td>
                      <td data-label="Cantidad" style={{ textAlign: 'right' }}>{formatQuantity(Number(mov.quantity))}</td>
                      <td data-label="Precio" style={{ textAlign: 'right' }}>{formatCurrency(Number(mov.price))}</td>
                      <td data-label="Total" style={{ textAlign: 'right', fontWeight: 500 }}>{formatCurrency(Number(mov.total_amount))}</td>
                      <td
                        data-label="Δ Margen"
                        style={{
                          textAlign: 'right',
                          color: Number(mov.margin_delta) > 0
                            ? 'var(--success)'
                            : Number(mov.margin_delta) < 0
                              ? 'var(--danger)'
                              : 'var(--gray-500)',
                        }}
                      >
                        {formatSignedCurrency(Number(mov.margin_delta))}
                      </td>
                      <td
                        data-label="Δ Spot"
                        style={{
                          textAlign: 'right',
                          color: Number(mov.spot_quantity_delta) > 0
                            ? 'var(--success)'
                            : Number(mov.spot_quantity_delta) < 0
                              ? 'var(--danger)'
                              : 'var(--gray-500)',
                        }}
                      >
                        {formatSignedQuantity(Number(mov.spot_quantity_delta))}
                      </td>
                      <td data-label="" style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-icon btn-danger"
                          onClick={() => handleDeleteMovement(mov)}
                          disabled={deletingMovementId === mov.id}
                          title="Eliminar movimiento"
                          style={{ width: 30, height: 30 }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {(hasMoreMovements || movementsPage > 1) && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setMovementsPage((p) => Math.max(1, p - 1))}
                  disabled={movementsPage === 1 || movementsQuery.isFetching}
                >
                  Anterior
                </button>
                <span style={{ fontSize: '0.875rem', color: 'var(--gray-600)' }}>
                  Página {movementsPage}
                </span>
                <button
                  className="btn btn-secondary"
                  onClick={() => setMovementsPage((p) => p + 1)}
                  disabled={!hasMoreMovements || movementsQuery.isFetching}
                >
                  {movementsQuery.isFetching ? 'Cargando...' : 'Ver más'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

const styles: { [key: string]: React.CSSProperties } = {
  backBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    background: 'transparent',
    border: 'none',
    color: 'var(--gray-600)',
    cursor: 'pointer',
    padding: '0.5rem 0',
    fontSize: '0.875rem',
    marginBottom: '1rem',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '1.5rem',
  },
  invName: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: 'var(--gray-800)',
    marginBottom: '0.5rem',
  },
  detailsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '1.5rem',
    padding: '1rem 0',
    borderTop: '1px solid var(--gray-200)',
  },
  detailItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  detailLabel: {
    fontSize: '0.75rem',
    color: 'var(--gray-500)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  detailValue: {
    fontSize: '1rem',
    fontWeight: 600,
    color: 'var(--gray-800)',
  },
  priceForm: {
    marginTop: '1.5rem',
    padding: '1rem',
    background: 'var(--gray-50)',
    borderRadius: 'var(--border-radius)',
  },
  sectionTitle: {
    fontSize: '1.125rem',
    fontWeight: 600,
    color: 'var(--gray-800)',
    marginBottom: '1rem',
  },
  chartContainer: {
    display: 'flex',
    gap: '1rem',
    height: '200px',
  },
  chart: {
    flex: 1,
    display: 'flex',
    alignItems: 'flex-end',
    gap: '4px',
    padding: '1rem 0',
  },
  chartBar: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    maxWidth: '30px',
    borderRadius: '4px 4px 0 0',
    transition: 'height 0.3s ease',
  },
  chartLabel: {
    fontSize: '0.625rem',
    color: 'var(--gray-500)',
    marginTop: '0.5rem',
    whiteSpace: 'nowrap',
  },
  chartAxis: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    fontSize: '0.75rem',
    color: 'var(--gray-500)',
    paddingTop: '1rem',
    paddingBottom: '1.5rem',
  },
}
