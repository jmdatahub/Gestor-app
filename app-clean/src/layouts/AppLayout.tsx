import { useEffect, useState, useRef, useCallback } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import SettingsPanel from '../components/SettingsPanel'
import { useI18n } from '../hooks/useI18n'
import { useOffline } from '../context/OfflineContext'
import SidebarUserMenu from '../components/layout/SidebarUserMenu'
import { getMyPendingInvitations } from '../services/organizationService'
import { countPendingDebts } from '../services/debtService'
import { useWorkspace } from '../context/WorkspaceContext'
import { HeaderWorkspaceSelector } from '../components/layout/HeaderWorkspaceSelector'

import { 
  LayoutDashboard, 
  Wallet, 
  LogOut,
  Menu,
  X,
  Building,
  ArrowUpDown,
  PiggyBank,
  RefreshCw,
  WifiOff,
  Shield,
  Download,
  TrendingUp,
  Bell,
  CreditCard,
  Lightbulb,
  Tag,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Mail
} from 'lucide-react'

// Constants
const MIN_SIDEBAR_WIDTH = 240
const MAX_SIDEBAR_WIDTH = 420
const COLLAPSED_WIDTH = 72
const DEFAULT_WIDTH = 280

export default function AppLayout() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const { isOnline, pendingChanges, isSyncing, syncNow } = useOffline()
  const { currentWorkspace, workspaces, switchWorkspace } = useWorkspace()
  const [loading, setLoading] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pendingInvitations, setPendingInvitations] = useState(0)
  const [pendingDebts, setPendingDebts] = useState(0)
  
  // Workspace Switch Transition State
  const [isSwitchingWorkspace, setIsSwitchingWorkspace] = useState(false)

  // Sidebar State
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('sidebarWidth')
    return saved ? parseInt(saved) : DEFAULT_WIDTH
  })
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('sidebarCollapsed') === 'true'
  })
  const [isResizing, setIsResizing] = useState(false)
  const sidebarRef = useRef<HTMLElement>(null)

  useEffect(() => {
    checkAuth()

    // Listen for auth changes to keep invitations in sync
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user?.email) {
        updateInvitations(session.user.email)
      } else if (event === 'SIGNED_OUT') {
        setPendingInvitations(0)
      }
    })

    // Listen for custom event to refresh invitations (e.g. after accept/decline)
    const handleRefresh = () => {
      supabase.auth.getUser().then(({ data }) => {
        if (data.user?.email) updateInvitations(data.user.email)
      })
    }
    window.addEventListener('refreshInvitations', handleRefresh)

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('refreshInvitations', handleRefresh)
    }
  }, [])

  const updateInvitations = async (email: string) => {
    try {
      const invitations = await getMyPendingInvitations(email)
      setPendingInvitations(invitations.length)
    } catch (err) {
      console.error('Error updating invitations:', err)
    }
  }

  const updatePendingDebts = async (userId: string) => {
    try {
      const count = await countPendingDebts(userId, currentWorkspace?.id)
      setPendingDebts(count)
    } catch (err) {
      console.error('Error updating pending debts:', err)
    }
  }

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      navigate('/auth')
    } else {
      if (session.user?.email) {
        updateInvitations(session.user.email)
        updatePendingDebts(session.user.id)
      }
    }
    setLoading(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/auth')
  }

  // Persist Sidebar State
  useEffect(() => {
    localStorage.setItem('sidebarWidth', sidebarWidth.toString())
  }, [sidebarWidth])

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', isCollapsed.toString())
  }, [isCollapsed])

  // Resize Handler
  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(e.clientX, MAX_SIDEBAR_WIDTH))
      setSidebarWidth(newWidth)
      if (isCollapsed && newWidth > MIN_SIDEBAR_WIDTH) {
         setIsCollapsed(false) // Auto expand if dragged
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [isCollapsed])

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed)
  }

  const navItems = [
    { key: 'nav.dashboard', path: '/app/dashboard', icon: LayoutDashboard },
    { key: 'nav.organizations', path: '/app/organizations', icon: Building },
    { key: 'nav.summary', path: '/app/summary', icon: BarChart3 },
    { key: 'nav.movements', path: '/app/movements', icon: ArrowUpDown },
    { key: 'nav.categories', path: '/app/categories', icon: Tag },
    { key: 'nav.accounts', path: '/app/accounts', icon: CreditCard },
    { key: 'nav.savings', path: '/app/savings', icon: PiggyBank },
    { key: 'nav.investments', path: '/app/investments', icon: TrendingUp },
    { key: 'nav.recurring', path: '/app/recurring', icon: RefreshCw },
    { key: 'nav.debts', path: '/app/debts', icon: Wallet },
    { key: 'nav.insights', path: '/app/insights', icon: Lightbulb },
    { key: 'nav.alerts', path: '/app/alerts', icon: Bell },
    { key: 'nav.export', path: '/app/export', icon: Download },
    { key: 'nav.admin', path: '/app/admin', icon: Shield },
  ]

  if (loading) {
    return (
      <div className="loading-container" style={{ minHeight: '100vh' }}>
        <div className="spinner"></div>
      </div>
    )
  }

  const handleWorkspaceSwitch = async () => {
    setIsSwitchingWorkspace(true)
    // Artificial delay for animation
    return new Promise<void>(resolve => {
      setTimeout(() => {
        setIsSwitchingWorkspace(false)
        resolve()
      }, 800)
    })
  }

  return (
    <div className="app-container">
      
      {/* Workspace Switch Transition Overlay */}
      {isSwitchingWorkspace && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.8)',
          backdropFilter: 'blur(12px)',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'fadeIn 0.3s ease-out'
        }}>
          <div style={{
            width: 80, height: 80,
            borderRadius: 24,
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 24,
            boxShadow: '0 0 40px var(--primary-soft)',
            animation: 'pulse 1.5s infinite'
          }}>
            <Building size={40} color="white" />
          </div>
          <h2 style={{ 
            color: 'white', 
            fontSize: 24, 
            fontWeight: 700, 
            letterSpacing: '-0.5px',
            animation: 'slideUp 0.5s ease-out'
          }}>
            Cambiando Espacio de Trabajo...
          </h2>
          <p style={{ 
            color: 'var(--text-secondary)', 
            marginTop: 8,
            animation: 'slideUp 0.6s ease-out'
          }}>
             Un momento por favor
          </p>
        </div>
      )}

      {/* Sidebar - Desktop */}
      <aside 
        ref={sidebarRef}
        className={`app-sidebar ${isCollapsed ? 'is-collapsed' : ''} ${isResizing ? 'is-resizing' : ''}`}
        style={{ width: isCollapsed ? COLLAPSED_WIDTH : sidebarWidth }}
      >
        <div 
           className={`sidebar-resize-handle ${isResizing ? 'is-resizing' : ''}`}
           onMouseDown={startResizing}
           title="Drag to resize"
        />

        <div className="sidebar-header">
          <div className="sidebar-logo flex items-center gap-3 overflow-hidden">
            <div className="sidebar-logo-badge">MP</div>
            <span className="sidebar-logo-text font-bold text-lg whitespace-nowrap transition-opacity duration-200">
               Mi Panel
            </span>
          </div>
          <button 
            className="sidebar-collapse-btn" 
            onClick={toggleCollapse}
            title={isCollapsed ? "Expandir" : "Colapsar"}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
        
        <nav className="nav-section">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => 
                `nav-item ${isActive ? 'active' : ''}`
              }
              title={isCollapsed ? t(item.key) : ''}
            >
              <div className="nav-item-icon" style={{ position: 'relative' }}>
                <item.icon size={20} />
                {/* Red badge for pending invitations on Dashboard */}
                {item.path === '/app/dashboard' && pendingInvitations > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    minWidth: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                    color: 'white',
                    fontSize: 10,
                    fontWeight: 700,
                    animation: 'pulse 2s infinite'
                  }}>
                    {pendingInvitations}
                  </span>
                )}
                {/* Red badge for pending debts */}
                {item.key === 'nav.debts' && pendingDebts > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    minWidth: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: '#ef4444',
                    color: 'white',
                    fontSize: 9,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid var(--sidebar-bg)'
                  }}>
                    {pendingDebts}
                  </span>
                )}
              </div>
              <span className="nav-item-text transition-opacity duration-200 whitespace-nowrap">
                {t(item.key)}
              </span>
              {/* Text badge when not collapsed */}
              {item.path === '/app/dashboard' && pendingInvitations > 0 && !isCollapsed && (
                <span style={{
                  marginLeft: 'auto',
                  padding: '2px 8px',
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  color: 'white',
                  fontSize: 11,
                  fontWeight: 600,
                  boxShadow: '0 2px 6px rgba(239,68,68,0.4)'
                }}>
                  {pendingInvitations} 📩
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        
        <div className="sidebar-footer">
           <SidebarUserMenu isCollapsed={isCollapsed} />
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="mobile-header">
        <div className="mobile-brand">
          <div className="header-logo-badge">MP</div>
          <span className="mobile-logo">Mi Panel</span>
        </div>
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="mobile-menu-btn"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="mobile-sidebar">
          <div className="sidebar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="sidebar-logo flex items-center gap-3">
              <div className="sidebar-logo-badge">MP</div>
              <span className="text-white font-bold text-lg">Mi Panel</span>
            </div>
            <button 
              onClick={() => setMobileMenuOpen(false)}
              className="mobile-menu-btn"
            >
              <X size={24} />
            </button>
          </div>
          
          <nav className="nav-section">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) => 
                  `nav-item ${isActive ? 'active' : ''}`
                }
              >
                <div className="nav-item-icon">
                  <item.icon size={20} />
                </div>
                <span className="nav-item-text">{t(item.key)}</span>
              </NavLink>
            ))}
          </nav>
          
          <div className="sidebar-footer">
            <button onClick={handleSignOut} className="nav-item w-full text-red-400">
              <div className="nav-item-icon">
                <LogOut size={20} />
              </div>
              <span>{t('nav.logout')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="app-main">
        <header className="app-header flex justify-between items-center px-6 h-[80px] border-b border-[var(--border-color)] bg-[var(--bg-header)]">
          <div className="header-brand flex items-center gap-4">
            <h1 className="header-title">{t('app.name')}</h1>
            {/* Workspace Selector in Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginLeft: 8 }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: 14, marginRight: 16 }}>|</span>
              <HeaderWorkspaceSelector onBeforeSwitch={handleWorkspaceSwitch} />
            </div>
          </div>
            {/* Right Side Actions */}
            <div className="flex items-center gap-3">
              {!isOnline && (
                <div className="badge badge-warning flex items-center gap-1" title="Modo sin conexión">
                  <WifiOff size={14} />
                  <span className="hidden sm:inline">Offline</span>
                </div>
              )}
              
              {pendingChanges > 0 && (
                <div className="badge badge-info flex items-center gap-1" title={`${pendingChanges} cambios pendientes`}>
                  <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                  <span className="hidden sm:inline">{pendingChanges} cambios</span>
                </div>
              )}

              {isOnline && pendingChanges > 0 && (
                <button 
                  onClick={() => syncNow()} 
                  className="icon-button text-primary"
                  disabled={isSyncing}
                  title="Sincronizar ahora"
                >
                  <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />
                </button>
              )}

            <button 
              className="icon-button"
              onClick={() => setSettingsOpen(true)}
              aria-label={t('settings.title')}
            >
              <Settings size={20} />
            </button>
           </div>
        </header>

        
        {/* Settings Panel */}
        <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        
        <div className="p-6 flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>

    </div>
  )
}

