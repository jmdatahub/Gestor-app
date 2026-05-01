import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useWorkspace } from '../../context/WorkspaceContext'
import { fetchDebts, type Debt, type CreateDebtInput } from '../../services/debtService'
import { useCreateDebt } from '../../hooks/queries/useDebtMutations'
import { Plus, AlertCircle, CheckCircle2, Clock, ChevronRight } from 'lucide-react'
import { useI18n } from '../../hooks/useI18n'
import { UiDatePicker } from '../../components/ui/UiDatePicker'
import { formatISODateString } from '../../utils/date'
import { UiSelect } from '../../components/ui/UiSelect'
import { UiField } from '../../components/ui/UiField'
import { UiSegmented } from '../../components/ui/UiSegmented'
import { UiCard } from '../../components/ui/UiCard'
import { UiInput } from '../../components/ui/UiInput'
import { UiNumber } from '../../components/ui/UiNumber'
import { UiTextarea } from '../../components/ui/UiTextarea'
import { UiModal, UiModalBody, UiModalFooter } from '../../components/ui/UiModal'
import { useToast } from '../../components/Toast'

export default function DebtsList() {
  const { t, language } = useI18n()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { currentWorkspace } = useWorkspace()
  const toast = useToast()
  const createDebtMutation = useCreateDebt()
  const [debts, setDebts] = useState<Debt[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'i_owe' | 'they_owe_me'>('i_owe')
  const [showModal, setShowModal] = useState(false)

  const [direction, setDirection] = useState<'i_owe' | 'they_owe_me'>('i_owe')
  const [counterparty, setCounterparty] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    loadDebts()
  }, [currentWorkspace])

  const loadDebts = async () => {
    if (!user) return
    try {
      const orgId = currentWorkspace?.id || null
      const data = await fetchDebts(user.id, orgId)
      setDebts(data)
    } catch (error) {
      console.error('Error loading debts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!counterparty.trim()) {
      setFormError('El nombre de la contraparte es obligatorio')
      return
    }
    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      setFormError('El importe debe ser un número mayor a 0')
      return
    }

    setSubmitting(true)
    if (!user) {
      setFormError('No se pudo obtener el usuario. Inicia sesión nuevamente.')
      setSubmitting(false)
      return
    }

    const timeoutId = setTimeout(() => {
      setSubmitting(false)
      setFormError('La operación tardó demasiado. Verifica tu conexión.')
    }, 12000)

    try {
      const input: CreateDebtInput = {
        user_id: user.id,
        organization_id: currentWorkspace?.id || null,
        direction,
        counterparty_name: counterparty.trim(),
        total_amount: amountNum,
        due_date: dueDate || null,
        description: description.trim() || null
      }

      await createDebtMutation.mutateAsync(input)
      clearTimeout(timeoutId)
      setShowModal(false)
      resetForm()
      loadDebts()
    } catch (err: unknown) {
      clearTimeout(timeoutId)
      let errorMsg = 'Error al crear la deuda.'
      let technicalDetail = ''

      if (err && typeof err === 'object') {
        const supaError = err as { message?: string; details?: string; hint?: string; code?: string }
        technicalDetail = supaError.message || JSON.stringify(err)
        if (supaError.details) technicalDetail += ` | ${supaError.details}`
        if (supaError.hint) technicalDetail += ` | Hint: ${supaError.hint}`
        if (supaError.code) technicalDetail += ` | Code: ${supaError.code}`
      }

      if (technicalDetail) errorMsg += ` [${technicalDetail}]`
      setFormError(errorMsg)
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setCounterparty('')
    setAmount('')
    setDueDate('')
    setDescription('')
    setDirection('i_owe')
  }

  const filteredDebts = debts.filter(d => d.direction === activeTab)

  const isOverdue = (debt: Debt) => {
    if (!debt.due_date || debt.is_closed) return false
    return new Date(debt.due_date) < new Date()
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const formatCurrency = (amount: number | string | null | undefined) => {
    const n = Number(amount ?? 0)
    const safe = Number.isFinite(n) ? n : 0
    return new Intl.NumberFormat(language === 'es' ? 'es-ES' : 'en-US', {
      style: 'currency',
      currency: 'EUR'
    }).format(safe)
  }

  if (loading) {
    return (
      <div className="d-flex items-center justify-center" style={{ minHeight: '200px' }}>
        <div className="spinner"></div>
      </div>
    )
  }

  const activeDebts = filteredDebts.filter(d => !d.is_closed)
  const totalPending = activeDebts.reduce((s, d) => s + (Number(d.remaining_amount) || 0), 0)
  const overdueCount = activeDebts.filter(d => isOverdue(d)).length
  const closedCount = filteredDebts.filter(d => d.is_closed).length

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('debts.title')}</h1>
          <p className="page-subtitle">{t('debts.subtitle')}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={20} />
          {t('debts.new')}
        </button>
      </div>

      {/* Segmented Control */}
      <div className="d-flex justify-center mb-6">
        <UiSegmented
          value={activeTab}
          onChange={(val) => setActiveTab(val as 'i_owe' | 'they_owe_me')}
          options={[
            { value: 'i_owe', label: t('debts.iOwe') },
            { value: 'they_owe_me', label: t('debts.theyOweMe') },
          ]}
        />
      </div>

      {/* Summary Strip */}
      {filteredDebts.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          <div style={{
            padding: '14px 18px',
            background: 'var(--card-bg)',
            borderRadius: 12,
            border: '1px solid var(--border)',
            borderTop: `3px solid ${activeTab === 'i_owe' ? '#ef4444' : 'var(--success)'}`
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              Total pendiente
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: activeTab === 'i_owe' ? '#ef4444' : 'var(--success)' }}>
              {formatCurrency(totalPending)}
            </div>
          </div>
          <div style={{
            padding: '14px 18px',
            background: 'var(--card-bg)',
            borderRadius: 12,
            border: '1px solid var(--border)',
            borderTop: '3px solid var(--primary)'
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              Activas
            </div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{activeDebts.length}</div>
          </div>
          <div style={{
            padding: '14px 18px',
            background: 'var(--card-bg)',
            borderRadius: 12,
            border: '1px solid var(--border)',
            borderTop: `3px solid ${overdueCount > 0 ? '#ef4444' : 'var(--border)'}`
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              Vencidas
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: overdueCount > 0 ? '#ef4444' : 'var(--text-secondary)' }}>
              {overdueCount}
            </div>
          </div>
        </div>
      )}

      {/* Debts List */}
      {filteredDebts.length === 0 ? (
        <UiCard className="p-12 d-flex flex-col items-center justify-center text-center">
          <p className="text-secondary">{t('debts.empty')}</p>
        </UiCard>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredDebts.map((debt) => {
            const totalAmt = Number(debt.total_amount ?? 0) || 0
            const remainingAmt = Number(debt.remaining_amount ?? 0) || 0
            const paidAmt = totalAmt - remainingAmt
            const paidPct = totalAmt > 0 ? Math.min(100, Math.max(0, (paidAmt / totalAmt) * 100)) : 0
            const overdue = isOverdue(debt)
            const statusColor = debt.is_closed ? '#22c55e' : overdue ? '#ef4444' : 'var(--primary)'
            const initial = debt.counterparty_name?.charAt(0)?.toUpperCase() || '?'

            return (
              <div
                key={debt.id}
                onClick={() => navigate(`/app/debts/${debt.id}`)}
                style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--border)',
                  borderLeft: `4px solid ${statusColor}`,
                  borderRadius: '12px',
                  padding: '16px 20px',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLDivElement
                  el.style.transform = 'translateY(-2px)'
                  el.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLDivElement
                  el.style.transform = ''
                  el.style.boxShadow = ''
                }}
              >
                {/* Top row: Avatar + Name/Desc + Amount */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  {/* Avatar */}
                  <div style={{
                    width: 46,
                    height: 46,
                    borderRadius: '50%',
                    background: `${statusColor}22`,
                    color: statusColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: 19,
                    flexShrink: 0,
                    border: `1.5px solid ${statusColor}44`,
                  }}>
                    {initial}
                  </div>

                  {/* Name + Description */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 3, lineHeight: 1.2 }}>
                      {debt.counterparty_name}
                    </div>
                    {debt.description && (
                      <div style={{
                        fontSize: 13,
                        color: 'var(--text-secondary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '100%',
                      }}>
                        {debt.description}
                      </div>
                    )}
                  </div>

                  {/* Amount + chevron */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: statusColor, lineHeight: 1.2 }}>
                        {formatCurrency(remainingAmt)}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                        de {formatCurrency(totalAmt)}
                      </div>
                    </div>
                    <ChevronRight size={18} style={{ color: 'var(--text-secondary)', opacity: 0.5 }} />
                  </div>
                </div>

                {/* Progress bar */}
                {!debt.is_closed && totalAmt > 0 && (
                  <div style={{ marginTop: 14, marginBottom: 2 }}>
                    <div style={{
                      height: 5,
                      background: 'var(--border)',
                      borderRadius: 3,
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${paidPct}%`,
                        background: statusColor,
                        borderRadius: 3,
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                      <span>{paidPct.toFixed(0)}% pagado</span>
                      <span>Pendiente: {formatCurrency(remainingAmt)}</span>
                    </div>
                  </div>
                )}

                {/* Footer: date + badge */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                  <div>
                    {debt.due_date ? (
                      <span style={{
                        fontSize: 12,
                        color: overdue ? '#ef4444' : 'var(--text-secondary)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}>
                        <Clock size={12} />
                        {overdue ? 'Vencida: ' : 'Vence: '}{formatDate(debt.due_date)}
                      </span>
                    ) : (
                      <span />
                    )}
                  </div>

                  <div>
                    {debt.is_closed ? (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                        background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0',
                      }}>
                        <CheckCircle2 size={13} />
                        {t('debts.closed')}
                      </span>
                    ) : overdue ? (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                        background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca',
                      }}>
                        <AlertCircle size={13} />
                        {t('debts.overdue')}
                      </span>
                    ) : (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                        background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d',
                      }}>
                        <Clock size={13} />
                        {t('debts.pending')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create Modal */}
      <UiModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setFormError(null) }}
        width="500px"
      >
        <form onSubmit={handleCreate}>
          <div className="p-4 border-b">
            <h3 className="text-lg font-semibold">{t('debts.new')}</h3>
          </div>

          {formError && (
            <div className="mx-4 mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
              <strong>⚠️ Error:</strong> {formError}
            </div>
          )}

          <UiModalBody>
            <div className="form-group">
              <UiField label={t('debts.modal.type')}>
                <UiSelect
                  value={direction}
                  onChange={(val) => setDirection(val as 'i_owe' | 'they_owe_me')}
                  options={[
                    { value: 'i_owe', label: t('debts.iOwe') },
                    { value: 'they_owe_me', label: t('debts.theyOweMe') },
                  ]}
                />
              </UiField>
            </div>

            <div className="form-group">
              <UiInput
                label={direction === 'i_owe' ? t('debts.modal.whoYouOwe') : t('debts.modal.whoOwesYou')}
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                placeholder="Nombre"
                required
              />
            </div>

            <div className="form-group">
              <UiNumber
                label={`${t('debts.amount')} (€)`}
                value={amount}
                onChange={(val: string) => setAmount(val)}
                placeholder="0.00"
                step="0.01"
                min={0}
                required
              />
            </div>

            <div className="form-group">
              <UiField label={t('debts.modal.dueDate')}>
                <UiDatePicker
                  value={dueDate}
                  onChange={(d) => setDueDate(d ? formatISODateString(d) : '')}
                />
              </UiField>
            </div>

            <div className="form-group">
              <UiTextarea
                label={t('debts.description')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('common.noDescription')}
                rows={3}
              />
            </div>
          </UiModalBody>
          <UiModalFooter>
            <button type="button" className="btn btn-secondary" onClick={() => { setShowModal(false); setFormError(null) }}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? t('common.loading') : t('debts.modal.create')}
            </button>
          </UiModalFooter>
        </form>
      </UiModal>
    </div>
  )
}
