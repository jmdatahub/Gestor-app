import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { 
  getAllUsers, 
  getUserCount, 
  getSuspendedCount, 
  getOrganizationCount,
  getAllOrganizations,
  suspendUser,
  unsuspendUser,
  deleteUserProfile,
  checkDatabaseHealth,
  type UserProfile,
  type AdminOrganization
} from '../../services/adminService'
import { useI18n } from '../../hooks/useI18n'
import { Shield, Users, Building, AlertTriangle, UserX, UserCheck, RefreshCw, Activity, Search, Filter, Download, ExternalLink, Eye, Trash2 } from 'lucide-react'

const SUPER_ADMIN_EMAIL = 'mp.jorge00@gmail.com'

export default function AdminPanel() {
  const { t } = useI18n()
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<UserProfile[]>([])
  const [organizations, setOrganizations] = useState<AdminOrganization[]>([])
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [userCount, setUserCount] = useState<number>(0)
  const [orgCount, setOrgCount] = useState<number>(0)
  const [suspendedCount, setSuspendedCount] = useState<number>(0)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [loadingOrgs, setLoadingOrgs] = useState(false)
  const [profilesTableExists, setProfilesTableExists] = useState(false)
  const [activeTab, setActiveTab] = useState<'users' | 'orgs'>('users')
  const [searchTerm, setSearchTerm] = useState('')
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'suspended'>('all')
  
  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean
    type: 'suspend' | 'unsuspend' | 'delete'
    userId: string
    userName: string
  } | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

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
            await loadOrganizations()
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

  const loadOrganizations = async () => {
    setLoadingOrgs(true)
    try {
      const data = await getAllOrganizations()
      setOrganizations(data)
    } catch (error) {
      console.error('Error loading organizations:', error)
    } finally {
      setLoadingOrgs(false)
    }
  }
  // Open confirmation modal instead of using window.confirm
  const openConfirmModal = (type: 'suspend' | 'unsuspend' | 'delete', userId: string, userName: string) => {
    setConfirmModal({ show: true, type, userId, userName })
  }

  const closeConfirmModal = () => {
    setConfirmModal(null)
  }

  const executeConfirmedAction = async () => {
    if (!confirmModal) return
    
    setActionLoading(true)
    const { type, userId, userName } = confirmModal
    
    try {
      if (type === 'suspend') {
        await suspendUser(userId)
        await loadUsers()
        await loadStats()
        alert('✅ Usuario suspendido correctamente')
      } else if (type === 'unsuspend') {
        await unsuspendUser(userId)
        await loadUsers()
        await loadStats()
        alert('✅ Usuario reactivado correctamente')
      } else if (type === 'delete') {
        await deleteUserProfile(userId)
        await loadUsers()
        await loadStats()
        alert('✅ Usuario eliminado correctamente')
      }
    } catch (error: any) {
      console.error(`Error ${type}ing user:`, error)
      alert(`❌ Error: ${error?.message || 'Error desconocido'}`)
    } finally {
      setActionLoading(false)
      closeConfirmModal()
    }
  }

  const formatDate = (date: string) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  // Filter users based on search and filter status
  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchTerm || 
      (user.email?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.display_name?.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesFilter = filterStatus === 'all' ||
      (filterStatus === 'active' && !user.is_suspended) ||
      (filterStatus === 'suspended' && user.is_suspended)
    
    return matchesSearch && matchesFilter
  })

  const getInitials = (text: string | null) => (text || '?').charAt(0).toUpperCase()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #334155', borderTopColor: '#10b981', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      </div>
    )
  }

  if (!isSuperAdmin) {
    return (
      <div style={{ maxWidth: 480, margin: '80px auto', padding: 32, background: '#1e293b', borderRadius: 24, border: '1px solid #334155', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, margin: '0 auto 20px', background: 'rgba(239,68,68,0.1)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Shield size={32} color="#ef4444" />
        </div>
        <h2 style={{ color: 'white', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Acceso Restringido</h2>
        <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 24 }}>No tienes permisos de administrador.</p>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: '#0f172a', borderRadius: 8, border: '1px solid #334155' }}>
          <span style={{ color: '#64748b', fontSize: 13 }}>{currentUserEmail}</span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 48px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}>
            <Shield size={20} color="white" />
          </div>
          <div>
            <h1 style={{ color: 'white', fontSize: 22, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>Panel de Administración</h1>
            <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Gestión del sistema y usuarios</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { loadStats(); loadUsers(); loadOrganizations() }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#1e293b', border: '1px solid #334155', borderRadius: 10, color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <RefreshCw size={16} className={loadingUsers || loadingOrgs ? 'animate-spin' : ''} /> Actualizar
          </button>
          <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#10b981', border: 'none', borderRadius: 10, color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <Download size={16} /> Exportar
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        {/* Card: Users */}
        <div style={{ background: '#1e293b', borderRadius: 16, padding: 20, border: '1px solid #334155' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ width: 40, height: 40, background: 'rgba(59,130,246,0.1)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={20} color="#3b82f6" />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '4px 8px', borderRadius: 20 }}>+12%</span>
          </div>
          <p style={{ color: '#64748b', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 4px' }}>Usuarios</p>
          <h2 style={{ color: 'white', fontSize: 32, fontWeight: 800, margin: 0 }}>{profilesTableExists ? userCount : '-'}</h2>
        </div>

        {/* Card: Organizations */}
        <div style={{ background: '#1e293b', borderRadius: 16, padding: 20, border: '1px solid #334155' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ width: 40, height: 40, background: 'rgba(139,92,246,0.1)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building size={20} color="#8b5cf6" />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '4px 8px', borderRadius: 20 }}>+5%</span>
          </div>
          <p style={{ color: '#64748b', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 4px' }}>Organizaciones</p>
          <h2 style={{ color: 'white', fontSize: 32, fontWeight: 800, margin: 0 }}>{orgCount}</h2>
        </div>

        {/* Card: Alerts */}
        <div style={{ background: suspendedCount > 0 ? 'rgba(239,68,68,0.05)' : '#1e293b', borderRadius: 16, padding: 20, border: `1px solid ${suspendedCount > 0 ? 'rgba(239,68,68,0.2)' : '#334155'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ width: 40, height: 40, background: suspendedCount > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={20} color={suspendedCount > 0 ? '#ef4444' : '#22c55e'} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: suspendedCount > 0 ? '#ef4444' : '#22c55e', background: suspendedCount > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', padding: '4px 8px', borderRadius: 20 }}>
              {suspendedCount > 0 ? 'Atención' : 'OK'}
            </span>
          </div>
          <p style={{ color: '#64748b', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 4px' }}>Alertas</p>
          <h2 style={{ color: suspendedCount > 0 ? '#ef4444' : 'white', fontSize: 32, fontWeight: 800, margin: 0 }}>{profilesTableExists ? suspendedCount : '-'}</h2>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setActiveTab('users')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px',
            background: activeTab === 'users' ? '#10b981' : '#1e293b',
            border: `1px solid ${activeTab === 'users' ? '#10b981' : '#334155'}`,
            borderRadius: 10, color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer'
          }}
        >
          <Users size={16} /> Usuarios <span style={{ marginLeft: 4, fontSize: 11, opacity: 0.7 }}>({userCount})</span>
        </button>
        <button
          onClick={() => setActiveTab('orgs')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px',
            background: activeTab === 'orgs' ? '#8b5cf6' : '#1e293b',
            border: `1px solid ${activeTab === 'orgs' ? '#8b5cf6' : '#334155'}`,
            borderRadius: 10, color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer'
          }}
        >
          <Building size={16} /> Organizaciones <span style={{ marginLeft: 4, fontSize: 11, opacity: 0.7 }}>({orgCount})</span>
        </button>
      </div>

      {/* Data Table Section */}
      <div style={{ background: '#1e293b', borderRadius: 20, border: '1px solid #334155', overflow: 'hidden' }}>
        {/* Table Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h3 style={{ color: 'white', fontSize: 16, fontWeight: 700, margin: 0 }}>
              {activeTab === 'users' ? 'Gestión de Usuarios' : 'Gestión de Organizaciones'}
            </h3>
            <p style={{ color: '#64748b', fontSize: 13, margin: '4px 0 0' }}>
              {activeTab === 'users' ? 'Administra permisos y estados' : 'Visualiza todas las organizaciones del sistema'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input 
                type="text" 
                placeholder="Buscar..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: 200, padding: '10px 12px 10px 36px', background: '#0f172a', border: '1px solid #334155', borderRadius: 10, color: 'white', fontSize: 13, outline: 'none' }} 
              />
            </div>
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => setShowFilterMenu(!showFilterMenu)}
                style={{ 
                  width: 40, height: 40, 
                  background: filterStatus !== 'all' ? 'rgba(99,102,241,0.2)' : '#0f172a', 
                  border: filterStatus !== 'all' ? '1px solid rgba(99,102,241,0.4)' : '1px solid #334155', 
                  borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' 
                }}
              >
                <Filter size={16} color={filterStatus !== 'all' ? '#818cf8' : '#64748b'} />
              </button>
              {showFilterMenu && (
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: 8, minWidth: 140, zIndex: 100, boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }}>
                  {(['all', 'active', 'suspended'] as const).map(status => (
                    <button
                      key={status}
                      onClick={() => { setFilterStatus(status); setShowFilterMenu(false); }}
                      style={{ 
                        display: 'block', width: '100%', padding: '8px 12px', border: 'none', borderRadius: 6,
                        background: filterStatus === status ? 'rgba(99,102,241,0.2)' : 'transparent',
                        color: filterStatus === status ? '#818cf8' : '#94a3b8',
                        fontSize: 13, fontWeight: 500, textAlign: 'left', cursor: 'pointer'
                      }}
                    >
                      {status === 'all' ? 'Todos' : status === 'active' ? 'Activos' : 'Suspendidos'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Table Body */}
        <div style={{ background: 'rgba(15,23,42,0.3)' }}>
          {!profilesTableExists ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, margin: '0 auto 16px', background: 'rgba(245,158,11,0.1)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={28} color="#f59e0b" />
              </div>
              <h4 style={{ color: 'white', fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Migración Requerida</h4>
              <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>Ejecuta la migración de base de datos.</p>
              <code style={{ display: 'inline-block', padding: '8px 16px', background: '#0f172a', borderRadius: 8, color: '#f59e0b', fontSize: 12, border: '1px solid rgba(245,158,11,0.2)' }}>MIG_005_profiles_table.sql</code>
            </div>
          ) : activeTab === 'users' ? (
            /* USERS TABLE */
            loadingUsers ? (
              <div style={{ padding: 64, textAlign: 'center' }}>
                <div style={{ width: 40, height: 40, margin: '0 auto', border: '3px solid #334155', borderTopColor: '#10b981', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(30,41,59,0.5)' }}>
                    <th style={{ padding: '14px 24px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Usuario</th>
                    <th style={{ padding: '14px 24px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Registro</th>
                    <th style={{ padding: '14px 24px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Estado</th>
                    <th style={{ padding: '14px 24px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user, idx) => (
                    <tr key={user.id} style={{ borderTop: '1px solid rgba(51,65,85,0.3)', background: idx % 2 === 0 ? 'transparent' : 'rgba(30,41,59,0.2)' }}>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 40, height: 40, borderRadius: 10, background: user.is_super_admin ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #6366f1, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 14 }}>
                            {getInitials(user.email)}
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>{user.display_name || (user.email ? user.email.split('@')[0] : 'Sin nombre')}</span>
                              {user.is_super_admin && <span style={{ fontSize: 9, fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase' }}>Admin</span>}
                            </div>
                            <span style={{ color: '#64748b', fontSize: 12 }}>{user.email || 'Sin email'}</span>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px', color: '#94a3b8', fontSize: 13 }}>{formatDate(user.created_at)}</td>
                      <td style={{ padding: '16px 24px' }}>
                        {user.is_suspended ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 20, color: '#ef4444', fontSize: 11, fontWeight: 600 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }}></span>
                            Suspendido
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 20, color: '#22c55e', fontSize: 11, fontWeight: 600 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }}></span>
                            Activo
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                        {user.id !== currentUserId ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                            {user.is_suspended ? (
                              <button onClick={() => openConfirmModal('unsuspend', user.id, user.display_name || user.email || 'Sin nombre')} style={{ padding: '6px 12px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, color: '#22c55e', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <UserCheck size={14} /> Reactivar
                              </button>
                            ) : (
                              <button onClick={() => openConfirmModal('suspend', user.id, user.display_name || user.email || 'Sin nombre')} style={{ padding: '6px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <UserX size={14} /> Suspender
                              </button>
                            )}
                            <button 
                              onClick={() => openConfirmModal('delete', user.id, user.display_name || user.email || 'Sin nombre')}
                              style={{ padding: '6px', background: 'rgba(127,29,29,0.2)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#dc2626', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              title="Eliminar usuario permanentemente"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: '#64748b', fontSize: 11, fontWeight: 600, padding: '4px 10px', background: '#0f172a', borderRadius: 6, border: '1px solid #334155' }}>Tú</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : (
            /* ORGANIZATIONS TABLE */
            loadingOrgs ? (
              <div style={{ padding: 64, textAlign: 'center' }}>
                <div style={{ width: 40, height: 40, margin: '0 auto', border: '3px solid #334155', borderTopColor: '#8b5cf6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(30,41,59,0.5)' }}>
                    <th style={{ padding: '14px 24px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Organización</th>
                    <th style={{ padding: '14px 24px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Slug</th>
                    <th style={{ padding: '14px 24px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Creación</th>
                    <th style={{ padding: '14px 24px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {organizations.map((org, idx) => (
                    <tr key={org.id} style={{ borderTop: '1px solid rgba(51,65,85,0.3)', background: idx % 2 === 0 ? 'transparent' : 'rgba(30,41,59,0.2)' }}>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 14 }}>
                            {getInitials(org.name)}
                          </div>
                          <div>
                            <span style={{ color: 'white', fontWeight: 600, fontSize: 14, display: 'block' }}>{org.name}</span>
                            {org.description && <span style={{ color: '#64748b', fontSize: 12 }}>{org.description.substring(0, 50)}{org.description.length > 50 ? '...' : ''}</span>}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <code style={{ padding: '4px 8px', background: '#0f172a', borderRadius: 6, color: '#94a3b8', fontSize: 12, border: '1px solid #334155' }}>
                          {org.slug || '-'}
                        </code>
                      </td>
                      <td style={{ padding: '16px 24px', color: '#94a3b8', fontSize: 13 }}>{formatDate(org.created_at)}</td>
                      <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                        <button style={{ padding: '6px 12px', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 8, color: '#8b5cf6', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Eye size={14} /> Ver detalles
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
          {activeTab === 'users' && users.length === 0 && profilesTableExists && !loadingUsers && (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <p style={{ color: '#64748b', fontSize: 13 }}>No hay usuarios registrados</p>
            </div>
          )}
          {activeTab === 'orgs' && organizations.length === 0 && !loadingOrgs && (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <p style={{ color: '#64748b', fontSize: 13 }}>No hay organizaciones registradas</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer Info - System Info */}
      <div style={{ marginTop: 24, padding: 16, background: 'rgba(30,41,59,0.5)', border: '1px solid #334155', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite' }}></div>
            <span style={{ color: '#94a3b8', fontSize: 12 }}>Sistema operativo</span>
          </div>
          <span style={{ color: '#64748b', fontSize: 11 }}>•</span>
          <span style={{ color: '#94a3b8', fontSize: 12 }}>
            <Activity size={12} style={{ display: 'inline', marginRight: 4 }} />
            {userCount} usuarios · {orgCount} organizaciones
          </span>
          <span style={{ color: '#64748b', fontSize: 11 }}>•</span>
          <span style={{ color: '#94a3b8', fontSize: 12 }}>
            Sesión: {currentUserEmail?.split('@')[0] || 'Admin'}
          </span>
        </div>
        <a 
          href="https://supabase.com/dashboard" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#10b981', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}
        >
          Supabase Dashboard <ExternalLink size={12} />
        </a>
      </div>

      {/* Confirmation Modal */}
      {confirmModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 16,
            padding: 24,
            maxWidth: 400,
            width: '90%',
            boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
          }}>
            <h3 style={{ color: 'white', fontSize: 18, fontWeight: 700, margin: '0 0 12px' }}>
              {confirmModal.type === 'suspend' && '¿Suspender usuario?'}
              {confirmModal.type === 'unsuspend' && '¿Reactivar usuario?'}
              {confirmModal.type === 'delete' && '¿Eliminar usuario permanentemente?'}
            </h3>
            <p style={{ color: '#94a3b8', fontSize: 14, margin: '0 0 8px' }}>
              Usuario: <strong style={{ color: 'white' }}>{confirmModal.userName}</strong>
            </p>
            {confirmModal.type === 'delete' && (
              <p style={{ color: '#ef4444', fontSize: 13, margin: '0 0 16px', padding: 12, background: 'rgba(239,68,68,0.1)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)' }}>
                ⚠️ Esta acción es IRREVERSIBLE. Se eliminarán su perfil y membresías.
              </p>
            )}
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button
                onClick={closeConfirmModal}
                disabled={actionLoading}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: 8,
                  color: '#94a3b8',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={executeConfirmedAction}
                disabled={actionLoading}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: confirmModal.type === 'delete' ? '#dc2626' : confirmModal.type === 'suspend' ? '#ef4444' : '#22c55e',
                  border: 'none',
                  borderRadius: 8,
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: actionLoading ? 'wait' : 'pointer',
                  opacity: actionLoading ? 0.7 : 1
                }}
              >
                {actionLoading ? 'Procesando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}
