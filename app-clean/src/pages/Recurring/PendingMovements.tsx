import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { 
  getPendingMovements, 
  acceptPendingMovement, 
  discardPendingMovement 
} from '../../services/recurringService'
import { Check, X, ArrowLeft, Clock } from 'lucide-react'

interface PendingMovement {
  id: string
  type: string
  amount: number
  date: string
  description: string | null
  category: string | null
  account?: { id: string; name: string }
}

export default function PendingMovements() {
  const navigate = useNavigate()
  const [movements, setMovements] = useState<PendingMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      const data = await getPendingMovements(user.id)
      setMovements(data)
    } catch (error) {
      console.error('Error loading pending:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async (id: string) => {
    setProcessing(id)
    try {
      await acceptPendingMovement(id)
      setMovements(prev => prev.filter(m => m.id !== id))
    } catch (error) {
      console.error('Error accepting:', error)
    } finally {
      setProcessing(null)
    }
  }

  const handleDiscard = async (id: string) => {
    if (!confirm('¿Descartar este movimiento pendiente?')) return
    setProcessing(id)
    try {
      await discardPendingMovement(id)
      setMovements(prev => prev.filter(m => m.id !== id))
    } catch (error) {
      console.error('Error discarding:', error)
    } finally {
      setProcessing(null)
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount)
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

  return (
    <div>
      {/* Header */}
      <div style={styles.header}>
        <button onClick={() => navigate('/app/dashboard')} style={styles.backBtn}>
          <ArrowLeft size={20} />
          Volver
        </button>
      </div>

      <div style={styles.titleRow}>
        <div>
          <h1 style={styles.title}>Movimientos Pendientes</h1>
          <p style={styles.subtitle}>Acepta o descarta los movimientos generados por reglas recurrentes</p>
        </div>
        <span className="badge badge-warning" style={{ fontSize: '1rem', padding: '0.5rem 1rem' }}>
          {movements.length} pendiente{movements.length !== 1 ? 's' : ''}
        </span>
      </div>

      {movements.length === 0 ? (
        <div className="card text-center" style={{ padding: '3rem' }}>
          <Clock size={48} style={{ color: 'var(--gray-300)', marginBottom: '1rem' }} />
          <p className="text-gray-500">No hay movimientos pendientes</p>
          <button className="btn btn-secondary mt-4" onClick={() => navigate('/app/dashboard')}>
            Volver al Dashboard
          </button>
        </div>
      ) : (
        <div style={styles.movementsList}>
          {movements.map(mov => (
            <div key={mov.id} className="card" style={styles.movementCard}>
              <div style={styles.movementInfo}>
                <div style={styles.movementHeader}>
                  <span className={`badge ${mov.type === 'income' ? 'badge-success' : 'badge-danger'}`}>
                    {mov.type === 'income' ? 'Ingreso' : 'Gasto'}
                  </span>
                  <span className="text-gray-500">{formatDate(mov.date)}</span>
                </div>
                <div style={styles.movementAmount}>
                  <span style={{ 
                    color: mov.type === 'income' ? 'var(--success)' : 'var(--danger)',
                    fontWeight: 700,
                    fontSize: '1.25rem'
                  }}>
                    {mov.type === 'income' ? '+' : '-'}{formatCurrency(mov.amount)}
                  </span>
                </div>
                <div className="text-gray-600">{mov.description || 'Sin descripción'}</div>
                <div className="text-sm text-gray-500">
                  Cuenta: {mov.account?.name || '-'} 
                  {mov.category && ` • ${mov.category}`}
                </div>
              </div>
              <div style={styles.movementActions}>
                <button
                  className="btn btn-success"
                  onClick={() => handleAccept(mov.id)}
                  disabled={processing === mov.id}
                  title="Aceptar"
                >
                  <Check size={20} />
                  Aceptar
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => handleDiscard(mov.id)}
                  disabled={processing === mov.id}
                  title="Descartar"
                >
                  <X size={20} />
                  Descartar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const styles: { [key: string]: React.CSSProperties } = {
  header: {
    marginBottom: '1rem',
  },
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
  },
  titleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '1.5rem',
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: 700,
    color: 'var(--gray-800)',
    marginBottom: '0.25rem',
  },
  subtitle: {
    color: 'var(--gray-500)',
    fontSize: '0.875rem',
  },
  movementsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  movementCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
    padding: '1.25rem',
  },
  movementInfo: {
    flex: 1,
  },
  movementHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '0.5rem',
  },
  movementAmount: {
    marginBottom: '0.25rem',
  },
  movementActions: {
    display: 'flex',
    gap: '0.5rem',
  },
}
