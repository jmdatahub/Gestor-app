import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useWorkspace } from '../../context/WorkspaceContext'
import { fetchDebts, createDebt, type Debt, type CreateDebtInput } from '../../services/debtService'
import { Plus, AlertCircle, CheckCircle2 } from 'lucide-react'
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

export default function DebtsList() {
  const { t, language } = useI18n()
  const navigate = useNavigate()
  const { currentWorkspace } = useWorkspace()  // Add workspace context
  const [debts, setDebts] = useState<Debt[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'i_owe' | 'they_owe_me'>('i_owe')
  const [showModal, setShowModal] = useState(false)

  // Form state
  const [direction, setDirection] = useState<'i_owe' | 'they_owe_me'>('i_owe')
  const [counterparty, setCounterparty] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Reload when workspace changes
  useEffect(() => {
    loadDebts()
  }, [currentWorkspace])

  const loadDebts = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      const data = await fetchDebts(user.id)
      setDebts(data)
    } catch (error) {
      console.error('Error loading debts:', error)
    } finally {
      setLoading(false)
    }
  }

  const [formError, setFormError] = useState<string | null>(null)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    
    // Validación previa
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
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setFormError('No se pudo obtener el usuario. Inicia sesión nuevamente.')
      setSubmitting(false)
      return
    }

    // Timeout de seguridad (12s)
    const timeoutId = setTimeout(() => {
      setSubmitting(false)
      setFormError('La operación tardó demasiado. Verifica tu conexión.')
    }, 12000)

    try {
      console.log('[DebtsList] Creating debt...', { direction, counterparty, amount: amountNum })
      
      const input: CreateDebtInput = {
        user_id: user.id,
        direction,
        counterparty_name: counterparty.trim(),
        total_amount: amountNum,
        due_date: dueDate || null,
        description: description.trim() || null
      }
      
      await createDebt(input)
      clearTimeout(timeoutId)
      
      console.log('[DebtsList] Debt created successfully!')
      setShowModal(false)
      resetForm()
      loadDebts()
    } catch (err: unknown) {
      clearTimeout(timeoutId)
      console.error('[DebtsList] Error creating debt:', err)
      
      // Mostrar error técnico completo para debugging
      let errorMsg = 'Error al crear la deuda.'
      let technicalDetail = ''
      
      if (err && typeof err === 'object') {
        const supaError = err as { message?: string; details?: string; hint?: string; code?: string }
        technicalDetail = supaError.message || JSON.stringify(err)
        
        // Add extra details if available
        if (supaError.details) technicalDetail += ` | ${supaError.details}`
        if (supaError.hint) technicalDetail += ` | Hint: ${supaError.hint}`
        if (supaError.code) technicalDetail += ` | Code: ${supaError.code}`
      }
      
      // Display both user-friendly message and technical detail
      if (technicalDetail) {
        errorMsg += ` [${technicalDetail}]`
      }
      
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(language === 'es' ? 'es-ES' : 'en-US', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount)
  }

  if (loading) {
    return (
       <div className="d-flex items-center justify-center" style={{ minHeight: '200px' }}>
         <div className="spinner"></div>
      </div>
    )
  }

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

      {/* Debts List */}
      {filteredDebts.length === 0 ? (
        <UiCard className="p-12 d-flex flex-col items-center justify-center text-center">
            <p className="text-secondary">{t('debts.empty')}</p>
        </UiCard>
      ) : (
        <div className="d-flex flex-col gap-4">
          {filteredDebts.map((debt) => (
            <div 
              key={debt.id}
              className="cursor-pointer"
              onClick={() => navigate(`/app/debts/${debt.id}`)}
              style={{ transition: 'all 0.2s ease-in-out' }}
              onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
                e.currentTarget.style.transform = 'translateY(-2px) scale(1.01)'
                e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)'
              }}
              onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)'
                e.currentTarget.style.boxShadow = ''
              }}
            >
              <UiCard 
                style={{
                  borderLeft: debt.is_closed
                    ? '4px solid var(--success)'
                    : isOverdue(debt)
                      ? '4px solid var(--danger)'
                      : '4px solid var(--primary)'
                }}
              >
                <div>
                    <div className="card-header pb-2 border-0">
                        <div className="d-flex justify-between items-start">
                            <div>
                                <h3 className="text-lg font-bold">{debt.counterparty_name}</h3>
                                {debt.description && (
                                    <p className="text-sm text-muted mt-1">{debt.description}</p>
                                )}
                            </div>
                            <div className="text-right">
                                <div className="text-xl font-bold">{formatCurrency(debt.remaining_amount)}</div>
                                <div className="text-xs text-muted">
                                    {t('debts.ofTotal')} {formatCurrency(debt.total_amount)}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="card-footer bg-transparent border-t border-gray-100 pt-3 flex justify-between items-center">
                        <div className="d-flex items-center gap-2 text-sm">
                            {debt.due_date && (
                                <span className={isOverdue(debt) ? 'text-danger' : 'text-muted'}>
                                {t('debts.dueDate')}: {formatDate(debt.due_date)}
                                </span>
                            )}
                        </div>
                        <div>
                            {debt.is_closed ? (
                                <span className="badge badge-success">
                                <CheckCircle2 size={14} style={{ marginRight: '4px' }} />
                                {t('debts.closed')}
                                </span>
                            ) : isOverdue(debt) ? (
                                <span className="badge badge-danger">
                                <AlertCircle size={14} style={{ marginRight: '4px' }} />
                                {t('debts.overdue')}
                                </span>
                            ) : (
                                <span className="badge badge-gray">{t('debts.pending')}</span>
                            )}
                        </div>
                    </div>
                </div>
            </UiCard>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <UiModal 
        isOpen={showModal} 
        onClose={() => { setShowModal(false); setFormError(null); }}
        width="500px"
      >
        <form onSubmit={handleCreate}>
          <div className="p-4 border-b">
            <h3 className="text-lg font-semibold">{t('debts.new')}</h3>
          </div>
          
          {/* Error Banner */}
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
             <button type="button" className="btn btn-secondary" onClick={() => { setShowModal(false); setFormError(null); }}>
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
