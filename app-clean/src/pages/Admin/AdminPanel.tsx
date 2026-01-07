import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { 
  getAllUsers, 
  getUserCount, 
  getSuspendedCount, 
  getOrganizationCount,
  suspendUser,
  unsuspendUser,
  type UserProfile 
} from '../../services/adminService'
import { useI18n } from '../../hooks/useI18n'
import { Shield, Users, Building, AlertTriangle, UserX, UserCheck, RefreshCw } from 'lucide-react'
import { UiCard } from '../../components/ui/UiCard'

// Super Admin email - hardcoded for now (can be moved to env or profiles table)
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
          await loadStats()
          await loadUsers()
        }
      }
    } catch (error) {
      console.error('Error checking admin access:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const [users, orgs, suspended] = await Promise.all([
        getUserCount(),
        getOrganizationCount(),
        getSuspendedCount()
      ])
      setUserCount(users)
      setOrgCount(orgs)
      setSuspendedCount(suspended)
      setProfilesTableExists(true)
    } catch (error) {
      console.error('Error loading stats:', error)
      setProfilesTableExists(false)
    }
  }

  const loadUsers = async () => {
    setLoadingUsers(true)
    try {
      const data = await getAllUsers()
      setUsers(data)
      setProfilesTableExists(true)
    } catch (error) {
      console.error('Error loading users:', error)
      setProfilesTableExists(false)
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
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="d-flex items-center justify-center" style={{ minHeight: '200px' }}>
          <div className="spinner"></div>
        </div>
      </div>
    )
  }

  if (!isSuperAdmin) {
    return (
      <div className="page-container">
        <UiCard className="max-w-lg mx-auto mt-12 text-center p-8">
          <AlertTriangle size={64} className="mx-auto mb-4 text-yellow-500" />
          <h2 className="text-2xl font-bold mb-2">Acceso Denegado</h2>
          <p className="text-gray-500 mb-4">
            Esta sección está reservada para administradores del sistema.
          </p>
          <p className="text-sm text-gray-400">
            Tu email: {currentUserEmail || 'No identificado'}
          </p>
        </UiCard>
      </div>
    )
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <Shield className="text-primary" size={32} />
            Panel de Administración
          </h1>
          <p className="page-subtitle">Control total del sistema - Super Admin</p>
        </div>
        <button className="btn btn-secondary" onClick={() => { loadStats(); loadUsers(); }}>
          <RefreshCw size={16} />
          Actualizar
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <UiCard className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
              <Users size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold">{profilesTableExists ? userCount : '--'}</p>
              <p className="text-sm text-gray-500">Usuarios Registrados</p>
            </div>
          </div>
        </UiCard>

        <UiCard className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 text-purple-600 rounded-lg">
              <Building size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold">{orgCount}</p>
              <p className="text-sm text-gray-500">Organizaciones</p>
            </div>
          </div>
        </UiCard>

        <UiCard className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-100 text-red-600 rounded-lg">
              <UserX size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold">{profilesTableExists ? suspendedCount : '--'}</p>
              <p className="text-sm text-gray-500">Usuarios Suspendidos</p>
            </div>
          </div>
        </UiCard>
      </div>

      {/* Users Management Section */}
      <UiCard>
        <div className="p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Users size={20} />
            Gestión de Usuarios
          </h3>
          
          {!profilesTableExists ? (
            <>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <p className="text-yellow-800 text-sm">
                  <strong>⚠️ Nota:</strong> Para ver la lista de usuarios, necesitas ejecutar la migración 
                  <code className="mx-1 px-2 py-0.5 bg-yellow-100 rounded">MIG_005_profiles_table.sql</code> 
                  en el SQL Editor de Supabase.
                </p>
              </div>
              <p className="text-gray-500 text-center py-8">
                La gestión de usuarios estará disponible cuando se configure la tabla de perfiles.
              </p>
            </>
          ) : loadingUsers ? (
            <div className="flex justify-center py-8">
              <div className="spinner"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Nombre</th>
                    <th>Registrado</th>
                    <th>Estado</th>
                    <th className="text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id} className={user.is_suspended ? 'opacity-50' : ''}>
                      <td className="font-medium">
                        {user.email}
                        {user.is_super_admin && (
                          <span className="ml-2 badge badge-primary text-xs">Admin</span>
                        )}
                      </td>
                      <td>{user.display_name || '-'}</td>
                      <td className="text-sm text-gray-500">{formatDate(user.created_at)}</td>
                      <td>
                        {user.is_suspended ? (
                          <span className="badge badge-danger">Suspendido</span>
                        ) : (
                          <span className="badge badge-success">Activo</span>
                        )}
                      </td>
                      <td className="text-right">
                        {user.id !== currentUserId && (
                          <>
                            {user.is_suspended ? (
                              <button 
                                className="btn btn-sm btn-success"
                                onClick={() => handleUnsuspend(user.id)}
                              >
                                <UserCheck size={14} className="mr-1" />
                                Reactivar
                              </button>
                            ) : (
                              <button 
                                className="btn btn-sm btn-danger"
                                onClick={() => handleSuspend(user.id)}
                              >
                                <UserX size={14} className="mr-1" />
                                Suspender
                              </button>
                            )}
                          </>
                        )}
                        {user.id === currentUserId && (
                          <span className="text-gray-400 text-sm">Tú</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && (
                <p className="text-center text-gray-500 py-8">No hay usuarios registrados</p>
              )}
            </div>
          )}
        </div>
      </UiCard>
    </div>
  )
}
