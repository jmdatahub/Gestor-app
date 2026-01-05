import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import {
  getAccountsWithBalances,
  createAccount,
  updateAccount,
  toggleAccountActive,
  calculateTotalsByType,
  getAccountTypeLabel,
  buildAccountTree,
  flattenAccountTree,
  validateParentAssignment,
  type AccountWithBalance,
  type CreateAccountInput,
  type AccountNode
} from '../../services/accountService'
import { useI18n } from '../../hooks/useI18n'
import { useSettings } from '../../context/SettingsContext'
import { UiSelect } from '../../components/ui/UiSelect'
import { UiCard, UiCardBody } from '../../components/ui/UiCard'
import { UiField } from '../../components/ui/UiField'
import { UiInput } from '../../components/ui/UiInput'
import { UiTextarea } from '../../components/ui/UiTextarea'
import { UiModal, UiModalHeader, UiModalBody, UiModalFooter } from '../../components/ui/UiModal'
import { Plus, Edit2, Power, PowerOff, X, CreditCard, Wallet, PiggyBank, TrendingUp, AlertTriangle } from 'lucide-react'
import { Breadcrumbs } from '../../components/Breadcrumbs'
import { SkeletonList } from '../../components/Skeleton'
import { formatISODateString } from '../../utils/date'

export default function AccountsList() {
  const navigate = useNavigate()
  const { t, language } = useI18n()
  const { settings } = useSettings()
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([])
  const [flatAccounts, setFlatAccounts] = useState<AccountNode[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<AccountWithBalance | null>(null)
  
  // Form state
  const [parentId, setParentId] = useState<string>('') 
  const [name, setName] = useState('')
  const [type, setType] = useState<CreateAccountInput['type']>('general')
  const [description, setDescription] = useState('')  // Añadido: descripción
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      const data = await getAccountsWithBalances(user.id)
      setAccounts(data)
      
      const tree = buildAccountTree(data)
      const flat = flattenAccountTree(tree)
      setFlatAccounts(flat)

      setFlatAccounts(flat)
    } catch (error) {
      console.error('Error loading accounts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setErrorMsg(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      await createAccount({ 
        user_id: user.id, 
        name, 
        type,
        description: description || null,  // Añadido
        parent_account_id: parentId || null 
      })
      setShowCreateModal(false)
      resetForm()
      loadData()
    } catch (error: any) {
      console.error('Error creating account:', error)
      setErrorMsg('No se pudo crear la cuenta. Inténtalo de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAccount) return
    setErrorMsg(null)

    const validationError = validateParentAssignment(accounts, selectedAccount.id, parentId || null)
    if (validationError) {
        setErrorMsg(validationError)
        return
    }

    setSubmitting(true)

    try {
      await updateAccount(selectedAccount.id, { 
        name, 
        type, 
        parent_account_id: parentId || null
      })
      setShowEditModal(false)
      setSelectedAccount(null)
      loadData()
    } catch (error: any) {
      console.error('Error updating account:', error)
      setErrorMsg('No se pudo actualizar la cuenta. ' + (error.message || ''))
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggle = async (acc: AccountWithBalance) => {
    try {
      await toggleAccountActive(acc.id, !acc.is_active)
      loadData()
    } catch (error) {
      console.error('Error toggling account:', error)
    }
  }

  const openEditModal = (acc: AccountWithBalance) => {
    setSelectedAccount(acc)
    setName(acc.name)
    setType(acc.type)
    setDescription(acc.description || '')  // Añadido
    setParentId(acc.parent_account_id || '')
    setErrorMsg(null)
    setShowEditModal(true)
  }

  const resetForm = () => {
    setName('')
    setType('general')
    setDescription('')  // Añadido
    setParentId('')
    setErrorMsg(null)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(t('locale.code') === 'es' ? 'es-ES' : 'en-US', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount)
  }

  const isParentOptionDisabled = (targetId: string): boolean => {
    if (!selectedAccount) return false 
    if (targetId === selectedAccount.id) return true
    const error = validateParentAssignment(accounts, selectedAccount.id, targetId)
    return !!error
  }

  const totals = calculateTotalsByType(accounts)

  if (loading) {
    return <SkeletonList rows={4} />
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <Breadcrumbs items={[
            { label: t('accounts.title'), icon: <CreditCard size={16} /> }
          ]} />
          <h1 className="page-title" style={{ marginTop: '0.5rem' }}>{t('accounts.title')}</h1>
          <p className="page-subtitle">{t('accounts.subtitle')}</p>
        </div>
        <div className="d-flex gap-2">
          {/* Transfer button removed until fixed */}
          <button className="btn btn-primary" onClick={() => { resetForm(); setShowCreateModal(true); }}>
            <Plus size={20} />
            {t('accounts.new')}
          </button>
        </div>
      </div>

      {/* KPI Summary */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon kpi-icon-primary">
            <Wallet size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">{t('accounts.totalBalance')}</div>
            <div className="kpi-value">{formatCurrency(totals.total)}</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon kpi-icon-success">
            <PiggyBank size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">{t('nav.savings')}</div>
            <div className="kpi-value">{formatCurrency(totals.savings)}</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon kpi-icon-warning">
            <TrendingUp size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">{t('nav.investments')}</div>
            <div className="kpi-value">{formatCurrency(totals.broker)}</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon kpi-icon-primary">
            <CreditCard size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">{t('accounts.active')}</div>
            <div className="kpi-value">{totals.activeCount} / {totals.count}</div>
          </div>
        </div>
      </div>

      {/* Accounts List (Hierarchical) */}
      {accounts.length === 0 ? (
        <UiCard className="p-4 d-flex flex-col items-center justify-center text-center">
            <CreditCard size={48} className="text-secondary mb-4" />
            <p className="text-secondary">{t('accounts.empty')}</p>
            <button className="btn btn-primary mt-4" onClick={() => setShowCreateModal(true)}>
                {t('accounts.createFirst')}
            </button>
        </UiCard>
      ) : (
        <UiCard>
          <UiCardBody noPadding style={{ overflow: 'hidden' }}>
            <div className="table-container">
            <table className="table w-full">
              <thead>
                <tr>
                  <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left' }}>{t('accounts.name')}</th>
                  <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left' }}>{t('accounts.type')}</th>
                  <th style={{ padding: '0.75rem 1.5rem', textAlign: 'right' }}>{t('accounts.balance')}</th>
                  <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left' }}>{t('accounts.status')}</th>
                  <th style={{ padding: '0.75rem 1.5rem' }}></th>
                </tr>
              </thead>
              <tbody>
                {flatAccounts.map((acc) => (
                  <tr 
                    key={acc.id} 
                    style={{ opacity: !acc.is_active ? 0.5 : 1 }}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/app/accounts/${acc.id}`)}
                  >
                    <td style={{ padding: '0.75rem 1.5rem', fontWeight: 600 }}>
                      <div style={{ marginLeft: `${acc.level * 1.5}rem` }} className="d-flex items-center gap-2">
                        {acc.level > 0 && (
                          <div style={{ width: 8, height: 8, borderLeft: '1px solid var(--gray-400)', borderBottom: '1px solid var(--gray-400)', marginBottom: 4 }} />
                        )}
                        <span 
                          className="hover:text-primary cursor-pointer hover:underline"
                          onClick={() => navigate(`/app/accounts/${acc.id}`)}
                        >
                          {acc.name}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 1.5rem' }}>
                      <span className="badge badge-gray">{getAccountTypeLabel(acc.type)}</span>
                    </td>
                    <td style={{ padding: '0.75rem 1.5rem', textAlign: 'right', fontWeight: 600, color: acc.balance >= 0 ? 'var(--text-primary)' : 'var(--danger)' }}>
                      {formatCurrency(acc.balance)}
                    </td>
                    <td style={{ padding: '0.75rem 1.5rem' }}>
                      <span className={`badge ${acc.is_active ? 'badge-success' : 'badge-gray'}`}>
                        {acc.is_active ? t('accounts.active') : t('accounts.inactive')}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1.5rem' }}>
                      <div className="d-flex gap-1 justify-end">
                        <button
                          className="btn btn-icon btn-ghost"
                          onClick={() => openEditModal(acc)}
                          title={t('common.edit')}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          className={`btn btn-icon ${acc.is_active ? 'btn-ghost' : 'btn-success'}`}
                          onClick={() => handleToggle(acc)}
                          title={acc.is_active ? t('common.save') : t('common.edit')} 
                        >
                          {acc.is_active ? <PowerOff size={16} /> : <Power size={16} />}
                        </button>
                      </div>
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
        isOpen={showCreateModal} 
        onClose={() => setShowCreateModal(false)}
        width="500px"
      >
        <form onSubmit={handleCreate}>
          <UiModalHeader>{t('accounts.new')}</UiModalHeader>
          <UiModalBody>
            {errorMsg && (
                <div className="d-flex items-center gap-2 mb-4 p-2 bg-gray-50 border border-danger text-danger rounded">
                    <AlertTriangle size={16} />
                    <span>{errorMsg}</span>
                </div>
            )}

            <div className="form-group">
              <UiInput
                label={t('accounts.name')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Inversiones, Ahorro..."
                required
              />
            </div>

            <div className="form-group">
              <UiField label={t('accounts.type')}>
                <UiSelect
                  value={type}
                  onChange={(val: string) => setType(val as CreateAccountInput['type'])}
                  options={[
                    { value: 'general', label: 'General' },
                    { value: 'savings', label: 'Ahorro' },
                    { value: 'cash', label: 'Efectivo' },
                    { value: 'bank', label: 'Cuenta Bancaria' },
                    { value: 'broker', label: 'Broker / Inversión' },
                    { value: 'other', label: 'Otra' }
                  ]}
                />
              </UiField>
            </div>

            <div className="form-group">
              <UiField label={t('accounts.parent')}>
                <UiSelect
                  value={parentId}
                  onChange={(val: string) => setParentId(val)}
                  options={[
                    { value: '', label: 'Sin cuenta padre (Principal)' },
                    ...flatAccounts.map(acc => ({
                      value: acc.id,
                      label: `${'-- '.repeat(acc.level)}${acc.name}`
                    }))
                  ]}
                />
              </UiField>
            </div>
            <div className="form-group">
              <UiTextarea
                label="Descripción (opcional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Añade un comentario sobre esta cuenta..."
                rows={3}
              />
            </div>
          </UiModalBody>
          <UiModalFooter>
             <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
              {t('common.cancel')}
            </button>
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={submitting}
            >
              {submitting ? t('common.loading') : t('common.save')}
            </button>
          </UiModalFooter>
        </form>
      </UiModal>

      {/* Edit Modal */}
      <UiModal 
        isOpen={showEditModal && !!selectedAccount} 
        onClose={() => setShowEditModal(false)}
        width="500px"
      >
        <form onSubmit={handleEdit}>
          <UiModalHeader>{t('accounts.edit')}</UiModalHeader>
          <UiModalBody>
            {errorMsg && (
                <div className="d-flex items-center gap-2 mb-4 p-2 bg-gray-50 border border-danger text-danger rounded">
                    <AlertTriangle size={16} />
                    <span>{errorMsg}</span>
                </div>
            )}

            <div className="form-group">
              <UiInput
                label={t('accounts.name')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <UiField label={t('accounts.type')}>
                <UiSelect
                  value={type}
                  onChange={(val: string) => setType(val as CreateAccountInput['type'])}
                  options={[
                    { value: 'general', label: 'General' },
                    { value: 'savings', label: 'Ahorro' },
                    { value: 'cash', label: 'Efectivo' },
                    { value: 'bank', label: 'Cuenta Bancaria' },
                    { value: 'broker', label: 'Broker / Inversión' },
                    { value: 'other', label: 'Otra' }
                  ]}
                />
              </UiField>
            </div>

            <div className="form-group">
              <UiField label={t('accounts.parent')}>
                <UiSelect
                  value={parentId}
                  onChange={(val: string) => setParentId(val)}
                  options={[
                    { value: '', label: 'Sin cuenta padre (Principal)' },
                    ...flatAccounts.map(acc => ({
                      value: acc.id,
                      label: `${'-- '.repeat(acc.level)}${acc.name}`,
                      disabled: selectedAccount ? acc.id === selectedAccount.id : false
                    }))
                  ]}
                />
              </UiField>
            </div>
            <div className="form-group">
              <UiTextarea
                label="Descripción (opcional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Añade un comentario sobre esta cuenta..."
                rows={3}
              />
            </div>
          </UiModalBody>
          <UiModalFooter>
            <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
              {t('common.cancel')}
            </button>
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={submitting}
            >
              {submitting ? t('common.loading') : t('common.save')}
            </button>
          </UiModalFooter>
        </form>
      </UiModal>
    </div>
  )
}
