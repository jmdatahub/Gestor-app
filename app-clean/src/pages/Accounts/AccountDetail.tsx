import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { 
  getAccountById,
  toggleAccountActive,
  deleteAccount,
  type AccountWithBalance 
} from '../../services/accountService'
import { fetchMovements, type Movement } from '../../services/movementService'
import { getUserInvestments, calculateTotals, type Investment } from '../../services/investmentService'
import { Edit2, Power, PowerOff, Trash2, ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import { UiCard } from '../../components/ui/UiCard'
import { Breadcrumbs } from '../../components/Breadcrumbs'

export default function AccountDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [account, setAccount] = useState<AccountWithBalance | null>(null)
  const [movements, setMovements] = useState<Movement[]>([])
  const [investments, setInvestments] = useState<Investment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) loadData()
  }, [id])

  const loadData = async () => {
    if (!id) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get account
      const accountData = await getAccountById(id)
      setAccount(accountData)

      // Get movements for this account
      const movementsData = await fetchMovements(user.id)
      const accountMovements = movementsData.filter(m => m.account_id === id)
      setMovements(accountMovements.slice(0, 20)) // Last 20 movements

      // Get investments for this account
      const allInvestments = await getUserInvestments(user.id)
      const accountInvestments = allInvestments.filter(i => i.account_id === id)
      setInvestments(accountInvestments)
    } catch (error) {
      console.error('Error loading account:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleActive = async () => {
    if (!account) return
    try {
      await toggleAccountActive(account.id, !account.is_active)
      loadData()
    } catch (error) {
      console.error('Error toggling account:', error)
    }
  }

  const handleDelete = async () => {
    if (!account) return
    if (!confirm('¿Estás seguro de que quieres eliminar esta cuenta? Esta acción no se puede deshacer.')) return
    
    try {
      await deleteAccount(account.id)
      navigate('/app/accounts')
    } catch (error) {
      console.error('Error deleting account:', error)
      alert('Error al eliminar la cuenta. Es posible que tenga movimientos asociados.')
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="d-flex items-center justify-center" style={{ minHeight: '200px' }}>
        <div className="spinner"></div>
      </div>
    )
  }

  if (!account) {
    return (
      <div className="card text-center" style={{ padding: '3rem' }}>
        <p className="text-gray-500">Cuenta no encontrada</p>
        <button className="btn btn-primary mt-4" onClick={() => navigate('/app/accounts')}>
          Volver a Cuentas
        </button>
      </div>
    )
  }

  // Calculate stats
  const incomes = movements.filter(m => m.kind === 'income').reduce((sum, m) => sum + m.amount, 0)
  const expenses = movements.filter(m => m.kind === 'expense').reduce((sum, m) => sum + m.amount, 0)

  return (
    <div className="page-container">
      <Breadcrumbs items={[
        { label: 'Inicio', path: '/app' },
        { label: 'Cuentas', path: '/app/accounts' },
        { label: account.name }
      ]} />

      {/* Main Info Card - Redesigned */}
      <UiCard className="mb-6 p-8 relative overflow-hidden group">
        {/* Decorative Gradient Blob */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary opacity-10 blur-3xl rounded-full -mr-48 -mt-48 pointer-events-none"></div>

        <div className="d-flex justify-between items-start relative z-10">
          <div className="flex-1">
            <div className="d-flex items-center gap-3 mb-6">
              <h2 className="text-3xl font-bold text-gray-800 tracking-tight dark:text-white">{account.name}</h2>
              <div className="d-flex gap-2">
                 <span className={`badge ${account.is_active ? 'badge-success' : 'badge-gray'} opacity-80 backdrop-blur-md`}>
                  {account.is_active ? 'Activa' : 'Inactiva'}
                </span>
                <span className="badge badge-primary opacity-80 backdrop-blur-md">{account.type}</span>
              </div>
            </div>

            <div className="mt-2">
               <div className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">Saldo Disponible</div>
               <div className={`text-6xl font-bold font-mono tracking-tighter ${account.balance >= 0 ? 'text-gray-900 dark:text-white' : 'text-danger'}`}>
                 {formatCurrency(account.balance)}
               </div>
            </div>
          </div>

          {/* Minimal Visible Actions */}
          <div className="d-flex gap-2">
            <button 
              className="btn btn-secondary btn-sm p-2"
              onClick={() => navigate(`/app/accounts`)}
              title="Editar Cuenta"
              style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Edit2 size={16} />
            </button>
            <button 
              className={`btn btn-sm p-2 ${account.is_active ? 'btn-secondary text-warning' : 'btn-success'}`}
              onClick={handleToggleActive}
              title={account.is_active ? 'Pausar Cuenta' : 'Activar Cuenta'}
              style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {account.is_active ? <PowerOff size={16} /> : <Power size={16} />}
            </button>
            <button 
              className="btn btn-danger btn-sm p-2"
              onClick={handleDelete}
              title="Eliminar Cuenta"
              style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Stats Row - Clean text only */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-12 mt-12 pt-8 border-t border-gray-100 dark:border-gray-800">
          <div>
             <div className="d-flex items-center gap-2 mb-2 text-gray-500 dark:text-gray-400">
               <ArrowDownLeft size={18} className="text-success" />
               <span className="text-sm font-medium">Ingresos (Mes)</span>
             </div>
             <div className="text-2xl font-semibold text-gray-900 dark:text-gray-200 tracking-tight">{formatCurrency(incomes)}</div>
          </div>
          <div>
             <div className="d-flex items-center gap-2 mb-2 text-gray-500 dark:text-gray-400">
               <ArrowUpRight size={18} className="text-danger" />
               <span className="text-sm font-medium">Gastos (Mes)</span>
             </div>
             <div className="text-2xl font-semibold text-gray-900 dark:text-gray-200 tracking-tight">{formatCurrency(expenses)}</div>
          </div>
        </div>

        {/* Investments Section - Integrated */}
        {investments.length > 0 && (() => {
          const totals = calculateTotals(investments)
          return (
            <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-800">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Inversiones Vinculadas</h3>
                 <button className="text-sm text-primary hover:text-primary-hover font-medium" onClick={() => navigate('/app/investments')}>
                    Ver detalle &rarr;
                 </button>
              </div>
               
               <div className="grid grid-cols-2 lg:grid-cols-3 gap-8">
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Valor Actual</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{formatCurrency(totals.totalValue)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">P&L Latente</div>
                    <div className={`text-2xl font-bold tracking-tight ${totals.totalProfitLoss >= 0 ? 'text-success' : 'text-danger'}`}>
                      {totals.totalProfitLoss >= 0 ? '+' : ''}{formatCurrency(totals.totalProfitLoss)}
                    </div>
                  </div>
               </div>
            </div>
          )
        })()}

        {/* Description - Subtle */}
        {account.description && (
          <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
            {account.description}
          </div>
        )}
      </UiCard>

      {/* Movements Section */}
      <UiCard className="p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Últimos Movimientos</h3>
        
        {movements.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No hay movimientos registrados</p>
        ) : (
          <div className="d-flex flex-col gap-3">
            {movements.map((mov) => (
              <div 
                key={mov.id} 
                className="d-flex items-center justify-between p-3 rounded-lg"
                style={{ background: 'var(--gray-50)' }}
              >
                <div className="d-flex items-center gap-3">
                  <div 
                    className="d-flex items-center justify-center rounded-full"
                    style={{ 
                      width: '40px', 
                      height: '40px',
                      background: mov.kind === 'income' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)'
                    }}
                  >
                    {mov.kind === 'income' ? (
                      <ArrowDownLeft size={20} style={{ color: 'var(--success)' }} />
                    ) : (
                      <ArrowUpRight size={20} style={{ color: 'var(--danger)' }} />
                    )}
                  </div>
                  <div>
                    <div className="font-medium">{mov.description || (mov.kind === 'income' ? 'Ingreso' : 'Gasto')}</div>
                    <div className="text-sm text-gray-500">{formatDate(mov.date)}</div>
                  </div>
                </div>
                <div className={`font-bold ${mov.kind === 'income' ? 'text-success' : 'text-danger'}`}>
                  {mov.kind === 'income' ? '+' : '-'}{formatCurrency(mov.amount)}
                </div>
              </div>
            ))}
          </div>
        )}

        <button 
          className="btn btn-secondary w-full mt-4"
          onClick={() => navigate('/app/movements')}
        >
          Ver todos los movimientos
        </button>
      </UiCard>
    </div>
  )
}
