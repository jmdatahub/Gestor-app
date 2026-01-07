import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { 
  getAllUsers, 
  getUserCount, 
  getSuspendedCount, 
  getOrganizationCount,
  suspendUser,
  unsuspendUser,
  checkDatabaseHealth,
  type UserProfile 
} from '../../services/adminService'
import { useI18n } from '../../hooks/useI18n'
import { Shield, Users, Building, AlertTriangle, UserX, UserCheck, RefreshCw, Activity, Search, Filter, MoreHorizontal, Download, ChevronDown } from 'lucide-react'

// Super Admin email 
const SUPER_ADMIN_EMAIL = 'mp.jorge00@gmail.com'

export default function AdminPanel() {
  const { t } = useI18n()
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<UserProfile[]>([])
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  
  // Stats
  const [userCount, setUserCount] = useState<number>(0)
  const [orgCount, setOrgCount] = useState<number>(0)
  const [suspendedCount, setSuspendedCount] = useState<number>(0)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [profilesTableExists, setProfilesTableExists] = useState(false)

  useEffect(() => {
    checkAdminAccess()
  }, [])

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) {
        setCurrentUserEmail(user.email)
        setCurrentUserId(user.id)
        setIsSuperAdmin(user.email === SUPER_ADMIN_EMAIL)
        
        if (user.email === SUPER_ADMIN_EMAIL) {
          const isHealthy = await loadStats()
          if (isHealthy) {
            await loadUsers()
          }
        }
      }
    } catch (error) {
      console.error('Error checking admin access:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async (): Promise<boolean> => {
    try {
      const health = await checkDatabaseHealth()
      if (!health.profilesExists) {
        setProfilesTableExists(false)
        return false
      }
      
      const [users, orgs, suspended] = await Promise.all([
        getUserCount(),
        getOrganizationCount(),
        getSuspendedCount()
      ])
      setUserCount(users)
      setOrgCount(orgs)
      setSuspendedCount(suspended)
      setProfilesTableExists(true)
      return true
    } catch (error) {
      console.error('Error loading stats:', error)
      return false
    }
  }

  const loadUsers = async () => {
    setLoadingUsers(true)
    try {
      const data = await getAllUsers()
      setUsers(data)
    } catch (error) {
      console.error('Error loading users:', error)
    } finally {
      setLoadingUsers(false)
    }
  }

  const handleSuspend = async (userId: string) => {
    if (!confirm('¿Estás seguro de suspender este usuario?')) return
    try {
      await suspendUser(userId)
      await loadUsers()
      await loadStats()
    } catch (error) {
      console.error('Error suspending user:', error)
      alert('Error al suspender usuario')
    }
  }

  const handleUnsuspend = async (userId: string) => {
    try {
      await unsuspendUser(userId)
      await loadUsers()
      await loadStats()
    } catch (error) {
      console.error('Error unsuspending user:', error)
      alert('Error al reactivar usuario')
    }
  }

  const formatDate = (date: string) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    )
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] text-center p-6 bg-[#0f172a] rounded-3xl border border-[#1e293b]">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-500/20 to-red-600/10 flex items-center justify-center mb-6 shadow-xl shadow-red-900/20">
          <Shield size={40} className="text-red-500" />
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">Acceso Restringido</h2>
        <p className="text-gray-400 max-w-md mb-8 text-lg">
          Esta sección es exclusiva para la administración del sistema. Tu cuenta no tiene los permisos necesarios.
        </p>
        <div className="flex items-center gap-3 px-4 py-2 bg-[#1e293b] rounded-full border border-[#334155]">
          <UserX size={16} className="text-gray-400" />
          <span className="text-gray-300 font-medium text-sm">{currentUserEmail}</span>
        </div>
      </div>
    )
  }

  const getInitials = (email: string | null) => {
    return (email || '?').charAt(0).toUpperCase()
  }

  return (
    <div className="max-w-[1600px] mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Shield size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Panel de Administración</h1>
            </div>
          </div>
          <p className="text-gray-400 ml-[64px] font-medium">
            Métricas clave y control total del sistema
          </p>
        </div>
        
        <div className="flex gap-3 ml-[64px] md:ml-0">
            <button 
              className="px-4 py-2.5 rounded-xl bg-[#1e293b] border border-[#334155] text-gray-300 hover:text-white hover:bg-[#334155] transition-all flex items-center gap-2 font-medium text-sm shadow-sm"
              onClick={() => { loadStats(); loadUsers(); }}
            >
              <RefreshCw size={16} />
              <span className="hidden sm:inline">Actualizar</span>
            </button>
            <button 
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-all flex items-center gap-2 font-medium text-sm shadow-lg shadow-emerald-900/20 border border-emerald-500/50"
            >
              <Download size={16} />
              <span className="hidden sm:inline">Exportar Datos</span>
            </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        {/* Users Card */}
        <div className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-3xl p-6 border border-[#334155]/50 shadow-xl shadow-black/20 hover:border-[#334155] transition-all group">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-400 group-hover:scale-110 transition-transform duration-300">
              <Users size={24} />
            </div>
            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
              +12% este mes
            </span>
          </div>
          <div className="space-y-1">
            <h3 className="text-4xl font-bold text-white tracking-tight">
              {profilesTableExists ? userCount.toLocaleString() : '-'}
            </h3>
            <p className="text-gray-400 font-medium">Usuarios Registrados</p>
          </div>
        </div>

        {/* Organizations Card */}
        <div className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-3xl p-6 border border-[#334155]/50 shadow-xl shadow-black/20 hover:border-[#334155] transition-all group">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 rounded-2xl bg-violet-500/10 text-violet-400 group-hover:scale-110 transition-transform duration-300">
              <Building size={24} />
            </div>
            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
              +5% este mes
            </span>
          </div>
          <div className="space-y-1">
            <h3 className="text-4xl font-bold text-white tracking-tight">
              {orgCount.toLocaleString()}
            </h3>
            <p className="text-gray-400 font-medium">Organizaciones Activas</p>
          </div>
        </div>

        {/* Security Card */}
        <div className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-3xl p-6 border border-[#334155]/50 shadow-xl shadow-black/20 hover:border-[#334155] transition-all group">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 rounded-2xl bg-red-500/10 text-red-400 group-hover:scale-110 transition-transform duration-300">
              <Activity size={24} />
            </div>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${suspendedCount > 0 ? 'text-red-400 bg-red-500/10 border-red-500/20' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'}`}>
              {suspendedCount > 0 ? 'Atención Requerida' : 'Sistema Saludable'}
            </span>
          </div>
          <div className="space-y-1">
            <h3 className="text-4xl font-bold text-white tracking-tight">
              {profilesTableExists ? suspendedCount : '-'}
            </h3>
            <p className="text-gray-400 font-medium">Alertas de Seguridad</p>
          </div>
        </div>
      </div>

      {/* Main Content Section */}
      <div className="bg-[#1e293b] rounded-3xl border border-[#334155]/50 shadow-xl overflow-hidden">
        {/* Table Header */}
        <div className="p-6 border-b border-[#334155] bg-[#1e293b] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-xl font-bold text-white mb-1">Gestión de Usuarios</h3>
            <p className="text-sm text-gray-400">Administra el acceso y estado de las cuentas</p>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Buscar usuario..." 
                className="w-full sm:w-64 bg-[#0f172a] border border-[#334155] text-white text-sm rounded-xl pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all placeholder:text-gray-500 shadow-inner"
              />
            </div>
            <button className="h-[42px] px-3 rounded-xl bg-[#0f172a] border border-[#334155] text-gray-300 hover:text-white hover:border-[#475569] transition-all">
                <Filter size={18} />
            </button>
          </div>
        </div>
        
        {/* Table Content */}
        <div className="bg-[#0f172a]/50">
          {!profilesTableExists ? (
            <div className="p-12 flex flex-col items-center justify-center text-center">
              <div className="p-6 bg-amber-500/10 rounded-2xl border border-amber-500/20 max-w-2xl backdrop-blur-sm">
                <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4 text-amber-500">
                  <AlertTriangle size={24} />
                </div>
                <h4 className="text-lg font-bold text-amber-200 mb-2">
                  Configuración Pendiente
                </h4>
                <p className="text-amber-200/70 mb-4 leading-relaxed">
                  Para visualizar y gestionar los usuarios, es necesario aplicar la migración de base de datos correspondiente.
                </p>
                <div className="bg-[#0f172a] rounded-lg p-3 text-left border border-amber-500/20">
                   <code className="text-xs font-mono text-amber-300 block">MIG_005_profiles_table.sql</code>
                </div>
              </div>
            </div>
          ) : loadingUsers ? (
            <div className="flex justify-center py-20">
              <div className="relative">
                <div className="w-12 h-12 border-4 border-[#334155] border-t-emerald-500 rounded-full animate-spin"></div>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#1e293b] border-b border-[#334155]">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider w-[40%]">Usuario</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider w-[20%]">Registro</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider w-[20%]">Estado</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider w-[20%] text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#334155]">
                  {users.map((user) => (
                    <tr 
                      key={user.id} 
                      className={`group hover:bg-[#1e293b] transition-colors ${user.is_suspended ? 'bg-red-950/5' : ''}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-lg text-sm border-2 border-[#1e293b] ring-2 ring-transparent group-hover:ring-[#334155] transition-all ${user.is_super_admin ? 'bg-gradient-to-br from-emerald-500 to-emerald-600' : 'bg-gradient-to-br from-indigo-500 to-indigo-600'}`}>
                            {getInitials(user.email)}
                          </div>
                          <div>
                            <div className="font-semibold text-white text-sm flex items-center gap-2">
                              {user.display_name || 'Usuario'}
                              {user.is_super_admin && (
                                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                                  Admin
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5 font-medium">
                              {user.email || <span className="text-gray-600 italic">Sin email registrado</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400 font-medium">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        {user.is_suspended ? (
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wide">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            Suspendido
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wide">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Activo
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {user.id !== currentUserId && (
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {user.is_suspended ? (
                              <button 
                                className="h-8 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all flex items-center gap-2 text-xs font-medium"
                                onClick={() => handleUnsuspend(user.id)}
                              >
                                <UserCheck size={14} /> Reactivar
                              </button>
                            ) : (
                              <button 
                                className="h-8 px-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all flex items-center gap-2 text-xs font-medium"
                                onClick={() => handleSuspend(user.id)}
                              >
                                <UserX size={14} /> Suspender
                              </button>
                            )}
                          </div>
                        )}
                        {user.id === currentUserId && (
                          <span className="text-gray-500 text-xs font-semibold px-3 py-1 bg-[#1e293b] rounded-lg border border-[#334155]">TÚ</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  
                  {users.length > 0 && Array.from({ length: Math.max(0, 5 - users.length) }).map((_, i) => (
                    <tr key={`empty-${i}`} className="h-[73px]">
                      <td colSpan={4}></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && (
                <div className="py-24 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 rounded-full bg-[#1e293b] flex items-center justify-center mb-4 border border-[#334155]">
                    <Search size={24} className="text-gray-600" />
                  </div>
                  <h3 className="text-white font-medium mb-1">No se encontraron usuarios</h3>
                  <p className="text-gray-500 text-sm">Prueba ajustando los filtros de búsqueda</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
