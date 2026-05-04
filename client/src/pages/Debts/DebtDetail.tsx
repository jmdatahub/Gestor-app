import { useState, useEffect, useMemo } from 'react'
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
import {
  Plus, TrendingUp, TrendingDown, Edit2, Check, X, Wallet,
  Calendar, AlertCircle, CheckCircle2, Clock, ArrowDownCircle, ArrowUpCircle,
} from 'lucide-react'
import { UiDatePicker } from '../../components/ui/UiDatePicker'
import { formatISODateString } from '../../utils/date'
import { UiSelect } from '../../components/ui/UiSelect'
import { UiField } from '../../components/ui/UiField'
import { UiCard } from '../../components/ui/UiCard'
import { UiInput } from '../../components/ui/UiInput'
import { UiNumber } from '../../components/ui/UiNumber'
import { UiTextarea } from '../../components/ui/UiTextarea'
import { EmptyState } from '../../components/shared/EmptyState'

const DEBTS_GRADIENT = 'linear-gradient(135deg, #EF4444 0%, #F97316 100%)'
const DEBTS_GRADIENT_SOFT = 'linear-gradient(90deg, #EF4444 0%, #F97316 50%, #FB923C 100%)'
const OWED_GRADIENT = 'linear-gradient(135deg, #10B981 0%, #22C55E 100%)'
const OWED_GRADIENT_SOFT = 'linear-gradient(90deg, #10B981 0%, #22C55E 50%, #4ADE80 100%)'

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
    if (!id) return
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const loadData = async () => {
    if (!id) return
    try {
      const [debtData, movementsData] = await Promise.all([
        fetchDebtById(id),
        fetchDebtMovements(id)
      ])
      setDebt(debtData ?? null)
      setMovements(Array.isArray(movementsData) ? movementsData : [])
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

  const formatDate = (date: string) => formatDateUtil(date, settings)
  const formatCurrency = (amount: number) => formatEUR(amount, settings)

  const lang = settings.language

  const totalAmt = Number(debt?.total_amount ?? 0) || 0
  const remainingAmt = Number(debt?.remaining_amount ?? 0) || 0
  const paidAmt = Math.max(0, totalAmt - remainingAmt)
  const progress = totalAmt > 0 ? Math.min(100, Math.max(0, (paidAmt / totalAmt) * 100)) : 0

  const overdue = useMemo(() => {
    if (!debt?.due_date || debt?.is_closed) return false
    return new Date(debt.due_date) < new Date()
  }, [debt])

  if (loading) {
    return (
      <div className="page-container">
        <SkeletonList rows={4} />
      </div>
    )
  }

  if (!debt) {
    return (
      <div className="page-container">
        <UiCard className="p-12">
          <EmptyState
            icon={<AlertCircle size={40} style={{ color: 'var(--text-muted)' }} />}
            title={lang === 'es' ? 'Deuda no encontrada' : 'Debt not found'}
            action={
              <button className="btn btn-primary" onClick={() => navigate('/app/debts')} style={{ marginTop: '1rem' }}>
                {lang === 'es' ? 'Volver a deudas' : 'Back to debts'}
              </button>
            }
          />
        </UiCard>
      </div>
    )
  }

  const iOwe = debt.direction === 'i_owe'
  const headerGradient = debt.is_closed
    ? 'linear-gradient(135deg, #94A3B8 0%, #CBD5E1 100%)'
    : iOwe ? DEBTS_GRADIENT : OWED_GRADIENT
  const lineGradient = debt.is_closed
    ? 'linear-gradient(90deg, #94A3B8 0%, #CBD5E1 100%)'
    : iOwe ? DEBTS_GRADIENT_SOFT : OWED_GRADIENT_SOFT
  const accentColor = debt.is_closed
    ? 'var(--text-muted)'
    : iOwe ? '#EF4444' : '#10B981'
  const progressGradient = iOwe ? DEBTS_GRADIENT : OWED_GRADIENT

  return (
    <div className="page-container">
      <Breadcrumbs items={[
        { label: lang === 'es' ? 'Deudas' : 'Debts', path: '/app/debts', icon: <Wallet size={16} /> },
        { label: debt.counterparty_name }
      ]} />

      {/* ── Hero card ─────────────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: '20px',
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
        marginBottom: '1.5rem',
      }}>
        {/* Decorative top gradient line */}
        <div style={{ height: '5px', background: lineGradient }} />

        <div style={{ padding: '1.75rem 1.75rem 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.25rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '18px',
              background: headerGradient,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: debt.is_closed ? 'none' :
                iOwe ? '0 8px 20px rgba(239, 68, 68, 0.30)' : '0 8px 20px rgba(16, 185, 129, 0.30)',
              flexShrink: 0,
            }}>
              {iOwe ? <TrendingDown size={30} color="white" /> : <TrendingUp size={30} color="white" />}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                {editing ? (
                  <UiInput
                    value={editCounterparty}
                    onChange={(e) => setEditCounterparty(e.target.value)}
                    style={{ fontSize: '1.4rem', fontWeight: 700 }}
                  />
                ) : (
                  <h2 style={{
                    fontSize: '1.65rem',
                    fontWeight: 800,
                    color: 'var(--text-primary)',
                    margin: 0,
                  }}>
                    {debt.counterparty_name}
                  </h2>
                )}
              </div>

              {/* Badges row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.25rem 0.625rem',
                  borderRadius: '14px',
                  background: iOwe ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                  color: iOwe ? '#DC2626' : '#059669',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  border: `1px solid ${iOwe ? 'rgba(239, 68, 68, 0.22)' : 'rgba(16, 185, 129, 0.22)'}`,
                }}>
                  {iOwe ? (lang === 'es' ? 'Yo debo' : 'I owe') : (lang === 'es' ? 'Me deben' : 'Owed to me')}
                </span>

                {debt.is_closed ? (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                    padding: '0.25rem 0.625rem', borderRadius: '14px',
                    background: 'rgba(34, 197, 94, 0.12)', color: '#15803D',
                    fontSize: '0.78rem', fontWeight: 600,
                    border: '1px solid rgba(34, 197, 94, 0.22)',
                  }}>
                    <CheckCircle2 size={13} />
                    {lang === 'es' ? 'Pagada' : 'Paid'}
                  </span>
                ) : overdue ? (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                    padding: '0.25rem 0.625rem', borderRadius: '14px',
                    background: 'rgba(239, 68, 68, 0.12)', color: '#B91C1C',
                    fontSize: '0.78rem', fontWeight: 700,
                    border: '1px solid rgba(239, 68, 68, 0.28)',
                  }}>
                    <AlertCircle size={13} />
                    {lang === 'es' ? 'Vencida' : 'Overdue'}
                  </span>
                ) : (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                    padding: '0.25rem 0.625rem', borderRadius: '14px',
                    background: 'rgba(245, 158, 11, 0.12)', color: '#B45309',
                    fontSize: '0.78rem', fontWeight: 600,
                    border: '1px solid rgba(245, 158, 11, 0.22)',
                  }}>
                    <Clock size={13} />
                    {lang === 'es' ? 'Activa' : 'Active'}
                  </span>
                )}
              </div>
            </div>

            {/* Edit toggle */}
            {!editing ? (
              <button
                className="btn btn-secondary"
                onClick={() => setEditing(true)}
                style={{ flexShrink: 0 }}
              >
                <Edit2 size={16} />
                {lang === 'es' ? 'Editar' : 'Edit'}
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                <button
                  className="btn"
                  onClick={handleSaveEdit}
                  style={{
                    background: OWED_GRADIENT,
                    color: 'white',
                    border: 'none',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.30)',
                  }}
                >
                  <Check size={16} />
                  {lang === 'es' ? 'Guardar' : 'Save'}
                </button>
                <button className="btn btn-secondary" onClick={() => setEditing(false)}>
                  <X size={16} />
                </button>
              </div>
            )}
          </div>

          {/* Big amount block */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '1rem',
            marginBottom: '1.25rem',
          }}>
            <div style={{
              padding: '1rem 1.25rem',
              borderRadius: '14px',
              background: 'var(--bg-card-elevated, var(--bg-card))',
              border: '1px solid var(--border-color)',
            }}>
              <div style={{
                fontSize: '0.7rem',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontWeight: 600,
                marginBottom: '0.4rem',
              }}>
                {debt.is_closed
                  ? (lang === 'es' ? 'Total pagado' : 'Total paid')
                  : (lang === 'es' ? 'Pendiente' : 'Remaining')}
              </div>
              <div style={{
                fontSize: '1.85rem',
                fontWeight: 800,
                color: accentColor,
                lineHeight: 1.1,
              }}>
                {formatCurrency(debt.is_closed ? totalAmt : remainingAmt)}
              </div>
              {!debt.is_closed && totalAmt > 0 && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                  {lang === 'es' ? 'de ' : 'of '}{formatCurrency(totalAmt)}
                </div>
              )}
            </div>

            <div style={{
              padding: '1rem 1.25rem',
              borderRadius: '14px',
              background: 'var(--bg-card-elevated, var(--bg-card))',
              border: '1px solid var(--border-color)',
            }}>
              <div style={{
                fontSize: '0.7rem',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontWeight: 600,
                marginBottom: '0.4rem',
              }}>
                {lang === 'es' ? 'Importe total' : 'Total amount'}
              </div>
              <div style={{
                fontSize: '1.4rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                lineHeight: 1.1,
              }}>
                {formatCurrency(totalAmt)}
              </div>
              {paidAmt > 0 && !debt.is_closed && (
                <div style={{ fontSize: '0.78rem', color: '#16A34A', marginTop: '0.3rem', fontWeight: 600 }}>
                  {lang === 'es' ? 'Pagado: ' : 'Paid: '}{formatCurrency(paidAmt)}
                </div>
              )}
            </div>

            <div style={{
              padding: '1rem 1.25rem',
              borderRadius: '14px',
              background: 'var(--bg-card-elevated, var(--bg-card))',
              border: '1px solid var(--border-color)',
            }}>
              <div style={{
                fontSize: '0.7rem',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontWeight: 600,
                marginBottom: '0.4rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}>
                <Calendar size={11} />
                {lang === 'es' ? 'Vencimiento' : 'Due date'}
              </div>
              {editing ? (
                <UiDatePicker
                  value={editDueDate}
                  onChange={(d) => setEditDueDate(d ? formatISODateString(d) : '')}
                />
              ) : (
                <div style={{
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  color: overdue ? '#DC2626' : 'var(--text-primary)',
                  lineHeight: 1.2,
                }}>
                  {debt.due_date
                    ? formatDate(debt.due_date)
                    : (lang === 'es' ? 'Sin fecha' : 'No date')}
                </div>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {totalAmt > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{
                height: '8px',
                background: 'var(--border-color)',
                borderRadius: '999px',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: debt.is_closed
                    ? 'linear-gradient(90deg, #10B981 0%, #22C55E 100%)'
                    : progressGradient,
                  borderRadius: '999px',
                  transition: 'width 0.5s ease',
                }} />
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.78rem',
                color: 'var(--text-secondary)',
                marginTop: '0.5rem',
              }}>
                <span style={{ fontWeight: 600 }}>
                  {progress.toFixed(0)}% {lang === 'es' ? 'pagado' : 'paid'}
                </span>
                <span>
                  {lang === 'es' ? 'Pendiente: ' : 'Remaining: '}{formatCurrency(remainingAmt)}
                </span>
              </div>
            </div>
          )}

          {/* Description */}
          <div style={{
            paddingTop: '1rem',
            borderTop: '1px solid var(--border-color)',
          }}>
            <div style={{
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontWeight: 600,
              marginBottom: '0.4rem',
            }}>
              {lang === 'es' ? 'Descripción' : 'Description'}
            </div>
            {editing ? (
              <UiTextarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
                placeholder={lang === 'es' ? 'Añadir descripción...' : 'Add description...'}
              />
            ) : (
              <p style={{
                color: debt.description ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: '0.95rem',
                margin: 0,
                fontStyle: debt.description ? 'normal' : 'italic',
              }}>
                {debt.description || (lang === 'es' ? 'Sin descripción' : 'No description')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Movements / timeline ──────────────────────────────────────────── */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: '20px',
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
      }}>
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
        }}>
          <div>
            <h3 style={{
              fontSize: '1.05rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0,
            }}>
              {lang === 'es' ? 'Historial de movimientos' : 'Payment history'}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
              {movements.length === 0
                ? (lang === 'es' ? 'Aún no hay movimientos registrados' : 'No movements yet')
                : `${movements.length} ${lang === 'es' ? (movements.length === 1 ? 'movimiento' : 'movimientos') : (movements.length === 1 ? 'movement' : 'movements')}`}
            </p>
          </div>
          {!debt.is_closed && (
            <button
              className="btn btn-primary"
              onClick={() => setShowMovementForm(true)}
              style={{
                background: DEBTS_GRADIENT,
                boxShadow: '0 4px 14px rgba(239, 68, 68, 0.35)',
                border: 'none',
              }}
            >
              <Plus size={18} />
              {lang === 'es' ? 'Añadir pago' : 'Add payment'}
            </button>
          )}
        </div>

        {/* Movement form */}
        {showMovementForm && (
          <form
            onSubmit={handleAddMovement}
            style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border-color)',
              background: 'var(--bg-card-elevated, var(--bg-card))',
            }}
          >
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              marginBottom: '1rem',
            }}>
              <UiField label={lang === 'es' ? 'Tipo' : 'Type'}>
                <UiSelect
                  value={movementType}
                  onChange={setMovementType}
                  options={[
                    { value: 'payment',  label: lang === 'es' ? 'Pago' : 'Payment' },
                    { value: 'increase', label: lang === 'es' ? 'Aumentar deuda' : 'Increase debt' }
                  ]}
                />
              </UiField>
              <UiNumber
                label={lang === 'es' ? 'Importe (€)' : 'Amount (€)'}
                value={movementAmount}
                onChange={(val: string) => setMovementAmount(val)}
                step="0.01"
                min={0}
                required
              />
              <UiField label={lang === 'es' ? 'Fecha' : 'Date'}>
                <UiDatePicker
                  value={movementDate}
                  onChange={(d) => setMovementDate(d ? formatISODateString(d) : '')}
                  required
                />
              </UiField>
              <UiInput
                label={lang === 'es' ? 'Nota (opcional)' : 'Note (optional)'}
                value={movementNote}
                onChange={(e) => setMovementNote(e.target.value)}
                placeholder={lang === 'es' ? 'Añade una nota...' : 'Add a note...'}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
                style={{
                  background: movementType === 'payment' ? OWED_GRADIENT : DEBTS_GRADIENT,
                  border: 'none',
                  boxShadow: movementType === 'payment'
                    ? '0 4px 12px rgba(16, 185, 129, 0.30)'
                    : '0 4px 12px rgba(239, 68, 68, 0.30)',
                }}
              >
                {submitting
                  ? (lang === 'es' ? 'Guardando...' : 'Saving...')
                  : (lang === 'es' ? 'Guardar' : 'Save')}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowMovementForm(false)}>
                {lang === 'es' ? 'Cancelar' : 'Cancel'}
              </button>
            </div>
          </form>
        )}

        {/* Timeline */}
        {movements.length === 0 ? (
          <div style={{ padding: '2.5rem 1.5rem' }}>
            <EmptyState
              compact
              icon={<Clock size={32} style={{ color: 'var(--text-muted)' }} />}
              title={lang === 'es' ? 'No hay movimientos aún' : 'No movements yet'}
              description={
                debt.is_closed
                  ? (lang === 'es' ? 'Esta deuda ya está cerrada.' : 'This debt is already closed.')
                  : (lang === 'es' ? 'Añade el primer pago o ajuste para llevar el control.' : 'Add the first payment or adjustment to track progress.')
              }
            />
          </div>
        ) : (
          <div style={{ padding: '0.75rem 1.5rem 1.25rem' }}>
            {movements.map((mov, idx) => {
              const isPayment = mov.type === 'payment'
              const movGradient = isPayment ? OWED_GRADIENT : DEBTS_GRADIENT
              return (
                <div
                  key={mov.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.875rem',
                    padding: '0.875rem 0',
                    borderBottom: idx === movements.length - 1 ? 'none' : '1px solid var(--border-color)',
                  }}
                >
                  {/* Timeline node */}
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '12px',
                    background: movGradient,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: isPayment
                      ? '0 4px 10px rgba(16, 185, 129, 0.25)'
                      : '0 4px 10px rgba(239, 68, 68, 0.25)',
                  }}>
                    {isPayment
                      ? <ArrowDownCircle size={20} color="white" />
                      : <ArrowUpCircle size={20} color="white" />}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{
                          fontSize: '0.95rem',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                        }}>
                          {isPayment
                            ? (lang === 'es' ? 'Pago' : 'Payment')
                            : (lang === 'es' ? 'Aumento de deuda' : 'Debt increase')}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                          {formatDate(mov.date)}
                        </div>
                      </div>
                      <div style={{
                        fontSize: '1.1rem',
                        fontWeight: 800,
                        color: isPayment ? '#16A34A' : '#DC2626',
                      }}>
                        {isPayment ? '−' : '+'}{formatCurrency(mov.amount)}
                      </div>
                    </div>
                    {mov.note && (
                      <div style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-secondary)',
                        marginTop: '0.4rem',
                        padding: '0.5rem 0.75rem',
                        background: 'var(--bg-card-elevated, var(--bg-card))',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                      }}>
                        {mov.note}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
