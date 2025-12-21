import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { 
  getUserRecurringRules, 
  createRecurringRule,
  toggleRecurringRuleActive,
  type RecurringRule,
  type CreateRuleInput
} from '../../services/recurringService'
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

export default function RecurringList() {
  const { t, language } = useI18n()
  const [rules, setRules] = useState<RecurringRule[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  // Form state
  const [kind, setKind] = useState<'income' | 'expense'>('expense')
  const [accountId, setAccountId] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [frequency, setFrequency] = useState<'weekly' | 'monthly'>('monthly')
  const [dayOfWeek, setDayOfWeek] = useState(1) // Monday
  const [dayOfMonth, setDayOfMonth] = useState(1)
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      const [rulesData, accountsData] = await Promise.all([
        getUserRecurringRules(user.id),
        fetchAccounts(user.id)
      ])
      setRules(rulesData)
      setAccounts(accountsData)
      
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
    setSubmitting(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      // Calculate initial next_occurrence
      let nextOccurrence = new Date(startDate)
      
      if (frequency === 'weekly') {
        const currentDay = nextOccurrence.getDay()
        let daysToAdd = dayOfWeek - currentDay
        if (daysToAdd < 0) daysToAdd += 7
        nextOccurrence.setDate(nextOccurrence.getDate() + daysToAdd)
      } else {
        const targetDay = Math.min(dayOfMonth, new Date(nextOccurrence.getFullYear(), nextOccurrence.getMonth() + 1, 0).getDate())
        nextOccurrence.setDate(targetDay)
        if (nextOccurrence < new Date(startDate)) {
          nextOccurrence.setMonth(nextOccurrence.getMonth() + 1)
          const lastDay = new Date(nextOccurrence.getFullYear(), nextOccurrence.getMonth() + 1, 0).getDate()
          nextOccurrence.setDate(Math.min(dayOfMonth, lastDay))
        }
      }

      const input: CreateRuleInput = {
        user_id: user.id,
        account_id: accountId,
        kind,
        amount: parseFloat(amount),
        category: category || null,
        description: description || null,
        frequency,
        day_of_week: frequency === 'weekly' ? dayOfWeek : null,
        day_of_month: frequency === 'monthly' ? dayOfMonth : null,
        next_occurrence: nextOccurrence.toISOString().split('T')[0]
      }

      await createRecurringRule(input)
      setShowModal(false)
      resetForm()
      loadData()
    } catch (error) {
      console.error('Error creating rule:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggle = async (rule: RecurringRule) => {
    try {
      await toggleRecurringRuleActive(rule.id, !rule.is_active)
      loadData()
    } catch (error) {
      console.error('Error toggling rule:', error)
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
                        <div className="text-xs text-muted mt-1">{rule.category}</div>
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
                        title={rule.is_active ? t('common.active') : t('common.inactive')}
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
        onClose={() => setShowModal(false)}
        title={t('recurring.modal.newTitle')}
        width="500px"
      >
        <form onSubmit={handleCreate}>
          <UiModalBody>
            <div className="form-group">
              <UiField label={t('recurring.modal.type')}>
                <UiSelect
                  value={kind}
                  onChange={(val) => setKind(val as 'income' | 'expense')}
                  options={[
                      { value: 'expense', label: t('movements.expense') },
                      { value: 'income', label: t('movements.income') }
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
                    label={`${t('recurring.amount')} (€)`}
                    value={amount}
                    onChange={(val: string) => setAmount(val)}
                    placeholder="0.00"
                    step="0.01"
                    min={0.01}
                    required
                />
              </div>

              <div style={{ flex: 1 }}>
                <UiInput
                    label={t('recurring.modal.category')}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Ej: Alquiler..."
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
                            if (!isNaN(num)) setDayOfMonth(num);
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
             <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
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
