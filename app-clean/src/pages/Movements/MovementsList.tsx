import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useWorkspace } from '../../context/WorkspaceContext'
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
import {
  Plus,
  Edit2,
  Trash2,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  Calendar,
  Wallet,
  ChevronRight,
  Search,
  Pencil,
  AlertTriangle,
  X,
  CreditCard
} from 'lucide-react'
// import { DayPicker } from 'react-day-picker' // Removed
// import { format } from 'date-fns' // Removed
// import { es } from 'date-fns/locale' // Removed
import { formatSupabaseError, type AppError } from '../../utils/errorUtils'
import { ExportMenu } from '../../components/shared/ExportMenu'
import { ExcelColumn } from '../../utils/excelExport'

import { useI18n } from '../../hooks/useI18n'

import { UiSelect } from '../../components/ui/UiSelect'
import { UiDatePicker } from '../../components/ui/UiDatePicker'
import { UiField } from '../../components/ui/UiField'
import { UiInput } from '../../components/ui/UiInput'
import { UiNumber } from '../../components/ui/UiNumber'
import { CategoryPicker } from '../../components/domain/CategoryPicker' 
import { UiModal, UiModalHeader, UiModalBody, UiModalFooter } from '../../components/ui/UiModal'
import { SkeletonList } from '../../components/Skeleton'
import { useToast } from '../../components/Toast'

// Define flattened account type extending Account to include tree metadata
interface FlatAccount extends Account {
  level?: number;
  children?: any[];
}

export default function MovementsList() {
  const { t } = useI18n()
  const { settings } = useSettings()
  const { currentWorkspace } = useWorkspace()  // Add workspace context
  const toast = useToast() // Toast notifications
  const [movements, setMovements] = useState<Movement[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [flatAccounts, setFlatAccounts] = useState<FlatAccount[]>([]) // Flattened hierarchy for selectors
  // const [categories, setCategories] = useState<Category[]>([]) // Removed internal state
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 })

  // Export & Filter State
  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [endDate, setEndDate] = useState<Date | undefined>(undefined)
  const [searchTerm, setSearchTerm] = useState('')


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

  // Reload when workspace changes
  useEffect(() => {
    loadData()
  }, [currentWorkspace])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      const orgId = currentWorkspace?.id || null
      // Ensure default accounts exist first
      await ensureDefaultAccountsForUser(user.id)

      const [movementsData, monthlyData, accountsData] = await Promise.all([
        fetchMovements(user.id, 50, orgId),
        fetchMonthlyMovements(user.id, orgId),
        fetchAccounts(user.id, orgId)
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
        organization_id: currentWorkspace?.id || null,  // Include workspace
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
        toast.success('Movimiento actualizado', 'Los cambios se han guardado correctamente')
      } else {
        // Create new movement
        await createMovement(movementData)
        toast.success('Movimiento registrado', type === 'income' ? '¡Ingreso añadido!' : type === 'expense' ? 'Gasto registrado' : 'Inversión guardada')
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
        organization_id: currentWorkspace?.id || null, // Include workspace!
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

  const getExportColumns = (): ExcelColumn[] => [
    { header: 'Fecha', key: 'date', width: 12 },
    { header: 'Tipo', key: 'kind', width: 12 },
    { header: 'Categoría', key: 'category', width: 20 },
    { header: 'Descripción', key: 'description', width: 40 },
    { header: 'Importe', key: 'amount', width: 15 },
    { header: 'Cuenta', key: 'account', width: 20 },
    { header: 'Creador', key: 'creator', width: 25 },
    { header: 'Fecha Registro', key: 'created_at', width: 20 }
  ]

  const fetchExportData = async () => {
      try {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) return []

          // 1. Base Query
          let query = supabase
              .from('movements')
              .select(`
                  *,
                  category:categories(name),
                  account:accounts(name)
              `)
              .eq('user_id', user.id)
              .order('date', { ascending: false })

          if (currentWorkspace?.id) {
              query = query.eq('organization_id', currentWorkspace.id)
          } else {
              query = query.is('organization_id', null)
          }

          if (startDate) {
              query = query.gte('date', formatISODateString(startDate))
          }
          if (endDate) {
               query = query.lte('date', formatISODateString(endDate))
          }

          const { data, error } = await query

          if (error) throw error
          if (!data || data.length === 0) {
              // Alert handled by ExportMenu if empty
              return []
          }

          // 2. Fetch Profiles Manually (to avoid FK issues) and merge
          let movementsToExport = data
          if (data.length > 0) {
              const uniqueUserIds = [...new Set(data.map(m => m.user_id))]
              const { data: profiles } = await supabase
                  .from('profiles')
                  .select('id, display_name, email')
                  .in('id', uniqueUserIds)
              
              if (profiles) {
                  const profileMap = new Map(profiles.map(p => [p.id, p]))
                  movementsToExport = data.map(m => ({
                      ...m,
                      creator: profileMap.get(m.user_id)
                  }))
              }
          }

          return movementsToExport.map(m => ({
              date: m.date,
              kind: m.kind === 'income' ? 'Ingreso' : m.kind === 'expense' ? 'Gasto' : 'Inversión',
              description: m.description || '',
              amount: m.amount,
              category: m.category?.name || 'Sin categoría',
              account: m.account?.name || 'Sin cuenta',
              creator: m.creator ? (m.creator.display_name || m.creator.email) : '-',
              created_at: m.created_at ? new Date(m.created_at).toLocaleString('es-ES') : '-'
          }))

      } catch (err) {
          console.error("Export error", err)
          throw err
      }
  }

  if (loading) {
    return <SkeletonList rows={8} />
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('movements.title')}</h1>
          <p className="page-subtitle">{t('movements.subtitle')}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={20} />
          {t('movements.new')}
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
         {/* Premium Search Input */}
         <div style={{ 
           position: 'relative', 
           flex: '1 1 280px',
           maxWidth: 360
         }}>
           <div style={{
             position: 'absolute',
             left: 14,
             top: '50%',
             transform: 'translateY(-50%)',
             width: 18,
             height: 18,
             borderRadius: '50%',
             background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(59,130,246,0.2))',
             display: 'flex',
             alignItems: 'center',
             justifyContent: 'center'
           }}>
             <Search size={12} style={{ color: '#10b981' }} />
           </div>
           <input
             type="text"
             placeholder="Buscar por descripción, categoría, cuenta..."
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
             style={{
               width: '100%',
               padding: '12px 16px 12px 44px',
               fontSize: 13,
               fontWeight: 500,
               color: '#e2e8f0',
               background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
               border: '1px solid #334155',
               borderRadius: 12,
               outline: 'none',
               transition: 'all 0.2s ease',
               boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
             }}
             onFocus={(e) => {
               e.currentTarget.style.borderColor = '#10b981'
               e.currentTarget.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.15), inset 0 2px 4px rgba(0,0,0,0.1)'
             }}
             onBlur={(e) => {
               e.currentTarget.style.borderColor = '#334155'
               e.currentTarget.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.1)'
             }}
           />
           {searchTerm && (
             <button
               onClick={() => setSearchTerm('')}
               style={{
                 position: 'absolute',
                 right: 12,
                 top: '50%',
                 transform: 'translateY(-50%)',
                 width: 20,
                 height: 20,
                 borderRadius: '50%',
                 background: 'rgba(239,68,68,0.15)',
                 border: 'none',
                 display: 'flex',
                 alignItems: 'center',
                 justifyContent: 'center',
                 cursor: 'pointer',
                 transition: 'all 0.15s'
               }}
               onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.25)'}
               onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.15)'}
             >
               <X size={12} style={{ color: '#ef4444' }} />
             </button>
           )}
         </div>
         
         <div style={{ height: 28, width: 1, background: '#334155' }} />
         
         <div className="flex items-center gap-2">
             <Calendar size={16} className="text-gray-400" />
             <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Exportar:</span>
         </div>
         <div className="w-40">
             <UiDatePicker 
                label=""
                value={startDate || null} 
                onChange={(d) => setStartDate(d || undefined)} 
                placeholder="Desde"
             />
         </div>
         <div className="w-40">
             <UiDatePicker 
                label=""
                value={endDate || null} 
                onChange={(d) => setEndDate(d || undefined)}
                placeholder="Hasta" 
             />
         </div>
         <div className="ml-auto">
             <ExportMenu 
                 fetchData={fetchExportData}
                 columns={getExportColumns()}
                 filename={`movimientos_${new Date().toISOString().split('T')[0]}`}
                 buttonLabel="Exportar"
             />
         </div>
      </div>

      {/* Monthly Summary */}
      <div className="kpi-grid">
        <div className="kpi-card" style={{ borderLeft: '4px solid var(--success)' }}>
          <div className="kpi-content">
            <div className="kpi-label">{t('movements.income')}</div>
            <div className="kpi-value text-success">
              +{formatCurrency(summary.income)}
            </div>
          </div>
        </div>
        <div className="kpi-card" style={{ borderLeft: '4px solid var(--danger)' }}>
          <div className="kpi-content">
            <div className="kpi-label">{t('movements.expenses')}</div>
            <div className="kpi-value text-danger">
              -{formatCurrency(summary.expense)}
            </div>
          </div>
        </div>
        <div className="kpi-card" style={{ borderLeft: `4px solid ${summary.balance >= 0 ? 'var(--success)' : 'var(--danger)'}` }}>
          <div className="kpi-content">
            <div className="kpi-label">{t('movements.balance')}</div>
            <div className="kpi-value" style={{ color: summary.balance >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {summary.balance >= 0 ? '+' : ''}{formatCurrency(summary.balance)}
            </div>
          </div>
        </div>
      </div>

      {/* Movements List */}
      {(() => {
        // Filter movements by search term
        const filteredMovements = movements.filter(mov => {
          if (!searchTerm.trim()) return true
          const term = searchTerm.toLowerCase()
          return (
            (mov.description?.toLowerCase().includes(term)) ||
            (mov.category?.name?.toLowerCase().includes(term)) ||
            (mov.account?.name?.toLowerCase().includes(term)) ||
            (String(mov.amount).includes(term))
          )
        })
        
        return filteredMovements.length === 0 ? (
        <div className="section-card flex flex-col items-center justify-center p-12 text-center">
          <ArrowUpDown size={48} className="text-gray-300 mb-4" />
          <p className="text-gray-500 mb-4">{t('movements.empty')}</p>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            {t('movements.createFirst')}
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-800/50">
                  <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderTopLeftRadius: '0.75rem' }}>📅 {t('common.date')}</th>
                  <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📊 {t('common.type')}</th>
                  <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🏦 {t('common.account')}</th>
                  <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🏷️ {t('common.category')}</th>
                  <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📝 {t('common.description')}</th>
                  {currentWorkspace && (
                    <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>👤 Creado por</th>
                  )}
                  <th style={{ padding: '0.75rem 1.5rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>💰 {t('common.amount')}</th>
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', borderTopRightRadius: '0.75rem' }}>⚙️</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.map((mov) => (
                  <tr key={mov.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td style={{ padding: '0.75rem 1.5rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatDate(mov.date)}</div>
                    </td>
                    <td style={{ padding: '0.75rem 1.5rem' }}>
                      <span 
                        className="inline-flex items-center gap-1.5 text-sm font-semibold"
                        style={{ 
                          color: mov.kind === 'income' ? 'var(--success)' : mov.kind === 'expense' ? 'var(--danger)' : 'var(--primary)'
                        }}
                      >
                        {mov.kind === 'income' ? (
                          <TrendingUp size={14} />
                        ) : mov.kind === 'expense' ? (
                          <TrendingDown size={14} />
                        ) : (
                          <ArrowUpDown size={14} />
                        )}
                        {getTypeLabel(mov.kind)}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1.5rem', color: 'var(--text-secondary)' }}>
                      {mov.account?.name || '-'}
                    </td>
                    <td style={{ padding: '0.75rem 1.5rem' }}>
                      {mov.category ? (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                          style={{ 
                            backgroundColor: `${mov.category.color}15`, 
                            color: mov.category.color 
                          }}
                        >
                          {mov.category.name}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 1.5rem', color: 'var(--text-secondary)', maxWidth: '200px' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={mov.description || ''}>
                        {mov.description || '-'}
                      </div>
                    </td>
                    {currentWorkspace && (
                      <td style={{ padding: '0.75rem 1.5rem' }}>
                        {mov.creator ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{
                              width: 24, height: 24, borderRadius: '50%',
                              background: 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: 'white', fontSize: '0.65rem', fontWeight: 600
                            }}>
                              {(mov.creator.display_name || mov.creator.email || '?').charAt(0).toUpperCase()}
                            </div>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              {mov.creator.display_name || mov.creator.email?.split('@')[0] || 'Usuario'}
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>-</span>
                        )}
                      </td>
                    )}
                    <td style={{ padding: '0.75rem 1.5rem', textAlign: 'right' }}>
                      <span style={{ fontWeight: 700, color: getTypeColor(mov.kind) }}>
                        {mov.kind === 'income' ? '+' : mov.kind === 'expense' ? '-' : ''}
                        {formatCurrency(mov.amount)}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          className="btn btn-icon btn-secondary"
                          onClick={() => handleEdit(mov)}
                          title="Editar"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-icon btn-danger"
                          onClick={() => handleDelete(mov.id)}
                          disabled={deletingId === mov.id}
                          title="Eliminar"
                        >
                          {deletingId === mov.id ? (
                            <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent" />
                          ) : (
                            <Trash2 size={16} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
      })()}

      {/* Movement Modal */}
      {showModal && (
        <UiModal isOpen={showModal} onClose={() => { setShowModal(false); resetForm(); }}>
          <UiModalHeader>
            {editingMovement ? t('movements.editTitle') : t('movements.newTitle')}
          </UiModalHeader>
          <form onSubmit={handleSubmit}>
            <UiModalBody>
              {appError && (
                <div className="mb-4 p-3 bg-danger/10 text-danger rounded-lg text-sm border border-danger/20 flex gap-3">
                  <AlertTriangle className="shrink-0" size={20} />
                  <div className="flex-1">
                    <p className="font-bold">{appError.message}</p>
                    {appError.details && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs opacity-80 hover:opacity-100">Ver detalles técnicos</summary>
                        <pre className="mt-2 text-[10px] bg-black/5 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                          {appError.details}
                        </pre>
                      </details>
                    )}
                  </div>
                  <button onClick={() => setAppError(null)} className="text-danger opacity-70 hover:opacity-100">
                    <X size={16}/>
                  </button>
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
                  <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl text-center">
                    <CreditCard size={32} className="text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500 mb-3 text-sm">
                      {t('movements.noAccount')}
                    </p>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm w-full"
                      onClick={() => setShowAccountModal(true)}
                    >
                      <Plus size={16} />
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
      )}

      {/* Account Creation Modal (Inline) */}
      {showAccountModal && (
        <UiModal isOpen={showAccountModal} onClose={resetAccountModal}>
            <UiModalHeader>{t('accounts.new')}</UiModalHeader>
            <UiModalBody>
                {newAccountError && (
                    <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md text-sm border border-red-100">
                        {newAccountError}
                    </div>
                )}
                <div className="space-y-4">
                    <UiInput 
                        label={t('accounts.name')}
                        value={newAccountName}
                        onChange={(e) => setNewAccountName(e.target.value)}
                        placeholder="Ej. Cuenta Corriente Principal"
                        autoFocus
                    />
                     <UiField label={t('accounts.type')}>
                        <UiSelect 
                             value={newAccountType}
                             onChange={(val) => setNewAccountType(val)}
                             options={accountTypes.map(t => ({ value: t.value, label: t.label }))}
                        />
                    </UiField>
                    
                    <UiField label={`${t('accounts.parent')} (Opcional)`}>
                        <UiSelect
                           value={newAccountParentId}
                           onChange={setNewAccountParentId}
                           options={[
                               { value: '', label: t('common.none') },
                               ...flatAccounts.map(acc => ({
                                   value: acc.id,
                                   label: '\u00A0\u00A0'.repeat(acc.level || 0) + ((acc.level || 0) > 0 ? '— ' : '') + acc.name
                               }))
                           ]}
                        />
                    </UiField>
                </div>
            </UiModalBody>
            <UiModalFooter>
                <button 
                    className="btn btn-secondary"
                    onClick={resetAccountModal}
                    disabled={creatingAccount}
                >
                    {t('common.cancel')}
                </button>
                <button 
                    className="btn btn-primary"
                    onClick={handleCreateAccount}
                    disabled={!newAccountName.trim() || creatingAccount}
                >
                    {creatingAccount ?  t('common.saving') : t('common.save')}
                </button>
            </UiModalFooter>
        </UiModal>
      )}
    </div>
  )
}


