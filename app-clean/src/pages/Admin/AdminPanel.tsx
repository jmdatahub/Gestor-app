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
import { Shield, Users, Building, AlertTriangle, UserX, UserCheck, RefreshCw, Activity, Search, Filter, MoreHorizontal, Download } from 'lucide-react'
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
      // First check if the database is healthy
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
      setProfilesTableExists(false)
      return false
    }
  }

  const loadUsers = async () => {
    setLoadingUsers(true)
    try {
      const data = await getAllUsers()
      setUsers(data)
      // We don't set profilesTableExists here anymore, as loadStats determines it authoritatively
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
        <div style={{
          maxWidth: '600px',
          margin: '4rem auto',
          textAlign: 'center',
          padding: '3rem',
          background: 'var(--bg-card)',
          borderRadius: '24px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.1)',
            color: '#EF4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem'
          }}>
            <Shield size={40} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Acceso Restringido</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Esta sección es exclusiva para la administración del sistema.
          </p>
          <div style={{
            padding: '0.75rem 1rem',
            background: 'var(--gray-50)',
            borderRadius: '12px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.875rem',
            color: 'var(--text-muted)'
          }}>
            <UserX size={16} />
            {currentUserEmail || 'Usuario no identificado'}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '2.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', // Green gradient for admin/security
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
            }}>
              <Shield size={24} color="white" />
            </div>
            <h1 className="page-title" style={{ margin: 0 }}>Panel de Administración</h1>
          </div>
          <p className="page-subtitle" style={{ marginLeft: '60px' }}>
            Vista general del sistema, métricas y gestión de usuarios
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button 
              className="btn"
              onClick={() => { loadStats(); loadUsers(); }}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
              }}
            >
              <RefreshCw size={18} />
              <span className="hidden sm:inline">Actualizar</span>
            </button>
            <button 
              className="btn btn-primary"
              style={{
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                border: 'none',
                color: 'white'
              }}
            >
              <Download size={18} />
              <span className="hidden sm:inline">Exportar Reporte</span>
            </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* KPI: Users */}
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: '20px',
          padding: '1.5rem',
          border: '1px solid var(--border-color)',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div style={{
              padding: '0.75rem',
              borderRadius: '12px',
              background: 'rgba(59, 130, 246, 0.1)',
              color: '#3B82F6'
            }}>
              <Users size={24} />
            </div>
            <span style={{ 
              fontSize: '0.75rem', 
              fontWeight: 600, 
              color: '#10B981', 
              background: 'rgba(16, 185, 129, 0.1)', 
              padding: '0.25rem 0.5rem', 
              borderRadius: '10px' 
            }}>
              +12% mes
            </span>
          </div>
          <div>
            <h3 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1, marginBottom: '0.25rem' }}>
              {profilesTableExists ? userCount.toLocaleString() : '--'}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 500 }}>Usuarios Registrados</p>
          </div>
        </div>

        {/* KPI: Organizations */}
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: '20px',
          padding: '1.5rem',
          border: '1px solid var(--border-color)',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div style={{
              padding: '0.75rem',
              borderRadius: '12px',
              background: 'rgba(139, 92, 246, 0.1)',
              color: '#8B5CF6'
            }}>
              <Building size={24} />
            </div>
            <span style={{ 
              fontSize: '0.75rem', 
              fontWeight: 600, 
              color: '#10B981', 
              background: 'rgba(16, 185, 129, 0.1)', 
              padding: '0.25rem 0.5rem', 
              borderRadius: '10px' 
            }}>
              +5% mes
            </span>
          </div>
          <div>
            <h3 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1, marginBottom: '0.25rem' }}>
              {orgCount.toLocaleString()}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 500 }}>Organizaciones Activas</p>
          </div>
        </div>

        {/* KPI: Suspended */}
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: '20px',
          padding: '1.5rem',
          border: '1px solid var(--border-color)',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div style={{
              padding: '0.75rem',
              borderRadius: '12px',
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#EF4444'
            }}>
              <Activity size={24} />
            </div>
            {/* Conditional text color based on count */}
            <span style={{ 
              fontSize: '0.75rem', 
              fontWeight: 600, 
              color: suspendedCount > 0 ? '#EF4444' : '#10B981', 
              background: suspendedCount > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', 
              padding: '0.25rem 0.5rem', 
              borderRadius: '10px' 
            }}>
              {suspendedCount > 0 ? 'Requiere atención' : 'Todo en orden'}
            </span>
          </div>
          <div>
            <h3 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1, marginBottom: '0.25rem' }}>
              {profilesTableExists ? suspendedCount : '--'}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 500 }}>Alertas de Seguridad</p>
          </div>
        </div>
      </div>

      {/* Users Management Section */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: '24px',
        border: '1px solid var(--border-color)',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Gestión de Usuarios
            <span style={{ 
              fontSize: '0.75rem', 
              background: 'var(--gray-100)', 
              padding: '0.2rem 0.6rem', 
              borderRadius: '12px', 
              color: 'var(--text-secondary)',
              fontWeight: 500
            }}>
              {profilesTableExists ? userCount : 0} total
            </span>
          </h3>
          
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                placeholder="Buscar usuario..." 
                className="input"
                style={{ paddingLeft: '36px', height: '40px', minWidth: '240px' }}
              />
            </div>
            <button className="btn btn-secondary icon-only" style={{ height: '40px', width: '40px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Filter size={18} />
            </button>
          </div>
        </div>
        
        <div className="p-0">
          {!profilesTableExists ? (
            <div style={{ padding: '3rem', textAlign: 'center' }}>
              <div style={{
                background: 'rgba(245, 158, 11, 0.1)',
                color: '#D97706',
                padding: '1.5rem',
                borderRadius: '16px',
                marginBottom: '1.5rem',
                maxWidth: '600px',
                margin: '0 auto 1.5rem'
              }}>
                <h4 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontWeight: 700 }}>
                  <AlertTriangle size={20} />
                  Configuración Pendiente
                </h4>
                <p className="text-sm">
                  Para activar la gestión de usuarios, necesitas ejecutar la migración 
                  <code style={{ background: 'rgba(0,0,0,0.05)', padding: '0.2rem 0.4rem', borderRadius: '4px', margin: '0 0.3rem', fontFamily: 'monospace' }}>
                    MIG_005_profiles_table.sql
                  </code> 
                  en tu base de datos Supabase.
                </p>
              </div>
            </div>
          ) : loadingUsers ? (
            <div className="flex justify-center py-12">
              <div className="spinner"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table w-full" style={{ borderCollapse: 'separate', borderSpacing: '0' }}>
                <thead style={{ background: 'var(--gray-50)' }}>
                  <tr>
                    <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', fontWeight: 600 }}>Usuario</th>
                    <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', fontWeight: 600 }}>Registro</th>
                    <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', fontWeight: 600 }}>Estado</th>
                    <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user, index) => (
                    <tr 
                      key={user.id} 
                      style={{ 
                        opacity: user.is_suspended ? 0.6 : 1,
                        background: index % 2 === 0 ? 'white' : 'var(--gray-50)'
                      }}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            background: `linear-gradient(135deg, ${user.is_super_admin ? '#10B981' : '#6366F1'} 0%, ${user.is_super_admin ? '#059669' : '#4F46E5'} 100%)`,
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '1rem'
                          }}>
                            {user.email.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                              {user.display_name || user.email.split('@')[0]}
                              {user.is_super_admin && (
                                <span style={{
                                  marginLeft: '0.5rem',
                                  fontSize: '0.65rem',
                                  padding: '0.15rem 0.5rem',
                                  borderRadius: '10px',
                                  background: '#DCFCE7',
                                  color: '#166534',
                                  fontWeight: 700,
                                  textTransform: 'uppercase'
                                }}>Admin</span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        {formatDate(user.created_at)}
                      </td>
                      <td style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)' }}>
                        {user.is_suspended ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.375rem',
                            padding: '0.25rem 0.75rem',
                            borderRadius: '20px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: '#EF4444',
                            fontSize: '0.75rem',
                            fontWeight: 600
                          }}>
                            <UserX size={12} /> Suspendido
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.375rem',
                            padding: '0.25rem 0.75rem',
                            borderRadius: '20px',
                            background: 'rgba(34, 197, 94, 0.1)',
                            color: '#16A34A',
                            fontSize: '0.75rem',
                            fontWeight: 600
                          }}>
                            <UserCheck size={12} /> Activo
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', textAlign: 'right' }}>
                        {user.id !== currentUserId && (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                            {user.is_suspended ? (
                              <button 
                                className="btn btn-sm"
                                onClick={() => handleUnsuspend(user.id)}
                                style={{ background: '#DCFCE7', color: '#166534', border: 'none' }}
                                title="Reactivar usuario"
                              >
                                <UserCheck size={16} />
                              </button>
                            ) : (
                              <button 
                                className="btn btn-sm"
                                onClick={() => handleSuspend(user.id)}
                                style={{ background: '#FEE2E2', color: '#991B1B', border: 'none' }}
                                title="Suspender usuario"
                              >
                                <UserX size={16} />
                              </button>
                            )}
                            <button className="btn btn-sm btn-ghost" style={{ padding: '0.25rem' }}>
                                <MoreHorizontal size={18} />
                            </button>
                          </div>
                        )}
                        {user.id === currentUserId && (
                          <span className="text-gray-400 text-sm italic">Sesión actual</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && (
                <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <img src="https://cdni.iconscout.com/illustration/premium/thumb/empty-state-2130362-1800926.png" alt="Empty" style={{ height: '120px', opacity: 0.5, marginBottom: '1rem', mixBlendMode: 'multiply' }} />
                  <p>No se encontraron usuarios</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
