import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../lib/apiClient'
import { useWorkspace } from '../../context/WorkspaceContext'
import {
  getUserRecurringRules,
  type RecurringRule,
  type CreateRuleInput,
} from '../../services/recurringService'
import {
  useCreateRecurringRule,
  useToggleRecurringRuleActive,
} from '../../hooks/queries/useRecurringMutations'
import { fetchAccounts, type Account } from '../../services/movementService'
import { Plus, Power, PowerOff, X, RefreshCw } from 'lucide-react'
import { useI18n } from '../../hooks/useI18n'
import { UiDatePicker } from '../../components/ui/UiDatePicker'
import { formatISODateString } from '../../utils/date'
import { UiCard, UiCardBody } from '../../components/ui/UiCard'
import { UiSelect } from '../../components/ui/UiSelect'
import { UiField } from '../../components/ui/UiField'
import { UiInput } from '../../components/ui/UiInput'
import { UiNumber } from '../../components/ui/UiNumber'
import { UiModal, UiModalHeader, UiModalBody, UiModalFooter } from '../../components/ui/UiModal'
import { SkeletonList } from '../../components/Skeleton'
import { CategoryPicker } from '../../components/domain/CategoryPicker'
import { useToast } from '../../components/Toast'

export default function RecurringList() {
  const { t, language } = useI18n()
  const { user } = useAuth()
  const { currentWorkspace } = useWorkspace()  // Add workspace context
  const createRuleMutation = useCreateRecurringRule()
  const toggleRuleMutation = useToggleRecurringRuleActive()
  const toast = useToast()
  const [rules, setRules] = useState<RecurringRule[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string; type: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  // Form state
  const [kind, setKind] = useState<'income' | 'expense'>('expense')
  const [accountId, setAccountId] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [frequency, setFrequency] = useState<'weekly' | 'monthly'>('monthly')
  const [dayOfWeek, setDayOfWeek] = useState(1)
  const [dayOfMonth, setDayOfMonth] = useState(1)
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  // Reload when workspace changes
  useEffect(() => {
    loadData()
  }, [currentWorkspace])

  const loadData = async () => {
    if (!user) return

    try {
      const orgId = currentWorkspace?.id || null
      const [rulesData, accountsData, categoriesResponse] = await Promise.all([
        getUserRecurringRules(user.id, orgId),
        fetchAccounts(user.id, orgId),
        api.get<{ data: { id: string; name: string; type: string }[] }>('/api/v1/categories')
      ])
      setRules(rulesData)
      setAccounts(accountsData)
      setCategories(categoriesResponse.data || [])

      const generalAccount = accountsData.find(a => a.type === 'general')
      if (generalAccount) setAccountId(generalAccount.id)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    // Form validation
    const parsedAmount = parseFloat(amount)
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError(language === 'es'
        ? 'El importe debe ser un número positivo.'
        : 'Amount must be a positive number.')
      return
    }
    if (!accountId) {
      setFormError(language === 'es'
        ? 'Selecciona una cuenta.'
        : 'Please select an account.')
      return
    }
    // Clamp dayOfMonth to 1–31
    const clampedDay = Math.max(1, Math.min(31, dayOfMonth))

    setSubmitting(true)

    if (!user) return

    try {
      // Calculate initial next_occurrence
      const startDateObj = new Date(startDate)

      let nextOccurrence: Date

      if (frequency === 'weekly') {
        nextOccurrence = new Date(startDateObj)
        const currentDay = nextOccurrence.getDay()
        let daysToAdd = dayOfWeek - currentDay
        if (daysToAdd < 0) daysToAdd += 7
        nextOccurrence.setDate(nextOccurrence.getDate() + daysToAdd)
      } else {
        // Monthly: clamp target day to the start month's max days
        const startYear = startDateObj.getFullYear()
        const startMonth = startDateObj.getMonth()
        const maxDaysInStartMonth = new Date(startYear, startMonth + 1, 0).getDate()
        const targetDay = Math.min(clampedDay, maxDaysInStartMonth)

        nextOccurrence = new Date(startYear, startMonth, targetDay)

        // If the calculated date is before startDate, advance one month and recalculate
        if (nextOccurrence < startDateObj) {
          const nextMonth = startMonth + 1
          const nextYear = nextMonth > 11 ? startYear + 1 : startYear
          const normalizedMonth = nextMonth > 11 ? 0 : nextMonth
          const maxDaysInNextMonth = new Date(nextYear, normalizedMonth + 1, 0).getDate()
          nextOccurrence = new Date(nextYear, normalizedMonth, Math.min(clampedDay, maxDaysInNextMonth))
        }
      }

      const input: CreateRuleInput = {
        user_id: user.id,
        organization_id: currentWorkspace?.id || null, // Pass organization_id
        account_id: accountId,
        kind,
        amount: parsedAmount,
        category: category || null,
        description: description || null,
        frequency,
        day_of_week: frequency === 'weekly' ? dayOfWeek : null,
        day_of_month: frequency === 'monthly' ? clampedDay : null,
        next_occurrence: nextOccurrence.toISOString().split('T')[0]
      }

      await createRuleMutation.mutateAsync(input)
      // Load updated list before closing modal so new rule appears immediately
      await loadData()
      setShowModal(false)
      resetForm()
      toast.success(
        language === 'es' ? 'Regla creada' : 'Rule created',
        language === 'es' ? 'La regla recurrente se ha guardado.' : 'The recurring rule has been saved.'
      )
    } catch (error) {
      console.error('Error creating rule:', error)
      toast.error(
        language === 'es' ? 'Error al crear la regla' : 'Failed to create rule',
        language === 'es'
          ? 'No se pudo guardar la regla recurrente. Inténtalo de nuevo.'
          : 'Could not save the recurring rule. Please try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggle = async (rule: RecurringRule) => {
    try {
      await toggleRuleMutation.mutateAsync({ id: rule.id, isActive: !rule.is_active })
      loadData()
    } catch (error) {
      console.error('Error toggling rule:', error)
      toast.error(
        language === 'es' ? 'Error al cambiar estado' : 'Failed to update rule',
        language === 'es'
          ? 'No se pudo cambiar el estado de la regla.'
          : 'Could not update the rule status.'
      )
    }
  }

  const resetForm = () => {
    setKind('expense')
    setAmount('')
    setCategory('')
    setDescription('')
    setFrequency('monthly')
    setDayOfWeek(1)
    setDayOfMonth(1)
    setStartDate(new Date().toISOString().split('T')[0])
    setFormError('')
    const generalAccount = accounts.find(a => a.type === 'general')
    if (generalAccount) setAccountId(generalAccount.id)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(language === 'es' ? 'es-ES' : 'en-US', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  // Helper to translate frequency
  const getFrequencyLabel = (f: string) => {
    if (f === 'weekly') return t('recurring.modal.weekly')
    if (f === 'monthly') return t('recurring.modal.monthly')
    return f
  }

  const daysOfWeek = [
    { value: 0, label: t('common.sunday') },
    { value: 1, label: t('common.monday') },
    { value: 2, label: t('common.tuesday') },
    { value: 3, label: t('common.wednesday') },
    { value: 4, label: t('common.thursday') },
    { value: 5, label: t('common.friday') },
    { value: 6, label: t('common.saturday') }
  ]

  if (loading) {
    return <SkeletonList rows={5} />
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('recurring.title')}</h1>
          <p className="page-subtitle">{t('recurring.subtitle')}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={20} />
          {t('recurring.new')}
        </button>
      </div>

      {/* Rules List */}
      {rules.length === 0 ? (
         <UiCard className="p-4 d-flex flex-col items-center justify-center text-center">
            <RefreshCw size={48} className="text-secondary mb-4" />
            <p className="text-secondary">{t('recurring.empty')}</p>
            <button className="btn btn-primary mt-4" onClick={() => setShowModal(true)}>
                {t('recurring.createFirst')}
            </button>
        </UiCard>
      ) : (
        <UiCard>
          <UiCardBody noPadding style={{ overflow: 'hidden' }}>
            <div className="table-container">
            <table className="table w-full">
              <thead>
                <tr>
                  <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left' }}>{t('recurring.description')}</th>
                  <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left' }}>{t('movements.type')}</th>
                  <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left' }}>{t('recurring.account')}</th>
                  <th style={{ padding: '0.75rem 1.5rem', textAlign: 'right' }}>{t('recurring.amount')}</th>
                  <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left' }}>{t('recurring.frequency')}</th>
                  <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left' }}>{t('recurring.next')}</th>
                  <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left' }}>{t('recurring.status')}</th>
                  <th style={{ padding: '0.75rem 1.5rem' }}></th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id} style={{ opacity: !rule.is_active ? 0.5 : 1 }}>
                    <td style={{ padding: '0.75rem 1.5rem' }}>
                      <div style={{ fontWeight: 500 }}>{rule.description || t('common.noDescription')}</div>
                      {rule.category && (
                        <div className="text-xs text-muted mt-1">{typeof rule.category === 'object' ? rule.category.name : rule.category}</div>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 1.5rem' }}>
                      <span className={`badge ${rule.kind === 'income' ? 'badge-success' : 'badge-danger'}`}>
                        {rule.kind === 'income' ? t('movements.income') : t('movements.expense')}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1.5rem' }}>{rule.account?.name || '-'}</td>
                    <td style={{ padding: '0.75rem 1.5rem', textAlign: 'right', fontWeight: 600, color: rule.kind === 'income' ? 'var(--success)' : 'var(--danger)' }}>
                      {rule.kind === 'income' ? '+' : '-'}{formatCurrency(rule.amount)}
                    </td>
                    <td style={{ padding: '0.75rem 1.5rem', fontSize: '0.9rem' }}>{getFrequencyLabel(rule.frequency)}</td>
                    <td style={{ padding: '0.75rem 1.5rem', fontSize: '0.9rem' }}>{formatDate(rule.next_occurrence)}</td>
                    <td style={{ padding: '0.75rem 1.5rem' }}>
                      <span className={`badge ${rule.is_active ? 'badge-success' : 'badge-gray'}`}>
                        {rule.is_active ? t('recurring.active') : t('recurring.inactive')}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1.5rem' }}>
                      <button
                        className={`btn btn-icon ${rule.is_active ? 'btn-ghost' : 'btn-success'}`}
                        onClick={() => handleToggle(rule)}
                        title={rule.is_active ? t('recurring.inactive') : t('recurring.active')}
                        aria-label={rule.is_active
                          ? (language === 'es' ? 'Desactivar regla' : 'Deactivate rule')
                          : (language === 'es' ? 'Activar regla' : 'Activate rule')}
                      >
                        {rule.is_active ? <PowerOff size={16} /> : <Power size={16} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </UiCardBody>
        </UiCard>
      )}

      {/* Create Modal */}
      <UiModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setFormError('') }}
        title={t('recurring.modal.newTitle')}
        width="500px"
      >
        <form onSubmit={handleCreate}>
          <UiModalBody>
            {formError && (
              <div style={{
                marginBottom: '1rem',
                padding: '0.625rem 0.875rem',
                borderRadius: '6px',
                background: 'var(--danger-light, #fff5f5)',
                border: '1px solid var(--danger, #e53e3e)',
                color: 'var(--danger, #e53e3e)',
                fontSize: '0.875rem'
              }}>
                {formError}
              </div>
            )}

            <div className="form-group">
              <UiField label={t('recurring.modal.type')}>
                <UiSelect
                  value={kind}
                  onChange={(val) => { setKind(val as 'income' | 'expense'); setCategory('') }}
                  options={[
                      { value: 'expense', label: t('movements.type.expense') },
                      { value: 'income', label: t('movements.type.income') }
                  ]}
                />
              </UiField>
            </div>

            <div className="form-group">
              <UiField label={t('recurring.account')}>
                <UiSelect
                  value={accountId}
                  onChange={setAccountId}
                  options={accounts.map(acc => ({ value: acc.id, label: acc.name }))}
                />
              </UiField>
            </div>

              <div className="form-row">
              <div style={{ flex: 1 }}>
                <UiNumber
                    label={t('recurring.amount')}
                    value={amount}
                    onChange={(val: string) => setAmount(val)}
                    placeholder="0.00"
                    step="0.01"
                    min={0.01}
                    required
                />
              </div>

              <div style={{ flex: 1 }}>
                <CategoryPicker
                  value={category}
                  onChange={(val) => {
                    // CategoryPicker returns id or '__new__:name' format
                    // For recurring rules we just want the category name
                    if (val.startsWith('__new__:')) {
                      setCategory(val.split(':')[1])
                    } else {
                      // Find category name by id
                      const cat = categories.find(c => c.id === val)
                      setCategory(cat ? cat.name : val)
                    }
                  }}
                  type={kind}
                  label={t('recurring.modal.category')}
                />
              </div>
            </div>

            <div className="form-group">
              <UiInput
                label={t('recurring.description')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('common.noDescription')}
              />
            </div>

            <div className="form-row">
              <UiField label={t('recurring.frequency')}>
                <UiSelect
                  value={frequency}
                  onChange={(val) => setFrequency(val as 'weekly' | 'monthly')}
                  options={[
                      { value: 'monthly', label: t('recurring.modal.monthly') },
                      { value: 'weekly', label: t('recurring.modal.weekly') }
                  ]}
                />
              </UiField>

              {frequency === 'weekly' ? (
                <UiField label={t('recurring.modal.dayOfWeek')}>
                    <UiSelect
                    value={dayOfWeek.toString()}
                    onChange={(val) => setDayOfWeek(parseInt(val))}
                    options={daysOfWeek.map(d => ({ value: d.value.toString(), label: d.label }))}
                  />
                </UiField>
              ) : (
                <div style={{ flex: 1 }}>
                    <UiNumber
                        label={t('recurring.modal.dayOfMonth')}
                        value={dayOfMonth}
                        onChange={(val: string) => {
                            const num = parseInt(val);
                            if (!isNaN(num)) setDayOfMonth(Math.max(1, Math.min(31, num)));
                        }}
                        min={1}
                        max={31}
                        required
                    />
                </div>
              )}
            </div>

            <div className="form-group">
              <UiField label={t('recurring.modal.startDate')}>
                <UiDatePicker
                  value={startDate}
                  onChange={(d) => setStartDate(d ? formatISODateString(d) : '')}
                  required
                />
              </UiField>
            </div>
          </UiModalBody>
          <UiModalFooter>
             <button type="button" className="btn btn-secondary" onClick={() => { setShowModal(false); setFormError('') }}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? t('common.loading') : t('recurring.modal.create')}
            </button>
          </UiModalFooter>
        </form>
      </UiModal>
    </div>
  )
}
