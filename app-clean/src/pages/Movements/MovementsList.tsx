import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { 
  fetchMovements, 
  fetchMonthlyMovements,
  fetchAccounts,
  createMovement,
  updateMovement,
  deleteMovement,
  getOrCreateCategory,
  calculateMonthlySummary,
  type Movement,
  type Account,
} from '../../services/movementService'
import { 
  createAccount, 
  accountTypes, 
  buildAccountTree, 
  flattenAccountTree
} from '../../services/accountService'
import { ensureDefaultAccountsForUser } from '../../services/authService'
import { getTextColorClass, getCategoryPillStyle } from '../../utils/categoryColors'
import { useSettings } from '../../context/SettingsContext'
import { 
  formatDate as formatDateUtil, 
  formatEUR 
} from '../../utils/format'
// Added formatISODateString
import { formatISODateString } from '../../utils/date'
import { Plus, TrendingUp, TrendingDown, X, ArrowUpDown, CreditCard, AlertCircle, ChevronDown, AlertTriangle, Pencil, Trash2 } from 'lucide-react'
// import { DayPicker } from 'react-day-picker' // Removed
// import { format } from 'date-fns' // Removed
// import { es } from 'date-fns/locale' // Removed
import { formatSupabaseError, mapSupabaseErrorToSpanish, type AppError } from '../../utils/errorUtils'

import { useI18n } from '../../hooks/useI18n'

import { UiSelect } from '../../components/ui/UiSelect'
import { UiDatePicker } from '../../components/ui/UiDatePicker'
import { UiField } from '../../components/ui/UiField'
import { UiInput } from '../../components/ui/UiInput'
import { UiNumber } from '../../components/ui/UiNumber'
import { CategoryPicker } from '../../components/domain/CategoryPicker' 
import { UiModal, UiModalHeader, UiModalBody, UiModalFooter } from '../../components/ui/UiModal'
import { SkeletonList } from '../../components/Skeleton'

// Define flattened account type extending Account to include tree metadata
interface FlatAccount extends Account {
  level?: number;
  children?: any[];
}

export default function MovementsList() {
  const { t } = useI18n()
  const { settings } = useSettings()
  const [movements, setMovements] = useState<Movement[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [flatAccounts, setFlatAccounts] = useState<FlatAccount[]>([]) // Flattened hierarchy for selectors
  // const [categories, setCategories] = useState<Category[]>([]) // Removed internal state
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 })

  // Form state
  // Use Date object for react-day-picker
  // Use Date object for react-day-picker
  const [date, setDate] = useState<Date>(new Date())
  // const [isDatePickerOpen, setIsDatePickerOpen] = useState(false) // Removed
  const [type, setType] = useState<'income' | 'expense' | 'investment'>('expense')
  const [accountId, setAccountId] = useState('')
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('') // Refactored from 'category' (name) to ID
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // Use AppError for detailed error reporting
  const [appError, setAppError] = useState<AppError | null>(null)

  // Account creation modal state
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [newAccountName, setNewAccountName] = useState('')
  const [newAccountType, setNewAccountType] = useState<string>('general')
  const [newAccountParentId, setNewAccountParentId] = useState<string>('') // New: parent selection
  const [creatingAccount, setCreatingAccount] = useState(false)
  const [newAccountError, setNewAccountError] = useState<string | null>(null)

  // Edit/Delete state
  const [editingMovement, setEditingMovement] = useState<Movement | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      // Ensure default accounts exist first
      await ensureDefaultAccountsForUser(user.id)

      const [movementsData, monthlyData, accountsData] = await Promise.all([
        fetchMovements(user.id),
        fetchMonthlyMovements(user.id),
        fetchAccounts(user.id)
      ])

      setMovements(movementsData)
      setAccounts(accountsData)
      
      // Calculate hierarchy
      // We cast to any because buildAccountTree expects AccountWithBalance but only needs id/parent_id structure mostly
      const tree = buildAccountTree(accountsData as any)
      const flat = flattenAccountTree(tree)
      setFlatAccounts(flat)

      // setCategories(categoriesData) // Removed: Categories loaded by CategoryPicker
      setSummary(calculateMonthlySummary(monthlyData))

      // Set default account (general)
      const generalAccount = accountsData.find(a => a.type === 'general')
      if (generalAccount) setAccountId(generalAccount.id)
      else if (accountsData.length > 0) setAccountId(accountsData[0].id)
    } catch (err) {
      console.error('Error loading data:', err)
      setAppError({ message: 'Error al cargar los datos' })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setAppError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (!amount || parseFloat(amount) <= 0) {
      setAppError({ message: 'El importe debe ser mayor que 0' })
      setSubmitting(false)
      return
    }

    try {
      // Handle Category Logic (Existing ID vs New Name)
      let finalCategoryId: string | null = null
      
      if (categoryId) {
          if (categoryId.startsWith('__new__:')) {
             // Create new category
             const newName = categoryId.replace('__new__:', '').trim()
             const catKind = type === 'income' ? 'income' : 'expense'
             try {
                const cat = await getOrCreateCategory(user.id, newName, catKind)
                finalCategoryId = cat.id
             } catch (catErr) {
                 console.error("Error creating category", catErr)
                 // Fallback or rethrow? 
                 throw catErr
             }
          } else {
             // Existing ID
             finalCategoryId = categoryId
          }
      }

      const movementData = {
        user_id: user.id,
        account_id: accountId,
        kind: type as 'income' | 'expense' | 'investment',
        amount: parseFloat(amount),
        date: formatISODateString(date),
        description: description || null,
        category_id: finalCategoryId
      }

      if (editingMovement) {
        // Update existing movement
        await updateMovement(editingMovement.id, movementData)
      } else {
        // Create new movement
        await createMovement(movementData)
      }

      setShowModal(false)
      resetForm()
      loadData() 
    } catch (err) {
      console.error('Error creating movement:', err)
      // Format the error to extract details
      const formattedError = formatSupabaseError(err)
      setAppError(formattedError)
      // Keep modal open to show error
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setDate(new Date())
    setType('expense')
    setAmount('')
    setCategoryId('')
    setDescription('')
    setAppError(null)
    setEditingMovement(null)
    const generalAccount = accounts.find(a => a.type === 'general')
    if (generalAccount) setAccountId(generalAccount.id)
  }

  // Edit movement - populate form
  const handleEdit = (mov: Movement) => {
    setEditingMovement(mov)
    setDate(new Date(mov.date))
    setType(mov.kind as 'income' | 'expense' | 'investment')
    setAccountId(mov.account_id)
    setAmount(String(mov.amount))
    setCategoryId(mov.category_id || '')
    setDescription(mov.description || '')
    setShowModal(true)
  }

  // Delete movement with confirmation
  const handleDelete = async (movementId: string) => {
    if (!confirm('¿Eliminar este movimiento? Esta acción no se puede deshacer.')) {
      return
    }
    
    setDeletingId(movementId)
    try {
      await deleteMovement(movementId)
      // Remove from local state
      setMovements(movements.filter(m => m.id !== movementId))
      // Recalculate summary
      const newMovements = movements.filter(m => m.id !== movementId)
      setSummary(calculateMonthlySummary(newMovements))
    } catch (err) {
      console.error('Error deleting movement:', err)
      alert('Error al eliminar el movimiento')
    } finally {
      setDeletingId(null)
    }
  }

  // Get dynamic label for account field based on movement type
  const getAccountLabel = () => {
    switch (type) {
      case 'income': return t('movements.accountDest')
      case 'expense': return t('movements.accountSource')
      case 'investment': return t('movements.accountSource')
      default: return t('movements.account')
    }
  }

  // Handle account selection, including "create new" option
  const handleAccountSelectChange = (value: string) => {
    if (value === '__create_new__') {
      setShowAccountModal(true)
    } else {
      setAccountId(value)
    }
  }

  // Handle creating new account from modal
  const handleCreateAccount = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !newAccountName.trim()) return

    setCreatingAccount(true)
    setNewAccountError(null)

    try {
      const newAccount = await createAccount({
        user_id: user.id,
        name: newAccountName.trim(),
        type: newAccountType as 'general' | 'savings' | 'cash' | 'bank' | 'broker' | 'other',
        parent_account_id: newAccountParentId || null
      })
      
      // Update local state without full reload
      const updatedAccounts = [...accounts, newAccount]
      setAccounts(updatedAccounts)
      
      // Re-calculate hierarchy
      const tree = buildAccountTree(updatedAccounts as any)
      const flat = flattenAccountTree(tree)
      setFlatAccounts(flat)

      setAccountId(newAccount.id)
      resetAccountModal()
    } catch (err: any) {
      console.error('Error creating account:', err)
      setNewAccountError('No se pudo crear la cuenta. ' + (err.message || ''))
    } finally {
      setCreatingAccount(false)
    }
  }

  const resetAccountModal = () => {
    setShowAccountModal(false)
    setNewAccountName('')
    setNewAccountType('general')
    setNewAccountParentId('')
    setNewAccountError(null)
  }

  const formatDate = (dateStr: string) => {
    return formatDateUtil(dateStr, settings)
  }

  const formatCurrency = (amount: number) => {
    return formatEUR(amount, settings)
  }

  const getTypeLabel = (typeKey: string) => {
    switch (typeKey) {
      case 'income': return t('movements.type.income')
      case 'expense': return t('movements.type.expense')
      case 'investment': return t('movements.type.investment')
      default: return typeKey
    }
  }

  const getTypeColor = (t: string) => {
    switch (t) {
      case 'income': return 'var(--success)'
      case 'expense': return 'var(--danger)'
      default: return 'var(--primary)'
    }
  }

  if (loading) {
    return <SkeletonList rows={8} />
  }

  return (
    <div>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>{t('movements.title')}</h1>
          <p style={styles.subtitle}>{t('movements.subtitle')}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={20} />
          {t('movements.new')}
        </button>
      </div>

      {/* Monthly Summary */}
      <div style={styles.summaryGrid}>
        <div style={{ ...styles.summaryCard, borderLeft: '4px solid var(--success)' }}>
          <div style={styles.summaryLabel}>{t('movements.income')}</div>
          <div style={{ ...styles.summaryValue, color: 'var(--success)' }}>
            +{formatCurrency(summary.income)}
          </div>
        </div>
        <div style={{ ...styles.summaryCard, borderLeft: '4px solid var(--danger)' }}>
          <div style={styles.summaryLabel}>{t('movements.expenses')}</div>
          <div style={{ ...styles.summaryValue, color: 'var(--danger)' }}>
            -{formatCurrency(summary.expense)}
          </div>
        </div>
        <div style={{ ...styles.summaryCard, borderLeft: `4px solid ${summary.balance >= 0 ? 'var(--success)' : 'var(--danger)'}` }}>
          <div style={styles.summaryLabel}>{t('movements.balance')}</div>
          <div style={{ ...styles.summaryValue, color: summary.balance >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {summary.balance >= 0 ? '+' : ''}{formatCurrency(summary.balance)}
          </div>
        </div>
      </div>

      {/* Movements List */}
      {movements.length === 0 ? (
        <div className="card text-center" style={{ padding: '3rem' }}>
          <ArrowUpDown size={48} style={{ color: 'var(--gray-300)', marginBottom: '1rem' }} />
          <p className="text-gray-500">{t('movements.empty')}</p>
          <button className="btn btn-primary mt-4" onClick={() => setShowModal(true)}>
            {t('movements.createFirst')}
          </button>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>{t('common.date')}</th>
                <th>{t('common.type')}</th>
                <th>{t('common.account')}</th>
                <th>{t('common.category')}</th>
                <th>{t('common.description')}</th>
                <th style={{ textAlign: 'right' }}>{t('common.amount')}</th>
                <th style={{ textAlign: 'center', width: '100px' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((mov) => (
                <tr key={mov.id}>
                  <td>{formatDate(mov.date)}</td>
                  <td>
                    <span className="flex items-center gap-2">
                      {mov.kind === 'income' ? (
                        <TrendingUp size={16} style={{ color: 'var(--success)' }} />
                      ) : mov.kind === 'expense' ? (
                        <TrendingDown size={16} style={{ color: 'var(--danger)' }} />
                      ) : (
                        <ArrowUpDown size={16} style={{ color: 'var(--primary)' }} />
                      )}
                      {getTypeLabel(mov.kind)}
                    </span>
                  </td>
                  <td>{mov.account?.name || '-'}</td>
                  <td>
                    {mov.category ? (
                      <span
                        className={`category-pill ${getTextColorClass(mov.category.color)}`}
                        style={getCategoryPillStyle(mov.category.color)}
                      >
                        {mov.category.name}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="text-gray-500">{mov.description || '-'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: getTypeColor(mov.kind) }}>
                    {mov.kind === 'income' ? '+' : mov.kind === 'expense' ? '-' : ''}
                    {formatCurrency(mov.amount)}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        className="btn btn-icon btn-ghost btn-sm"
                        onClick={() => handleEdit(mov)}
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-icon btn-ghost btn-sm text-danger"
                        onClick={() => handleDelete(mov.id)}
                        disabled={deletingId === mov.id}
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      <UiModal 
        isOpen={showModal} 
        onClose={() => { setShowModal(false); resetForm(); }}
        width="500px"
      >
        <form onSubmit={handleSubmit}>
          <UiModalHeader>{editingMovement ? 'Editar movimiento' : t('movements.new')}</UiModalHeader>
          <UiModalBody>
            {appError && (
              <div className="alert alert-danger mb-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="shrink-0 mt-0.5 text-danger" size={18} />
                  <div className="flex-1 overflow-hidden">
                    {(() => {
                      const friendly = mapSupabaseErrorToSpanish(appError);
                      return (
                        <>
                          <h4 className="font-semibold text-sm text-danger-dark">{friendly.title}</h4>
                          <p className="text-xs text-danger-dark mt-1 opacity-90">{friendly.description}</p>
                          {friendly.action && (
                            <div className="mt-2 p-2 bg-white/50 rounded text-xs font-medium text-danger-dark border border-danger/10">
                              <strong>Sugerencia:</strong> {friendly.action}
                            </div>
                          )}
                        </>
                      );
                    })()}
                    
                    {/* Collapsible Details */}
                    {appError.details && (
                      <details className="mt-2 text-xs opacity-80 cursor-pointer text-danger-dark">
                        <summary className="hover:underline flex items-center gap-1">
                          <ChevronDown size={12} />
                          Detalles técnicos
                        </summary>
                        <div className="mt-1 p-2 bg-white/50 rounded overflow-x-auto border border-danger/10">
                          <p className="font-mono text-[10px] break-all whitespace-pre-wrap text-gray-700">
                            {JSON.stringify(appError, null, 2)}
                          </p>
                        </div>
                      </details>
                    )}
                  </div>
                  <button onClick={() => setAppError(null)} className="text-danger opacity-70 hover:opacity-100">
                    <X size={16}/>
                  </button>
                </div>
              </div>
            )}

            <div className="mb-4">
              <UiDatePicker
                label={t('common.date')}
                value={date}
                onChange={(d) => d && setDate(d)}
              />
            </div>

            <div className="mb-4">
              <UiField label={t('common.type')} error={undefined}>
                  <UiSelect
                    value={type}
                    onChange={(val) => setType(val as 'income' | 'expense' | 'investment')}
                    options={[
                      { value: 'income', label: t('movements.type.income') },
                      { value: 'expense', label: t('movements.type.expense') },
                      { value: 'investment', label: t('movements.type.investment') }
                    ]}
                  />
              </UiField>
            </div>

            <div className="mb-4">
              {accounts.length === 0 ? (
                <div style={styles.noAccountsBox}>
                  <CreditCard size={32} style={{ color: 'var(--gray-400)', marginBottom: '0.75rem' }} />
                  <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                    {t('movements.noAccount')}
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setShowAccountModal(true)}
                  >
                    <Plus size={18} />
                    {t('accounts.createFirst')}
                  </button>
                </div>
              ) : (
                <UiField label={getAccountLabel()}>
                    <UiSelect
                      value={accountId}
                      onChange={handleAccountSelectChange}
                      options={[
                        ...flatAccounts.map(acc => ({
                          value: acc.id,
                          label: '\u00A0\u00A0'.repeat(acc.level || 0) + ((acc.level || 0) > 0 ? '— ' : '') + acc.name
                        })),
                        { value: '__create_new__', label: '+ ' + t('accounts.new') }
                      ]}
                    />
                </UiField>
              )}
            </div>

            <div className="mb-4">
              <UiNumber
                label={`${t('common.amount')} (€)`}
                value={amount}
                onChange={(val) => setAmount(val)}
                placeholder="0.00"
                step="0.01"
                min={0.01}
                // required // Handled by validation manually
              />
            </div>

            <div className="mb-4">
              <CategoryPicker
                label={t('common.category')}
                type={type === 'income' ? 'income' : 'expense'}
                value={categoryId}
                onChange={setCategoryId}
              />
            </div>

            <div className="mb-4">
              <UiInput
                label={`${t('common.description')} (${t('common.optional')})`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={`${t('common.description')}...`}
              />
            </div>
          </UiModalBody>
          <UiModalFooter>
             <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? t('common.saving') : t('common.save')}
            </button>
          </UiModalFooter>
        </form>
      </UiModal>

      {/* Account Creation Modal */}
      <UiModal 
        isOpen={showAccountModal} 
        onClose={() => resetAccountModal()}
        width="400px"
      >
        <UiModalHeader>{t('accounts.new')}</UiModalHeader>
        <div className="modal-body">
          {newAccountError && (
              <div className="p-3 mb-4 bg-red-50 text-red-600 rounded-md text-sm flex items-start gap-2">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <span>{newAccountError}</span>
              </div>
          )}
          <div className="mb-4">
            <UiInput
              label={t('accounts.name')}
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
              placeholder="Ej: Cuenta corriente, Efectivo..."
              autoFocus
            />
          </div>
          <div className="mb-4">
            <UiField label={t('accounts.type')}>
                <UiSelect
                  value={newAccountType}
                  onChange={setNewAccountType}
                  options={accountTypes}
                />
            </UiField>
          </div>
          <div className="mb-4">
            <UiField label={t('accounts.parent')}>
                <UiSelect
                   value={newAccountParentId}
                   onChange={setNewAccountParentId}
                   placeholder={t('accounts.noParent') || 'Ninguna'}
                   options={[
                     { value: '', label: t('accounts.noParent') || 'Sin cuenta padre' },
                     ...flatAccounts.map(a => ({
                        value: a.id,
                        label: '\u00A0\u00A0'.repeat(a.level || 0) + ((a.level || 0) > 0 ? '— ' : '') + a.name
                     }))
                   ]}
                />
            </UiField>
          </div>
        </div>
        <UiModalFooter>
          <button type="button" className="btn btn-secondary" onClick={() => resetAccountModal()}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleCreateAccount}
            disabled={creatingAccount || !newAccountName.trim()}
          >
            {creatingAccount ? t('common.creating') : t('common.create')}
          </button>
        </UiModalFooter>
      </UiModal>
    </div>
  )
}

const styles: { [key: string]: React.CSSProperties } = {
  header: {
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
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  summaryCard: {
    background: 'white',
    borderRadius: 'var(--border-radius)',
    boxShadow: 'var(--shadow)',
    padding: '1.25rem',
  },
  summaryLabel: {
    fontSize: '0.75rem',
    color: 'var(--gray-500)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '0.5rem',
  },
  summaryValue: {
    fontSize: '1.5rem',
    fontWeight: 700,
  },
  error: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid var(--danger)',
    color: 'var(--danger)',
    padding: '0.75rem',
    borderRadius: 'var(--border-radius)',
    fontSize: '0.875rem',
    marginBottom: '1rem',
  },
  noAccountsBox: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5rem',
    background: 'var(--gray-50)',
    borderRadius: 'var(--border-radius)',
    textAlign: 'center' as const,
  },
}
