import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  fetchDebtById, 
  fetchDebtMovements, 
  addDebtMovement, 
  updateDebt,
  type Debt, 
  type DebtMovement 
} from '../../services/debtService'
import { useSettings } from '../../context/SettingsContext'
import { formatDate as formatDateUtil, formatEUR } from '../../utils/format'
import { Breadcrumbs } from '../../components/Breadcrumbs'
import { SkeletonList } from '../../components/Skeleton'
import { Plus, DollarSign, TrendingUp, Edit2, Check, X, Wallet } from 'lucide-react'
import { UiDatePicker } from '../../components/ui/UiDatePicker'
import { formatISODateString } from '../../utils/date'
import { UiSelect } from '../../components/ui/UiSelect'
import { UiField } from '../../components/ui/UiField'
import { UiCard } from '../../components/ui/UiCard'
import { UiInput } from '../../components/ui/UiInput'
import { UiNumber } from '../../components/ui/UiNumber'
import { UiTextarea } from '../../components/ui/UiTextarea'

export default function DebtDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { settings } = useSettings()
  const [debt, setDebt] = useState<Debt | null>(null)
  const [movements, setMovements] = useState<DebtMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [showMovementForm, setShowMovementForm] = useState(false)
  const [editing, setEditing] = useState(false)

  // Movement form state
  const [movementType, setMovementType] = useState<string>('payment')
  const [movementAmount, setMovementAmount] = useState('')
  const [movementDate, setMovementDate] = useState(new Date().toISOString().split('T')[0])
  const [movementNote, setMovementNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Edit form state
  const [editDescription, setEditDescription] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [editCounterparty, setEditCounterparty] = useState('')

  useEffect(() => {
    if (id) loadData()
  }, [id])

  const loadData = async () => {
    if (!id) return
    try {
      const [debtData, movementsData] = await Promise.all([
        fetchDebtById(id),
        fetchDebtMovements(id)
      ])
      setDebt(debtData)
      setMovements(movementsData)
      if (debtData) {
        setEditDescription(debtData.description || '')
        setEditDueDate(debtData.due_date || '')
        setEditCounterparty(debtData.counterparty_name)
      }
    } catch (error) {
      console.error('Error loading debt:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddMovement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !debt) return
    setSubmitting(true)

    try {
      await addDebtMovement({
        debt_id: id,
        type: movementType as 'payment' | 'increase',
        amount: parseFloat(movementAmount),
        date: movementDate,
        note: movementNote || null
      })
      setShowMovementForm(false)
      setMovementAmount('')
      setMovementNote('')
      loadData()
    } catch (error) {
      console.error('Error adding movement:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!id) return
    try {
      await updateDebt(id, {
        counterparty_name: editCounterparty,
        description: editDescription || null,
        due_date: editDueDate || null
      })
      setEditing(false)
      loadData()
    } catch (error) {
      console.error('Error updating debt:', error)
    }
  }

  const formatDate = (date: string) => {
    return formatDateUtil(date, settings)
  }

  const formatCurrency = (amount: number) => {
    return formatEUR(amount, settings)
  }

  const progress = debt ? ((debt.total_amount - debt.remaining_amount) / debt.total_amount) * 100 : 0

  if (loading) {
    return <SkeletonList rows={4} />
  }

  if (!debt) {
    return (
      <UiCard className="p-12 text-center">
        <p className="text-secondary mb-4">Deuda no encontrada</p>
        <button className="btn btn-primary" onClick={() => navigate('/app/debts')}>
          Volver a Deudas
        </button>
      </UiCard>
    )
  }

  return (
    <div className="page-container">
      {/* Breadcrumbs */}
      <Breadcrumbs items={[
        { label: settings.language === 'es' ? 'Deudas' : 'Debts', path: '/app/debts', icon: <Wallet size={16} /> },
        { label: debt.counterparty_name }
      ]} />

      {/* Main Info Card */}
      <UiCard className="mb-6 p-6">
        <div className="d-flex justify-between items-start mb-6">
          <div className="flex-1">
            {editing ? (
              <div style={{ marginBottom: '0.5rem' }}>
               <UiInput
                value={editCounterparty}
                onChange={(e) => setEditCounterparty(e.target.value)}
                className="text-xl font-bold"
               />
              </div>
            ) : (
              <h2 className="text-2xl font-bold text-gray-800 mb-2">{debt.counterparty_name}</h2>
            )}
            <span className={`badge ${debt.direction === 'i_owe' ? 'badge-danger' : 'badge-success'}`}>
              {debt.direction === 'i_owe' ? 'Yo debo' : 'Me deben'}
            </span>
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

        {/* Progress bar */}
        <div className="mb-6">
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div 
                    className="h-full rounded-full transition-all duration-300"
                    style={{ 
                        width: `${progress}%`,
                        backgroundColor: debt.is_closed ? 'var(--success)' : 'var(--primary)'
                    }} 
                />
            </div>
            <div className="d-flex justify-between text-xs text-secondary mt-2">
                <span>Pagado: {formatCurrency(debt.total_amount - debt.remaining_amount)}</span>
                <span>Pendiente: {formatCurrency(debt.remaining_amount)}</span>
            </div>
        </div>

        {/* Details Grid */}
        <div className="d-grid gap-4 py-4 border-t border-b border-gray-100 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          <div>
            <div className="text-xs uppercase tracking-wider text-secondary mb-1">Importe Total</div>
            <div className="text-lg font-bold text-gray-800">{formatCurrency(debt.total_amount)}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-secondary mb-1">Restante</div>
            <div className={`text-lg font-bold ${debt.is_closed ? 'text-success' : 'text-danger'}`}>
                {formatCurrency(debt.remaining_amount)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-secondary mb-1">Fecha Límite</div>
            {editing ? (
              <div className="mt-1">
                <UiDatePicker
                  value={editDueDate}
                  onChange={(d) => setEditDueDate(d ? formatISODateString(d) : '')}
                />
              </div>
            ) : (
              <div className="text-lg font-bold text-gray-800">
                {debt.due_date ? formatDate(debt.due_date) : '-'}
              </div>
            )}
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-secondary mb-1">Estado</div>
            <span className={`badge ${debt.is_closed ? 'badge-success' : 'badge-warning'}`}>
              {debt.is_closed ? 'Cerrada' : 'Pendiente'}
            </span>
          </div>
        </div>

        {/* Description */}
        <div>
          <div className="text-xs uppercase tracking-wider text-secondary mb-1">Descripción</div>
          {editing ? (
            <div className="mt-1">
                <UiTextarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={2}
                  placeholder="Añadir descripción..."
                />
            </div>
          ) : (
            <p className="text-gray-600">
              {debt.description || 'Sin descripción'}
            </p>
          )}
        </div>
      </UiCard>

      {/* Movements Section */}
      <UiCard className="p-6">
        <div className="d-flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-800">Historial de Movimientos</h3>
          {!debt.is_closed && (
            <button className="btn btn-primary" onClick={() => setShowMovementForm(true)}>
              <Plus size={18} />
              Añadir
            </button>
          )}
        </div>

        {/* Movement Form */}
        {showMovementForm && (
          <form onSubmit={handleAddMovement} className="p-4 bg-gray-50 rounded-lg mb-4 border border-gray-100">
            <div className="d-grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="form-group">
                <UiField label="Tipo">
                    <UiSelect
                        value={movementType}
                        onChange={setMovementType}
                        options={[
                            { value: 'payment', label: 'Pago' },
                            { value: 'increase', label: 'Aumentar Deuda' }
                        ]}
                    />
                </UiField>
                </div>
                <div className="form-group">
                <UiNumber
                    label="Importe (€)"
                    value={movementAmount}
                    onChange={(val: string) => setMovementAmount(val)}
                    step="0.01"
                    min={0}
                    required
                />
                </div>
            </div>
            
            <div className="d-grid gap-4 mb-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="form-group">
                    <UiField label="Fecha">
                        <UiDatePicker
                            value={movementDate}
                            onChange={(d) => setMovementDate(d ? formatISODateString(d) : '')}
                            required
                        />
                    </UiField>
                </div>
                <div className="form-group">
                    <UiInput
                        label="Nota (opcional)"
                        value={movementNote}
                        onChange={(e) => setMovementNote(e.target.value)}
                        placeholder="Añade una nota..."
                    />
                </div>
            </div>
            
            <div className="d-flex gap-2">
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Guardando...' : 'Guardar'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowMovementForm(false)}>
                Cancelar
              </button>
            </div>
          </form>
        )}

        {/* Movements List */}
        {movements.length === 0 ? (
          <p className="text-secondary text-center py-8">
            No hay movimientos registrados
          </p>
        ) : (
          <div className="table-container">
            <table className="table w-full">
                <thead>
                <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Importe</th>
                    <th>Nota</th>
                </tr>
                </thead>
                <tbody>
                {movements.map((mov) => (
                    <tr key={mov.id}>
                    <td>{formatDate(mov.date)}</td>
                    <td>
                        <span className="d-flex items-center gap-2">
                        {mov.type === 'payment' ? (
                            <>
                            <DollarSign size={16} className="text-success" />
                            Pago
                            </>
                        ) : (
                            <>
                            <TrendingUp size={16} className="text-warning" />
                            Aumento
                            </>
                        )}
                        </span>
                    </td>
                    <td className={`font-bold ${mov.type === 'payment' ? 'text-success' : 'text-warning'}`}>
                        {mov.type === 'payment' ? '-' : '+'}{formatCurrency(mov.amount)}
                    </td>
                    <td className="text-secondary">{mov.note || '-'}</td>
                    </tr>
                ))}
                </tbody>
            </table>
          </div>
        )}
      </UiCard>
    </div>
  )
}
