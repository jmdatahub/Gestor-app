import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
// import { AdminDashboard } from '../../components/admin/AdminDashboard'
import { ExportMenu } from '../../components/shared/ExportMenu'
// import { exportToCSV } from '../../utils/exportUtils'
// import { downloadFile } from '../../services/exportService'
// import { UiDropdown, UiDropdownItem } from '../../components/ui/UiDropdown'
import { supabase } from '../../lib/supabaseClient'
import { 
  getAllUsers, 
  getUserCount, 
  getSuspendedCount, 
  getOrganizationCount,
  suspendUser, 
  unsuspendUser,
  deleteUserProfile,
  checkIsSuperAdmin,
  getAllOrganizations,
  getDeletedOrganizations,
  updateOrganization,
  deleteOrganization,
  restoreOrganization,
  permanentDeleteOrganization,
  checkDatabaseHealth,
  type UserProfile,
  type AdminOrganization
} from '../../services/adminService'
import { useI18n } from '../../hooks/useI18n'
import { 
  Users, 
  Shield, 
  Activity, 
  Search, 
  Filter, 
  MoreVertical, 
  Trash2, 
  UserX, 
  UserCheck,
  RefreshCw,
  Building,
  Download,
  Eye,
  FileText,
  FileJson,
  ExternalLink,
  AlertTriangle,
  Edit2,
  Undo2
} from 'lucide-react'

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
  const [activeTab, setActiveTab] = useState<'users' | 'orgs' | 'trash'>('users')
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
  
  // Organization details modal state
  const [selectedOrg, setSelectedOrg] = useState<AdminOrganization | null>(null)
  const [orgMembers, setOrgMembers] = useState<any[]>([])
  const [loadingOrgDetails, setLoadingOrgDetails] = useState(false)
  const [showExpandedDetails, setShowExpandedDetails] = useState(false)
  const [orgStats, setOrgStats] = useState<{
    totalIncome: number
    totalExpenses: number
    totalBalance: number
    movementCount: number
    accountCount: number
    recentMovements: any[]
    accounts: any[]
  } | null>(null)

  // User details modal state
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
  const [loadingUserDetails, setLoadingUserDetails] = useState(false)
  const [userStats, setUserStats] = useState<{
    totalIncome: number
    totalExpenses: number
    totalBalance: number
    movementCount: number
    accountCount: number
    recentMovements: any[]
    accounts: any[]
    organizations: any[]
  } | null>(null)

  // Organization edit/delete state
  const [editingOrg, setEditingOrg] = useState<AdminOrganization | null>(null)
  const [editOrgName, setEditOrgName] = useState('')
  const [editOrgDescription, setEditOrgDescription] = useState('')
  const [savingOrg, setSavingOrg] = useState(false)
  const [deleteOrgConfirm, setDeleteOrgConfirm] = useState<AdminOrganization | null>(null)
  const [deletingOrg, setDeletingOrg] = useState(false)

  // Trash (papelera) state
  const [deletedOrgs, setDeletedOrgs] = useState<AdminOrganization[]>([])
  const [loadingTrash, setLoadingTrash] = useState(false)
  const [restoringOrg, setRestoringOrg] = useState<string | null>(null)
  const [permanentDeleteConfirm, setPermanentDeleteConfirm] = useState<AdminOrganization | null>(null)
  const [permanentDeleting, setPermanentDeleting] = useState(false)

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
            await loadTrash() // Load deleted organizations
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

  // Handle organization edit
  const handleEditOrg = (org: AdminOrganization) => {
    setEditingOrg(org)
    setEditOrgName(org.name)
    setEditOrgDescription(org.description || '')
  }

  const handleSaveOrg = async () => {
    if (!editingOrg || !editOrgName.trim()) return
    setSavingOrg(true)
    try {
      await updateOrganization(editingOrg.id, {
        name: editOrgName.trim(),
        description: editOrgDescription.trim() || null
      })
      setEditingOrg(null)
      await loadOrganizations()
      await loadStats()
    } catch (error: any) {
      alert('Error al guardar: ' + (error.message || 'Error desconocido'))
    } finally {
      setSavingOrg(false)
    }
  }

  // Handle organization delete
  const handleDeleteOrg = async () => {
    if (!deleteOrgConfirm) return
    setDeletingOrg(true)
    try {
      await deleteOrganization(deleteOrgConfirm.id)
      setDeleteOrgConfirm(null)
      await loadOrganizations()
      await loadTrash() // Reload trash after soft-delete
      await loadStats()
    } catch (error: any) {
      alert('Error al eliminar: ' + (error.message || 'Error desconocido'))
    } finally {
      setDeletingOrg(false)
    }
  }

  // Load deleted organizations (trash/papelera)
  const loadTrash = async () => {
    setLoadingTrash(true)
    try {
      const data = await getDeletedOrganizations()
      setDeletedOrgs(data)
    } catch (error) {
      console.error('Error loading trash:', error)
    } finally {
      setLoadingTrash(false)
    }
  }

  // Restore organization from trash
  const handleRestoreOrg = async (orgId: string) => {
    setRestoringOrg(orgId)
    try {
      await restoreOrganization(orgId)
      await loadOrganizations()
      await loadTrash()
      await loadStats()
    } catch (error: any) {
      alert('Error al restaurar: ' + (error.message || 'Error desconocido'))
    } finally {
      setRestoringOrg(null)
    }
  }

  // Permanently delete organization (no recovery)
  const handlePermanentDelete = async () => {
    if (!permanentDeleteConfirm) return
    setPermanentDeleting(true)
    try {
      await permanentDeleteOrganization(permanentDeleteConfirm.id)
      setPermanentDeleteConfirm(null)
      await loadTrash()
      await loadStats()
    } catch (error: any) {
      alert('Error al eliminar permanentemente: ' + (error.message || 'Error desconocido'))
    } finally {
      setPermanentDeleting(false)
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

  // Load organization details with members and financial stats
  const loadOrgDetails = async (org: AdminOrganization) => {
    setSelectedOrg(org)
    setLoadingOrgDetails(true)
    setOrgMembers([])
    setOrgStats(null)
    
    try {
      // Fetch organization members first
      const { data: members, error: membersError } = await supabase
        .from('organization_members')
        .select('user_id, role, joined_at')
        .eq('org_id', org.id)
      
      if (membersError) {
        console.error('Error loading org members:', membersError)
      }

      // Get profiles if we have members
      let membersWithProfiles: any[] = []
      if (members && members.length > 0) {
        const userIds = members.map(m => m.user_id)
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email, display_name, is_suspended')
          .in('id', userIds)
        
        membersWithProfiles = members.map(member => ({
          ...member,
          profile: profiles?.find(p => p.id === member.user_id) || null
        }))
      }
      setOrgMembers(membersWithProfiles)

      // Fetch financial stats for this organization
      // Get movements with more details for expanded view
      const { data: movements } = await supabase
        .from('movements')
        .select('id, amount, type, description, date, created_at')
        .eq('organization_id', org.id)
        .order('date', { ascending: false })
      
      // Get accounts with names
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, name, balance, type')
        .eq('organization_id', org.id)
        .order('balance', { ascending: false })
      
      // Calculate stats
      let totalIncome = 0
      let totalExpenses = 0
      if (movements) {
        movements.forEach(m => {
          if (m.type === 'income') totalIncome += Number(m.amount) || 0
          else if (m.type === 'expense') totalExpenses += Number(m.amount) || 0
        })
      }
      
      const totalBalance = accounts?.reduce((sum, a) => sum + (Number(a.balance) || 0), 0) || 0
      
      setOrgStats({
        totalIncome,
        totalExpenses,
        totalBalance,
        movementCount: movements?.length || 0,
        accountCount: accounts?.length || 0,
        recentMovements: movements?.slice(0, 10) || [],
        accounts: accounts || []
      })

    } catch (err) {
      console.error('Error loading org details:', err)
    } finally {
      setLoadingOrgDetails(false)
    }
  }

  const closeOrgDetailsModal = () => {
    setSelectedOrg(null)
    setOrgMembers([])
    setOrgStats(null)
    setShowExpandedDetails(false)
  }

  // Load user details with financial info
  const loadUserDetails = async (user: UserProfile) => {
    setSelectedUser(user)
    setLoadingUserDetails(true)
    setUserStats(null)
    
    try {
      // Get user's personal movements (where organization_id IS NULL)
      const { data: movements } = await supabase
        .from('movements')
        .select('id, amount, type, description, date')
        .eq('user_id', user.id)
        .is('organization_id', null)
        .order('date', { ascending: false })
      
      // Get user's personal accounts
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, name, balance, type')
        .eq('user_id', user.id)
        .is('organization_id', null)
        .order('balance', { ascending: false })
      
      // Get user's organization memberships
      const { data: memberships } = await supabase
        .from('organization_members')
        .select(`
          role,
          joined_at,
          organization:organizations (
            id,
            name
          )
        `)
        .eq('user_id', user.id)
      
      // Calculate stats
      let totalIncome = 0
      let totalExpenses = 0
      if (movements) {
        movements.forEach(m => {
          if (m.type === 'income') totalIncome += Number(m.amount) || 0
          else if (m.type === 'expense') totalExpenses += Number(m.amount) || 0
        })
      }
      
      const totalBalance = accounts?.reduce((sum, a) => sum + (Number(a.balance) || 0), 0) || 0
      
      setUserStats({
        totalIncome,
        totalExpenses,
        totalBalance,
        movementCount: movements?.length || 0,
        accountCount: accounts?.length || 0,
        recentMovements: movements?.slice(0, 10) || [],
        accounts: accounts || [],
        organizations: memberships || []
      })
    } catch (err) {
      console.error('Error loading user details:', err)
    } finally {
      setLoadingUserDetails(false)
    }
  }

  const closeUserDetailsModal = () => {
    setSelectedUser(null)
    setUserStats(null)
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

  // Prepare Export Data (MUST be before conditional returns to comply with Rules of Hooks)
  const exportColumns = activeTab === 'users' 
    ? [
        { header: 'ID', key: 'id', width: 36 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Nombre', key: 'name', width: 25 },
        { header: 'Estado', key: 'status', width: 15 },
        { header: 'Fecha Registro', key: 'date', width: 20 }
      ]
    : [
        { header: 'ID', key: 'id', width: 36 },
        { header: 'Nombre', key: 'name', width: 25 },
        { header: 'Slug', key: 'slug', width: 20 },
        { header: 'Descripción', key: 'description', width: 40 },
        { header: 'Fecha Creación', key: 'date', width: 20 }
      ]

  const exportData = useMemo(() => {
    if (activeTab === 'users') {
      return filteredUsers.map(user => ({
        id: user.id,
        email: user.email,
        name: user.display_name || 'Sin nombre',
        status: user.is_suspended ? 'Suspendido' : 'Activo',
        date: user.created_at ? new Date(user.created_at).toLocaleString('es-ES') : '-'
      }))
    } else {
      return organizations.map(org => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        description: org.description || '',
        date: org.created_at ? new Date(org.created_at).toLocaleString('es-ES') : '-'
      }))
    }
  }, [activeTab, filteredUsers, organizations])


  // Conditional returns (after all hooks)
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
          
          <ExportMenu 
             data={exportData}
             columns={exportColumns}
             filename={`admin_${activeTab}_${new Date().toISOString().split('T')[0]}`}
             disabled={loadingUsers || loadingOrgs}
             hideCSV={true}
          />
        </div>
      </div>

      {/* Dashboard Charts (Disabled per user request)
      {!loading && (
        <AdminDashboard users={users} organizations={organizations} />
      )}
      */}

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
        <button
          onClick={() => setActiveTab('trash')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px',
            background: activeTab === 'trash' ? '#ef4444' : '#1e293b',
            border: `1px solid ${activeTab === 'trash' ? '#ef4444' : '#334155'}`,
            borderRadius: 10, color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer'
          }}
        >
          <Trash2 size={16} /> Papelera <span style={{ marginLeft: 4, fontSize: 11, opacity: 0.7 }}>({deletedOrgs.length})</span>
        </button>
      </div>

      {/* Data Table Section */}
      <div style={{ background: '#1e293b', borderRadius: 20, border: '1px solid #334155', overflow: 'hidden' }}>
        {/* Table Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h3 style={{ color: 'white', fontSize: 16, fontWeight: 700, margin: 0 }}>
              {activeTab === 'users' && 'Gestión de Usuarios'}
              {activeTab === 'orgs' && 'Gestión de Organizaciones'}
              {activeTab === 'trash' && '🗑️ Papelera'}
            </h3>
            <p style={{ color: '#64748b', fontSize: 13, margin: '4px 0 0' }}>
              {activeTab === 'users' && 'Administra permisos y estados'}
              {activeTab === 'orgs' && 'Visualiza todas las organizaciones del sistema'}
              {activeTab === 'trash' && 'Organizaciones eliminadas (se borran permanentemente después de 7 días)'}
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
                              onClick={() => loadUserDetails(user)}
                              style={{ padding: '6px 12px', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 8, color: '#8b5cf6', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            >
                              <Eye size={14} /> Detalles
                            </button>
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
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <button 
                            onClick={() => loadOrgDetails(org)}
                            style={{ padding: '6px 12px', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 8, color: '#8b5cf6', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            <Eye size={14} /> Ver
                          </button>
                          <button 
                            onClick={() => handleEditOrg(org)}
                            style={{ padding: '6px 12px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, color: '#3b82f6', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            <Edit2 size={14} /> Editar
                          </button>
                          <button 
                            onClick={() => setDeleteOrgConfirm(org)}
                            style={{ padding: '6px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            <Trash2 size={14} /> Eliminar
                          </button>
                        </div>
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

          {/* Trash Tab Content */}
          {activeTab === 'trash' && (
            loadingTrash ? (
              <div style={{ padding: 48, textAlign: 'center' }}>
                <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', color: '#94a3b8' }} />
                <p style={{ color: '#64748b', fontSize: 13, marginTop: 12 }}>Cargando papelera...</p>
              </div>
            ) : deletedOrgs.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center' }}>
                <Trash2 size={40} style={{ color: '#334155', marginBottom: 12 }} />
                <p style={{ color: '#64748b', fontSize: 13 }}>La papelera está vacía</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(30,41,59,0.5)' }}>
                    <th style={{ padding: '14px 24px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Organización</th>
                    <th style={{ padding: '14px 24px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Eliminada</th>
                    <th style={{ padding: '14px 24px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Días restantes</th>
                    <th style={{ padding: '14px 24px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {deletedOrgs.map((org: any, idx: number) => {
                    const deletedAt = new Date(org.deleted_at)
                    const expiresAt = new Date(deletedAt.getTime() + 7 * 24 * 60 * 60 * 1000)
                    const daysRemaining = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
                    
                    return (
                      <tr key={org.id} style={{ borderTop: '1px solid rgba(51,65,85,0.3)', background: idx % 2 === 0 ? 'transparent' : 'rgba(30,41,59,0.2)' }}>
                        <td style={{ padding: '16px 24px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #ef4444, #dc2626)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 14, opacity: 0.7 }}>
                              🗑️
                            </div>
                            <div>
                              <span style={{ color: '#94a3b8', fontWeight: 600, fontSize: 14, display: 'block', textDecoration: 'line-through' }}>{org.name}</span>
                              {org.description && <span style={{ color: '#64748b', fontSize: 12 }}>{org.description.substring(0, 50)}</span>}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '16px 24px', color: '#94a3b8', fontSize: 13 }}>
                          {deletedAt.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td style={{ padding: '16px 24px' }}>
                          <span style={{ 
                            padding: '4px 10px', 
                            borderRadius: 20, 
                            fontSize: 12, 
                            fontWeight: 600,
                            background: daysRemaining <= 1 ? 'rgba(239,68,68,0.2)' : daysRemaining <= 3 ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.2)',
                            color: daysRemaining <= 1 ? '#ef4444' : daysRemaining <= 3 ? '#f59e0b' : '#22c55e'
                          }}>
                            {daysRemaining} días
                          </span>
                        </td>
                        <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button 
                              onClick={() => handleRestoreOrg(org.id)}
                              disabled={restoringOrg === org.id}
                              style={{ 
                                padding: '6px 12px', 
                                background: 'rgba(34,197,94,0.1)', 
                                border: '1px solid rgba(34,197,94,0.2)', 
                                borderRadius: 8, 
                                color: '#22c55e', 
                                fontSize: 12, 
                                fontWeight: 600, 
                                cursor: 'pointer', 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: 4,
                                opacity: restoringOrg === org.id ? 0.6 : 1
                              }}
                            >
                              <Undo2 size={14} /> {restoringOrg === org.id ? 'Restaurando...' : 'Restaurar'}
                            </button>
                            <button 
                              onClick={() => setPermanentDeleteConfirm(org)}
                              style={{ 
                                padding: '6px 12px', 
                                background: 'rgba(239,68,68,0.1)', 
                                border: '1px solid rgba(239,68,68,0.2)', 
                                borderRadius: 8, 
                                color: '#ef4444', 
                                fontSize: 12, 
                                fontWeight: 600, 
                                cursor: 'pointer', 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: 4
                              }}
                            >
                              <Trash2 size={14} /> Eliminar definitivo
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )
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

      {/* Edit Organization Modal */}
      {editingOrg && (
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
            maxWidth: 450,
            width: '90%',
            boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
          }}>
            <h3 style={{ color: 'white', fontSize: 18, fontWeight: 700, margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Edit2 size={20} style={{ color: '#3b82f6' }} />
              Editar Organización
            </h3>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>Nombre</label>
              <input
                type="text"
                value={editOrgName}
                onChange={(e) => setEditOrgName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: 8,
                  color: 'white',
                  fontSize: 14
                }}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>Descripción</label>
              <textarea
                value={editOrgDescription}
                onChange={(e) => setEditOrgDescription(e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: 8,
                  color: 'white',
                  fontSize: 14,
                  resize: 'vertical'
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setEditingOrg(null)}
                disabled={savingOrg}
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
                onClick={handleSaveOrg}
                disabled={savingOrg || !editOrgName.trim()}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                  border: 'none',
                  borderRadius: 8,
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  opacity: savingOrg ? 0.7 : 1
                }}
              >
                {savingOrg ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Organization Confirmation Modal */}
      {deleteOrgConfirm && (
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
            maxWidth: 420,
            width: '90%',
            boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
          }}>
            <h3 style={{ color: '#ef4444', fontSize: 18, fontWeight: 700, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={20} />
              ¿Eliminar organización?
            </h3>
            <p style={{ color: '#94a3b8', fontSize: 14, margin: '0 0 8px' }}>
              Organización: <strong style={{ color: 'white' }}>{deleteOrgConfirm.name}</strong>
            </p>
            <div style={{ 
              color: '#ef4444', 
              fontSize: 13, 
              margin: '0 0 20px', 
              padding: 12, 
              background: 'rgba(239,68,68,0.1)', 
              borderRadius: 8, 
              border: '1px solid rgba(239,68,68,0.2)' 
            }}>
              ⚠️ Esta acción es <strong>IRREVERSIBLE</strong>. Se eliminarán:
              <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                <li>Todos los miembros</li>
                <li>Todas las invitaciones pendientes</li>
                <li>La organización completa</li>
              </ul>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setDeleteOrgConfirm(null)}
                disabled={deletingOrg}
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
                onClick={handleDeleteOrg}
                disabled={deletingOrg}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  border: 'none',
                  borderRadius: 8,
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  opacity: deletingOrg ? 0.7 : 1
                }}
              >
                {deletingOrg ? 'Eliminando...' : 'Sí, Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PERMANENT Delete Organization Confirmation Modal */}
      {permanentDeleteConfirm && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(8px)'
        }}>
          <div style={{
            background: 'linear-gradient(180deg, #1e293b, #0f172a)',
            border: '2px solid #ef4444',
            borderRadius: 16,
            padding: 24,
            maxWidth: 450,
            width: '90%',
            boxShadow: '0 25px 50px rgba(239,68,68,0.3)'
          }}>
            <h3 style={{ color: '#ef4444', fontSize: 20, fontWeight: 700, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
              ⚠️ ELIMINACIÓN PERMANENTE
            </h3>
            <p style={{ color: '#94a3b8', fontSize: 14, margin: '0 0 8px' }}>
              Organización: <strong style={{ color: 'white' }}>{permanentDeleteConfirm.name}</strong>
            </p>
            <div style={{ 
              color: '#ef4444', 
              fontSize: 14, 
              margin: '0 0 20px', 
              padding: 16, 
              background: 'rgba(239,68,68,0.15)', 
              borderRadius: 8, 
              border: '1px solid rgba(239,68,68,0.4)',
              fontWeight: 500
            }}>
              🚨 <strong>ESTA ACCIÓN NO SE PUEDE DESHACER</strong>
              <br /><br />
              Se eliminarán PERMANENTEMENTE:
              <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                <li>Todos los miembros de la organización</li>
                <li>Todas las invitaciones pendientes</li>
                <li>La organización y todos sus datos</li>
              </ul>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setPermanentDeleteConfirm(null)}
                disabled={permanentDeleting}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  background: '#22c55e',
                  border: 'none',
                  borderRadius: 8,
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                ← Cancelar (mantener)
              </button>
              <button
                onClick={handlePermanentDelete}
                disabled={permanentDeleting}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  background: 'linear-gradient(135deg, #dc2626, #991b1b)',
                  border: 'none',
                  borderRadius: 8,
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  opacity: permanentDeleting ? 0.7 : 1
                }}
              >
                {permanentDeleting ? 'Eliminando...' : '🗑️ ELIMINAR PARA SIEMPRE'}
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* User Details Modal - Portal to body */}
      {selectedUser && createPortal(
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) closeUserDetailsModal() }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            backdropFilter: 'blur(6px)',
            padding: '16px',
            boxSizing: 'border-box'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 16,
              padding: '20px',
              width: 'min(600px, calc(100vw - 32px))',
              maxHeight: 'calc(100vh - 32px)',
              overflowY: 'auto',
              boxShadow: '0 25px 50px rgba(0,0,0,0.6)'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h3 style={{ color: 'white', fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>
                  👤 {selectedUser.display_name || 'Sin nombre'}
                </h3>
                <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>{selectedUser.email}</p>
              </div>
              <button 
                onClick={closeUserDetailsModal}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 24 }}
              >
                ×
              </button>
            </div>

            {/* User Info */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 }}>
              <div style={{ padding: 12, background: '#0f172a', borderRadius: 8, border: '1px solid #334155' }}>
                <div style={{ color: '#64748b', fontSize: 11, marginBottom: 4, textTransform: 'uppercase' }}>ID de Usuario</div>
                <div style={{ color: '#94a3b8', fontSize: 11, fontFamily: 'monospace', wordBreak: 'break-all' }}>{selectedUser.id}</div>
              </div>
              <div style={{ padding: 12, background: '#0f172a', borderRadius: 8, border: '1px solid #334155' }}>
                <div style={{ color: '#64748b', fontSize: 11, marginBottom: 4, textTransform: 'uppercase' }}>Estado</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: selectedUser.is_suspended ? '#ef4444' : '#22c55e' }} />
                  <span style={{ color: selectedUser.is_suspended ? '#ef4444' : '#22c55e', fontSize: 12, fontWeight: 600 }}>
                    {selectedUser.is_suspended ? 'Suspendido' : 'Activo'}
                  </span>
                </div>
              </div>
            </div>

            {/* Loading or Stats */}
            {loadingUserDetails ? (
              <div style={{ padding: 24, textAlign: 'center' }}>
                <div style={{ width: 30, height: 30, margin: '0 auto', border: '3px solid #334155', borderTopColor: '#8b5cf6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                <p style={{ color: '#64748b', fontSize: 12, marginTop: 12 }}>Cargando información...</p>
              </div>
            ) : userStats && (
              <>
                {/* Financial Stats */}
                <h4 style={{ color: 'white', fontSize: 14, fontWeight: 600, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  📊 Finanzas Personales
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 }}>
                  <div style={{ padding: 14, background: 'linear-gradient(135deg, rgba(34,197,94,0.1), rgba(34,197,94,0.05))', borderRadius: 12, border: '1px solid rgba(34,197,94,0.2)' }}>
                    <div style={{ color: '#22c55e', fontSize: 11, fontWeight: 600, marginBottom: 2, textTransform: 'uppercase' }}>Ingresos</div>
                    <div style={{ color: '#22c55e', fontSize: 18, fontWeight: 700 }}>
                      {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(userStats.totalIncome)}
                    </div>
                  </div>
                  <div style={{ padding: 14, background: 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(239,68,68,0.05))', borderRadius: 12, border: '1px solid rgba(239,68,68,0.2)' }}>
                    <div style={{ color: '#ef4444', fontSize: 11, fontWeight: 600, marginBottom: 2, textTransform: 'uppercase' }}>Gastos</div>
                    <div style={{ color: '#ef4444', fontSize: 18, fontWeight: 700 }}>
                      {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(userStats.totalExpenses)}
                    </div>
                  </div>
                  <div style={{ padding: 14, background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(99,102,241,0.05))', borderRadius: 12, border: '1px solid rgba(99,102,241,0.2)' }}>
                    <div style={{ color: '#6366f1', fontSize: 11, fontWeight: 600, marginBottom: 2, textTransform: 'uppercase' }}>Balance</div>
                    <div style={{ color: '#6366f1', fontSize: 18, fontWeight: 700 }}>
                      {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(userStats.totalBalance)}
                    </div>
                  </div>
                  <div style={{ padding: 14, background: '#0f172a', borderRadius: 12, border: '1px solid #334155' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase' }}>Movimientos</div>
                        <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>{userStats.movementCount}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase' }}>Cuentas</div>
                        <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>{userStats.accountCount}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Organizations */}
                {userStats.organizations.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <h4 style={{ color: 'white', fontSize: 13, fontWeight: 600, margin: '0 0 8px' }}>
                      🏢 Organizaciones ({userStats.organizations.length})
                    </h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {userStats.organizations.map((mem: any, idx: number) => (
                        <div key={idx} style={{ padding: '6px 10px', background: '#0f172a', borderRadius: 6, border: '1px solid #334155', fontSize: 12 }}>
                          <span style={{ color: 'white' }}>{mem.organization?.name || 'Org'}</span>
                          <span style={{ marginLeft: 6, color: '#8b5cf6', fontSize: 10, textTransform: 'uppercase' }}>{mem.role}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Accounts */}
                {userStats.accounts.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <h4 style={{ color: 'white', fontSize: 13, fontWeight: 600, margin: '0 0 8px' }}>💳 Cuentas</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {userStats.accounts.slice(0, 5).map((acc: any) => (
                        <div key={acc.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#0f172a', borderRadius: 6, border: '1px solid #334155' }}>
                          <span style={{ color: 'white', fontSize: 12 }}>{acc.name}</span>
                          <span style={{ color: Number(acc.balance) >= 0 ? '#22c55e' : '#ef4444', fontSize: 12, fontWeight: 600 }}>
                            {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(acc.balance || 0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Movements */}
                {userStats.recentMovements.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <h4 style={{ color: 'white', fontSize: 13, fontWeight: 600, margin: '0 0 8px' }}>📋 Últimos Movimientos</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                      {userStats.recentMovements.map((mov: any) => (
                        <div key={mov.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#0f172a', borderRadius: 6, border: '1px solid #334155' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ color: 'white', fontSize: 11 }}>{mov.description || 'Sin descripción'}</div>
                            <div style={{ color: '#64748b', fontSize: 10 }}>{mov.date ? new Date(mov.date).toLocaleDateString('es-ES') : '-'}</div>
                          </div>
                          <span style={{ color: mov.type === 'income' ? '#22c55e' : '#ef4444', fontSize: 12, fontWeight: 600 }}>
                            {mov.type === 'income' ? '+' : '-'}{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(mov.amount || 0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Close Button */}
            <button
              onClick={closeUserDetailsModal}
              style={{ width: '100%', padding: '10px 16px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#94a3b8', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              Cerrar
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Organization Details Modal - Portal to body */}
      {selectedOrg && createPortal(
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) closeOrgDetailsModal() }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            backdropFilter: 'blur(6px)',
            padding: '16px',
            boxSizing: 'border-box'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 16,
              padding: '20px',
              width: 'min(600px, calc(100vw - 32px))',
              maxHeight: 'calc(100vh - 32px)',
              overflowY: 'auto',
              boxShadow: '0 25px 50px rgba(0,0,0,0.6)'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h3 style={{ color: 'white', fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>
                  {selectedOrg.name}
                </h3>
                {selectedOrg.description && (
                  <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>{selectedOrg.description}</p>
                )}
              </div>
              <button 
                onClick={closeOrgDetailsModal}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 24 }}
              >
                ×
              </button>
            </div>

            {/* Organization Info */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
              <div style={{ padding: 12, background: '#0f172a', borderRadius: 8, border: '1px solid #334155' }}>
                <div style={{ color: '#64748b', fontSize: 11, marginBottom: 4, textTransform: 'uppercase' }}>ID</div>
                <div style={{ color: '#94a3b8', fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all' }}>{selectedOrg.id}</div>
              </div>
              <div style={{ padding: 12, background: '#0f172a', borderRadius: 8, border: '1px solid #334155' }}>
                <div style={{ color: '#64748b', fontSize: 11, marginBottom: 4, textTransform: 'uppercase' }}>Slug</div>
                <div style={{ color: '#94a3b8', fontSize: 12 }}>{selectedOrg.slug || '-'}</div>
              </div>
              <div style={{ padding: 12, background: '#0f172a', borderRadius: 8, border: '1px solid #334155' }}>
                <div style={{ color: '#64748b', fontSize: 11, marginBottom: 4, textTransform: 'uppercase' }}>Creada</div>
                <div style={{ color: '#94a3b8', fontSize: 12 }}>{formatDate(selectedOrg.created_at)}</div>
              </div>
            </div>

            {/* Financial Statistics */}
            {orgStats && (
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ color: 'white', fontSize: 14, fontWeight: 600, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  📊 Estadísticas Financieras
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                  {/* Income */}
                  <div style={{ padding: 16, background: 'linear-gradient(135deg, rgba(34,197,94,0.1), rgba(34,197,94,0.05))', borderRadius: 12, border: '1px solid rgba(34,197,94,0.2)' }}>
                    <div style={{ color: '#22c55e', fontSize: 11, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>Ingresos Totales</div>
                    <div style={{ color: '#22c55e', fontSize: 20, fontWeight: 700 }}>
                      {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(orgStats.totalIncome)}
                    </div>
                  </div>
                  
                  {/* Expenses */}
                  <div style={{ padding: 16, background: 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(239,68,68,0.05))', borderRadius: 12, border: '1px solid rgba(239,68,68,0.2)' }}>
                    <div style={{ color: '#ef4444', fontSize: 11, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>Gastos Totales</div>
                    <div style={{ color: '#ef4444', fontSize: 20, fontWeight: 700 }}>
                      {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(orgStats.totalExpenses)}
                    </div>
                  </div>
                  
                  {/* Balance */}
                  <div style={{ padding: 16, background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(99,102,241,0.05))', borderRadius: 12, border: '1px solid rgba(99,102,241,0.2)' }}>
                    <div style={{ color: '#6366f1', fontSize: 11, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>Balance Total</div>
                    <div style={{ color: '#6366f1', fontSize: 20, fontWeight: 700 }}>
                      {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(orgStats.totalBalance)}
                    </div>
                  </div>
                  
                  {/* Counts */}
                  <div style={{ padding: 16, background: '#0f172a', borderRadius: 12, border: '1px solid #334155' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ color: '#64748b', fontSize: 11, marginBottom: 2, textTransform: 'uppercase' }}>Movimientos</div>
                        <div style={{ color: 'white', fontSize: 20, fontWeight: 700 }}>{orgStats.movementCount}</div>
                      </div>
                      <div>
                        <div style={{ color: '#64748b', fontSize: 11, marginBottom: 2, textTransform: 'uppercase' }}>Cuentas</div>
                        <div style={{ color: 'white', fontSize: 20, fontWeight: 700 }}>{orgStats.accountCount}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Members */}
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ color: 'white', fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>
                Miembros ({orgMembers.length})
              </h4>
              
              {loadingOrgDetails ? (
                <div style={{ padding: 24, textAlign: 'center' }}>
                  <div style={{ width: 30, height: 30, margin: '0 auto', border: '3px solid #334155', borderTopColor: '#8b5cf6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                </div>
              ) : orgMembers.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: 16 }}>No hay miembros</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {orgMembers.map((member: any) => (
                    <div 
                      key={member.user_id}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        padding: '10px 12px', 
                        background: '#0f172a', 
                        borderRadius: 8, 
                        border: '1px solid #334155' 
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ 
                          width: 32, height: 32, 
                          borderRadius: '50%', 
                          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: 12,
                          fontWeight: 600
                        }}>
                          {(member.profile?.display_name || member.profile?.email || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ color: 'white', fontSize: 13, fontWeight: 500 }}>
                            {member.profile?.display_name || 'Sin nombre'}
                            {member.profile?.is_suspended && (
                              <span style={{ marginLeft: 8, padding: '2px 6px', background: 'rgba(239,68,68,0.2)', color: '#ef4444', fontSize: 10, borderRadius: 4 }}>
                                SUSPENDIDO
                              </span>
                            )}
                          </div>
                          <div style={{ color: '#64748b', fontSize: 11 }}>{member.profile?.email || 'Sin email'}</div>
                        </div>
                      </div>
                      <span style={{
                        padding: '4px 10px',
                        fontSize: 10,
                        fontWeight: 600,
                        borderRadius: 20,
                        textTransform: 'uppercase',
                        background: member.role === 'owner' ? 'rgba(139, 92, 246, 0.2)' : 
                                   member.role === 'admin' ? 'rgba(59, 130, 246, 0.2)' : 
                                   'rgba(100, 116, 139, 0.2)',
                        color: member.role === 'owner' ? '#a78bfa' : 
                               member.role === 'admin' ? '#60a5fa' : 
                               '#94a3b8'
                      }}>
                        {member.role === 'owner' ? 'Propietario' : 
                         member.role === 'admin' ? 'Admin' : 
                         member.role === 'member' ? 'Miembro' : 'Visor'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Expand/Collapse Button - Always show to see detailed info */}
            {orgStats && (
              <button
                onClick={() => setShowExpandedDetails(!showExpandedDetails)}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  marginBottom: 16,
                  background: 'rgba(139,92,246,0.1)',
                  border: '1px solid rgba(139,92,246,0.2)',
                  borderRadius: 8,
                  color: '#a78bfa',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8
                }}
              >
                {showExpandedDetails ? '🔼 Ocultar detalles' : '🔽 Ver más detalles (cuentas y movimientos)'}
              </button>
            )}

            {/* Expanded Details Section */}
            {showExpandedDetails && orgStats && (
              <div style={{ marginBottom: 16 }}>
                {/* Accounts List */}
                {orgStats.accounts.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <h4 style={{ color: 'white', fontSize: 13, fontWeight: 600, margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      💳 Cuentas ({orgStats.accounts.length})
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {orgStats.accounts.map((acc: any) => (
                        <div key={acc.id} style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          padding: '8px 12px', 
                          background: '#0f172a', 
                          borderRadius: 6, 
                          border: '1px solid #334155' 
                        }}>
                          <div>
                            <span style={{ color: 'white', fontSize: 13 }}>{acc.name}</span>
                            {acc.type && (
                              <span style={{ marginLeft: 8, color: '#64748b', fontSize: 11 }}>({acc.type})</span>
                            )}
                          </div>
                          <span style={{ 
                            fontSize: 13, 
                            fontWeight: 600,
                            color: Number(acc.balance) >= 0 ? '#22c55e' : '#ef4444' 
                          }}>
                            {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(acc.balance || 0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Movements List */}
                {orgStats.recentMovements.length > 0 && (
                  <div>
                    <h4 style={{ color: 'white', fontSize: 13, fontWeight: 600, margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      📋 Últimos Movimientos ({Math.min(10, orgStats.movementCount)} de {orgStats.movementCount})
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
                      {orgStats.recentMovements.map((mov: any) => (
                        <div key={mov.id} style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          padding: '8px 12px', 
                          background: '#0f172a', 
                          borderRadius: 6, 
                          border: '1px solid #334155' 
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ color: 'white', fontSize: 12 }}>
                              {mov.description || 'Sin descripción'}
                            </div>
                            <div style={{ color: '#64748b', fontSize: 10 }}>
                              {mov.date ? new Date(mov.date).toLocaleDateString('es-ES') : '-'}
                            </div>
                          </div>
                          <span style={{ 
                            fontSize: 13, 
                            fontWeight: 600,
                            color: mov.type === 'income' ? '#22c55e' : '#ef4444',
                            marginLeft: 8
                          }}>
                            {mov.type === 'income' ? '+' : '-'}
                            {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(mov.amount || 0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Close Button */}
            <button
              onClick={closeOrgDetailsModal}
              style={{
                width: '100%',
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
              Cerrar
            </button>
          </div>
        </div>,
        document.body
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
