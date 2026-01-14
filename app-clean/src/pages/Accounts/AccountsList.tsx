import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useWorkspace } from '../../context/WorkspaceContext'
import {
  getAccountsWithBalances,
  createAccount,
  updateAccount,
  createTransfer,
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
import { UiNumber } from '../../components/ui/UiNumber'
import { UiTextarea } from '../../components/ui/UiTextarea'
import { UiDatePicker } from '../../components/ui/UiDatePicker'
import { UiModal, UiModalHeader, UiModalBody, UiModalFooter } from '../../components/ui/UiModal'
import { Plus, Edit2, Power, PowerOff, ArrowRightLeft, CreditCard, Wallet, PiggyBank, TrendingUp, AlertTriangle } from 'lucide-react'
import { Breadcrumbs } from '../../components/Breadcrumbs'
import { SkeletonList } from '../../components/Skeleton'
import { formatISODateString } from '../../utils/date'
import { useToast } from '../../components/Toast'

export default function AccountsList() {
  const navigate = useNavigate()
  const { t, language } = useI18n()
  const { settings } = useSettings()
  const { currentWorkspace } = useWorkspace()  // Add workspace context
  const toast = useToast()
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
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  
  // Transfer modal state
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [fromAccountId, setFromAccountId] = useState('')
  const [toAccountId, setToAccountId] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [transferDate, setTransferDate] = useState(formatISODateString(new Date()))
  const [transferDescription, setTransferDescription] = useState('')
  const [transferError, setTransferError] = useState<string | null>(null)

  // Reload when workspace changes
  useEffect(() => {
    loadData()
  }, [currentWorkspace])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      const orgId = currentWorkspace?.id || null
      const data = await getAccountsWithBalances(user.id, orgId)
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
        organization_id: currentWorkspace?.id || null,  // Include workspace
        name, 
        type,
        description: description || null,
        parent_account_id: parentId || null 
      })
      setShowCreateModal(false)
      resetForm()
      loadData()
      toast.success('Cuenta creada', `La cuenta "${name}" se ha creado correctamente`)
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
      toast.success('Cuenta actualizada', `Los cambios en "${name}" se han guardado`)
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
  
  const resetTransferForm = () => {
    setFromAccountId('')
    setToAccountId('')
    setTransferAmount('')
    setTransferDate(formatISODateString(new Date()))
    setTransferDescription('')
    setTransferError(null)
  }
  
  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    setTransferError(null)
    
    // Validations
    if (!fromAccountId) {
      setTransferError('Selecciona una cuenta de origen')
      return
    }
    if (!toAccountId) {
      setTransferError('Selecciona una cuenta de destino')
      return
    }
    if (fromAccountId === toAccountId) {
      setTransferError('Las cuentas de origen y destino deben ser diferentes')
      return
    }
    const amount = parseFloat(transferAmount)
    if (isNaN(amount) || amount <= 0) {
      setTransferError('Introduce un importe válido mayor a 0')
      return
    }
    
    setSubmitting(true)
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setTransferError('No se pudo obtener el usuario')
      setSubmitting(false)
      return
    }
    
    try {
      await createTransfer(
        user.id,
        fromAccountId,
        toAccountId,
        amount,
        transferDate,
        transferDescription || undefined,
        currentWorkspace?.id || null
      )
      setShowTransferModal(false)
      resetTransferForm()
      loadData()
      
      // Show success toast with transfer details
      const fromAccount = accounts.find(a => a.id === fromAccountId)
      const toAccount = accounts.find(a => a.id === toAccountId)
      toast.success(
        'Transferencia completada',
        `${formatCurrency(amount)} transferidos de ${fromAccount?.name || 'cuenta'} a ${toAccount?.name || 'cuenta'}`
      )
    } catch (error: any) {
      console.error('Error creating transfer:', error)
      setTransferError('Error al crear la transferencia. ' + (error.message || ''))
    } finally {
      setSubmitting(false)
    }
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
          <button className="btn btn-secondary" onClick={() => { resetTransferForm(); setShowTransferModal(true); }}>
            <ArrowRightLeft size={20} />
            {t('accounts.transfer')}
          </button>
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
                        <span className="hover:text-primary hover:underline">
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
                          onClick={(e) => { e.stopPropagation(); openEditModal(acc); }}
                          title={t('common.edit')}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          className={`btn btn-icon ${acc.is_active ? 'btn-ghost' : 'btn-success'}`}
                          onClick={(e) => { e.stopPropagation(); handleToggle(acc); }}
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

      {/* Transfer Modal */}
      <UiModal 
        isOpen={showTransferModal} 
        onClose={() => setShowTransferModal(false)}
        width="500px"
      >
        <form onSubmit={handleTransfer}>
          <UiModalHeader>{t('accounts.transferTitle')}</UiModalHeader>
          <UiModalBody>
            {transferError && (
              <div className="d-flex items-center gap-2 mb-4 p-2 bg-gray-50 border border-danger text-danger rounded">
                <AlertTriangle size={16} />
                <span>{transferError}</span>
              </div>
            )}

            <div className="form-group">
              <UiField label="Cuenta de Origen">
                <UiSelect
                  value={fromAccountId}
                  onChange={(val: string) => {
                    setFromAccountId(val)
                    // Reset destination if same as new origin
                    if (val === toAccountId) setToAccountId('')
                  }}
                  options={[
                    { value: '', label: 'Selecciona una cuenta...' },
                    ...accounts.filter(a => a.is_active).map(acc => ({
                      value: acc.id,
                      label: `${acc.name} (${formatCurrency(acc.balance)})`
                    }))
                  ]}
                />
              </UiField>
            </div>

            <div className="form-group">
              <UiField label="Cuenta de Destino">
                <UiSelect
                  value={toAccountId}
                  onChange={(val: string) => setToAccountId(val)}
                  options={[
                    { value: '', label: 'Selecciona una cuenta...' },
                    ...accounts
                      .filter(a => a.is_active && a.id !== fromAccountId)
                      .map(acc => ({
                        value: acc.id,
                        label: `${acc.name} (${formatCurrency(acc.balance)})`
                      }))
                  ]}
                />
              </UiField>
            </div>

            <div className="form-group">
              <UiNumber
                label="Importe (€)"
                value={transferAmount}
                onChange={(val: string) => setTransferAmount(val)}
                placeholder="0.00"
                step="0.01"
                min={0.01}
                required
              />
            </div>

            <div className="form-group">
              <UiField label="Fecha">
                <UiDatePicker
                  value={transferDate}
                  onChange={(d) => setTransferDate(d ? formatISODateString(d) : '')}
                  required
                />
              </UiField>
            </div>

            <div className="form-group">
              <UiInput
                label="Descripción (opcional)"
                value={transferDescription}
                onChange={(e) => setTransferDescription(e.target.value)}
                placeholder="Ej: Traspaso a ahorro mensual"
              />
            </div>
          </UiModalBody>
          <UiModalFooter>
            <button type="button" className="btn btn-secondary" onClick={() => setShowTransferModal(false)}>
              {t('common.cancel')}
            </button>
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={submitting || !fromAccountId || !toAccountId || !transferAmount}
            >
              {submitting ? t('common.loading') : t('accounts.transfer')}
            </button>
          </UiModalFooter>
        </form>
      </UiModal>
    </div>
  )
}
