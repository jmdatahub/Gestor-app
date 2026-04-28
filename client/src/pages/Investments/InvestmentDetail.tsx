import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import {
  getInvestmentById,
  getPriceHistory,
  updatePrice,
  investmentTypes,
  type Investment,
  type PriceHistoryEntry
} from '../../services/investmentService'
import { ArrowLeft, TrendingUp, TrendingDown, Plus, RefreshCw } from 'lucide-react'
import { UiDatePicker } from '../../components/ui/UiDatePicker'
import { formatISODateString } from '../../utils/date'
import { UiNumber } from '../../components/ui/UiNumber'

export default function InvestmentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [investment, setInvestment] = useState<Investment | null>(null)
  const [history, setHistory] = useState<PriceHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  
  // Update price form
  const [showPriceForm, setShowPriceForm] = useState(false)
  const [newPrice, setNewPrice] = useState('')
  const [priceDate, setPriceDate] = useState(new Date().toISOString().split('T')[0])
  const [submitting, setSubmitting] = useState(false)

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

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      await updatePrice(id, user.id, parseFloat(newPrice), priceDate)
      setShowPriceForm(false)
      setNewPrice('')
      loadData()
    } catch (error) {
      console.error('Error updating price:', error)
    } finally {
      setSubmitting(false)
    }
  }



  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const getTypeName = (typeVal: string) => {
    return investmentTypes.find(t => t.value === typeVal)?.label || typeVal
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

  const totalValue = investment.quantity * investment.current_price
  const profitLoss = (investment.current_price - investment.buy_price) * investment.quantity
  const profitPct = investment.buy_price > 0 
    ? ((investment.current_price - investment.buy_price) / investment.buy_price) * 100 
    : 0

  // Simple chart visualization
  const maxPrice = Math.max(...history.map(h => h.price), investment.current_price)
  const minPrice = Math.min(...history.map(h => h.price), investment.current_price)
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
            <span className="badge badge-gray">{getTypeName(investment.type)}</span>
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
            <span style={styles.detailValue}>{formatCurrency(investment.buy_price)}</span>
          </div>
          <div style={styles.detailItem}>
            <span style={styles.detailLabel}>Precio Actual</span>
            <span style={{ ...styles.detailValue, color: 'var(--primary)' }}>
              {formatCurrency(investment.current_price)}
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
        <h3 style={styles.sectionTitle}>Evolución del Precio</h3>
        
        {history.length === 0 ? (
          <p className="text-gray-500 text-center" style={{ padding: '2rem' }}>
            No hay histórico de precios
          </p>
        ) : (
          <div style={styles.chartContainer}>
            <div style={styles.chart}>
              {history.map((entry, i) => {
                const height = ((entry.price - minPrice) / priceRange) * 100
                return (
                  <div key={entry.id} style={styles.chartBar}>
                    <div 
                      style={{ 
                        ...styles.bar, 
                        height: `${Math.max(5, height)}%`,
                        background: i === history.length - 1 ? 'var(--primary)' : 'var(--gray-300)'
                      }}
                      title={`${formatDate(entry.date)}: ${formatCurrency(entry.price)}`}
                    />
                    <span style={styles.chartLabel}>
                      {new Date(entry.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
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
          <table className="table">
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
                  <td>{formatDate(entry.date)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 500 }}>
                    {formatCurrency(entry.price)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {formatCurrency(investment.quantity * entry.price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* TODO: Integration with movements
        In the future, this is where we could:
        - Show movements linked to this investment (buy/sell operations)
        - Create automatic movements when buying more units
        - Track total capital invested from the savings account
      */}
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
