import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { 
  getGoalById, 
  getContributionsByGoal,
  addContribution,
  updateGoal,
  markGoalCompleted,
  type SavingsGoal,
  type SavingsContribution
} from '../../services/savingsService'
import { ArrowLeft, Plus, Edit2, Check, X, CheckCircle2 } from 'lucide-react'
import { UiDatePicker } from '../../components/ui/UiDatePicker'
import { formatISODateString } from '../../utils/date'
import { UiInput } from '../../components/ui/UiInput'
import { UiNumber } from '../../components/ui/UiNumber'
import { UiTextarea } from '../../components/ui/UiTextarea'

export default function SavingsDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [goal, setGoal] = useState<SavingsGoal | null>(null)
  const [contributions, setContributions] = useState<SavingsContribution[]>([])
  const [loading, setLoading] = useState(true)
  const [showContribForm, setShowContribForm] = useState(false)
  const [editing, setEditing] = useState(false)

  // Contribution form
  const [contribAmount, setContribAmount] = useState('')
  const [contribDate, setContribDate] = useState(new Date().toISOString().split('T')[0])
  const [contribNote, setContribNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Edit form
  const [editName, setEditName] = useState('')
  const [editTarget, setEditTarget] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [editDescription, setEditDescription] = useState('')

  useEffect(() => {
    if (id) loadData()
  }, [id])

  const loadData = async () => {
    if (!id) return
    try {
      const [goalData, contribsData] = await Promise.all([
        getGoalById(id),
        getContributionsByGoal(id)
      ])
      setGoal(goalData)
      setContributions(contribsData)
      if (goalData) {
        setEditName(goalData.name)
        setEditTarget(goalData.target_amount.toString())
        setEditDueDate(goalData.due_date || '')
        setEditDescription(goalData.description || '')
      }
    } catch (error) {
      console.error('Error loading goal:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddContribution = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !goal) return
    setSubmitting(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      await addContribution({
        goal_id: id,
        user_id: user.id,
        amount: parseFloat(contribAmount),
        date: contribDate,
        note: contribNote || null
      })
      setShowContribForm(false)
      setContribAmount('')
      setContribNote('')
      loadData()
    } catch (error) {
      console.error('Error adding contribution:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!id) return
    try {
      await updateGoal(id, {
        name: editName,
        target_amount: parseFloat(editTarget),
        due_date: editDueDate || null,
        description: editDescription || null
      })
      setEditing(false)
      loadData()
    } catch (error) {
      console.error('Error updating goal:', error)
    }
  }

  const handleMarkCompleted = async () => {
    if (!id) return
    try {
      await markGoalCompleted(id)
      loadData()
    } catch (error) {
      console.error('Error marking goal as completed:', error)
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

  const getProgress = () => {
    if (!goal) return 0
    return Math.min(100, (goal.current_amount / goal.target_amount) * 100)
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

  if (!goal) {
    return (
      <div className="card text-center" style={{ padding: '3rem' }}>
        <p className="text-gray-500">Objetivo no encontrado</p>
        <button className="btn btn-primary mt-4" onClick={() => navigate('/app/savings')}>
          Volver a Ahorro
        </button>
      </div>
    )
  }

  const remaining = goal.target_amount - goal.current_amount

  return (
    <div>
      {/* Header */}
      <div style={styles.header}>
        <button onClick={() => navigate('/app/savings')} style={styles.backBtn}>
          <ArrowLeft size={20} />
          Volver
        </button>
      </div>

      {/* Main Info Card */}
      <div className="card mb-6">
        <div style={styles.cardHeader}>
          <div style={{ flex: 1 }}>
            {editing ? (
              <div style={{ marginBottom: '0.5rem' }}>
                  <UiInput
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="text-xl font-bold"
                  />
              </div>
            ) : (
              <h2 style={styles.goalName}>{goal.name}</h2>
            )}
            {goal.is_completed ? (
              <span className="badge badge-success">Completado</span>
            ) : (
              <span className="badge badge-warning">En progreso</span>
            )}
          </div>
          {!editing ? (
            <button className="btn btn-secondary" onClick={() => setEditing(true)}>
              <Edit2 size={16} />
              Editar
            </button>
          ) : (
            <div className="flex gap-2">
              <button className="btn btn-success" onClick={handleSaveEdit}>
                <Check size={16} />
              </button>
              <button className="btn btn-secondary" onClick={() => setEditing(false)}>
                <X size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Progress */}
        <div style={styles.progressSection}>
          <div style={styles.progressBar}>
            <div 
              style={{ 
                ...styles.progressFill, 
                width: `${getProgress()}%`,
                background: goal.is_completed ? 'var(--success)' : 'var(--primary)'
              }} 
            />
          </div>
          <div style={styles.progressLabels}>
            <span>Ahorrado: {formatCurrency(goal.current_amount)}</span>
            <span>{getProgress().toFixed(0)}%</span>
            <span>Objetivo: {formatCurrency(goal.target_amount)}</span>
          </div>
        </div>

        {/* Details Grid */}
        <div style={styles.detailsGrid}>
          <div style={styles.detailItem}>
            <span style={styles.detailLabel}>Cantidad Objetivo</span>
            {editing ? (
              <UiNumber
                value={editTarget}
                onChange={(val: string) => setEditTarget(val)}
                step="0.01"
              />
            ) : (
              <span style={styles.detailValue}>{formatCurrency(goal.target_amount)}</span>
            )}
          </div>
          <div style={styles.detailItem}>
            <span style={styles.detailLabel}>Ahorrado</span>
            <span style={{ ...styles.detailValue, color: 'var(--primary)' }}>
              {formatCurrency(goal.current_amount)}
            </span>
          </div>
          <div style={styles.detailItem}>
            <span style={styles.detailLabel}>Falta</span>
            <span style={{ ...styles.detailValue, color: remaining > 0 ? 'var(--warning)' : 'var(--success)' }}>
              {formatCurrency(Math.max(0, remaining))}
            </span>
          </div>
          <div style={styles.detailItem}>
            <span style={styles.detailLabel}>Fecha Objetivo</span>
            {editing ? (
              <div style={{ marginTop: '0.5rem' }}>
                <UiDatePicker
                  value={editDueDate}
                  onChange={(d) => setEditDueDate(d ? formatISODateString(d) : '')}
                />
              </div>
            ) : (
              <span style={styles.detailValue}>
                {goal.due_date ? formatDate(goal.due_date) : '-'}
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        <div style={{ marginTop: '1rem' }}>
          <span style={styles.detailLabel}>Descripción</span>
          {editing ? (
            <div style={{ marginTop: '0.5rem' }}>
                <UiTextarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={2}
                />
            </div>
          ) : (
            <p style={{ color: 'var(--gray-600)', marginTop: '0.25rem' }}>
              {goal.description || 'Sin descripción'}
            </p>
          )}
        </div>

        {/* Actions */}
        {!goal.is_completed && (
          <div style={styles.actionsRow}>
            <button className="btn btn-primary" onClick={() => setShowContribForm(!showContribForm)}>
              <Plus size={18} />
              Añadir Aportación
            </button>
            <button className="btn btn-success" onClick={handleMarkCompleted}>
              <CheckCircle2 size={18} />
              Marcar como completado
            </button>
          </div>
        )}

        {/* Add Contribution Form */}
        {showContribForm && (
          <form onSubmit={handleAddContribution} style={styles.contribForm}>
            <h4 style={{ marginBottom: '1rem', fontWeight: 600 }}>Nueva Aportación</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <UiNumber
                    label="Cantidad (€)"
                    value={contribAmount}
                    onChange={(val: string) => setContribAmount(val)}
                    step="0.01"
                    min={0.01}
                    required
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="label">Fecha</label>
                <UiDatePicker
                  value={contribDate}
                  onChange={(d) => setContribDate(d ? formatISODateString(d) : '')}
                  required
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <UiInput
                    label="Nota (opcional)"
                    value={contribNote}
                    onChange={(e) => setContribNote(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Guardando...' : 'Guardar'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowContribForm(false)}>
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Contributions History */}
      <div className="card">
        <h3 style={styles.sectionTitle}>Historial de Aportaciones</h3>
        
        {contributions.length === 0 ? (
          <p className="text-gray-500 text-center" style={{ padding: '2rem' }}>
            No hay aportaciones registradas
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th style={{ textAlign: 'right' }}>Cantidad</th>
                <th>Nota</th>
              </tr>
            </thead>
            <tbody>
              {contributions.map((contrib) => (
                <tr key={contrib.id}>
                  <td>{formatDate(contrib.date)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--success)' }}>
                    +{formatCurrency(contrib.amount)}
                  </td>
                  <td className="text-gray-500">{contrib.note || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const styles: { [key: string]: React.CSSProperties } = {
  header: {
    marginBottom: '1.5rem',
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
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '1.5rem',
  },
  goalName: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: 'var(--gray-800)',
    marginBottom: '0.5rem',
  },
  progressSection: {
    marginBottom: '1.5rem',
  },
  progressBar: {
    width: '100%',
    height: '12px',
    background: 'var(--gray-200)',
    borderRadius: '9999px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: '9999px',
    transition: 'width 0.3s ease',
  },
  progressLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '0.5rem',
    fontSize: '0.875rem',
    color: 'var(--gray-500)',
  },
  detailsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '1rem',
    padding: '1rem 0',
    borderTop: '1px solid var(--gray-200)',
    borderBottom: '1px solid var(--gray-200)',
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
  actionsRow: {
    display: 'flex',
    gap: '0.75rem',
    marginTop: '1.5rem',
    flexWrap: 'wrap',
  },
  contribForm: {
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
}
