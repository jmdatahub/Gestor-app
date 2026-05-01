import { useEffect, useState, useRef, useCallback } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { useAuth } from '../context/AuthContext'
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
  ArrowUpDown,
  RefreshCw,
  WifiOff,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Building,
} from 'lucide-react'

// Constants
const MIN_SIDEBAR_WIDTH = 240
const MAX_SIDEBAR_WIDTH = 420
const COLLAPSED_WIDTH = 72
const DEFAULT_WIDTH = 280

export default function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useI18n()
  const { isOnline, pendingChanges, isSyncing, syncNow } = useOffline()
  const { user, signOut, isLoading: authLoading } = useAuth()
  const { currentWorkspace, workspaces, switchWorkspace } = useWorkspace()
  const [loading, setLoading] = useState(false)
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
    if (user === null) {
      navigate('/auth')
    } else if (user) {
      updateInvitations(user.email)
      updatePendingDebts(user.id)
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    const handleRefresh = () => {
      if (user?.email) updateInvitations(user.email)
    }
    window.addEventListener('refreshInvitations', handleRefresh)
    return () => window.removeEventListener('refreshInvitations', handleRefresh)
  }, [user])

  useEffect(() => {
    if (user) updatePendingDebts(user.id)
  }, [currentWorkspace])

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

  const handleSignOut = () => {
    signOut()
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

  const primaryNavItems = [
    { key: 'nav.dashboard', path: '/app/dashboard', icon: LayoutDashboard },
    { key: 'nav.movements', path: '/app/movimientos', icon: ArrowUpDown },
    { key: 'nav.patrimonio', path: '/app/patrimonio', icon: Wallet },
    { key: 'nav.analisis', path: '/app/analisis', icon: BarChart3 },
  ]

  if (authLoading || loading) {
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
          inset: 0,
          background: 'var(--bg-overlay)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'premium-fade-in 220ms ease-out'
        }}>
          <div style={{
            width: 64, height: 64,
            borderRadius: 16,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-display)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 20,
            boxShadow: 'var(--shadow-lg)',
          }}>
            <Building size={28} strokeWidth={1.5} />
          </div>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            color: 'var(--text-display)',
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: '-0.02em',
          }}>
            Cambiando espacio de trabajo
          </h2>
          <p style={{
            color: 'var(--text-secondary)',
            marginTop: 6,
            fontSize: 14,
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
        
        <nav className="nav-section" style={{ flex: 1 }}>
          {primaryNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'active' : ''}`
              }
              title={isCollapsed ? t(item.key) : ''}
            >
              <div className="nav-item-icon" style={{ position: 'relative' }}>
                <item.icon size={18} strokeWidth={1.75} />
                {item.path === '/app/dashboard' && pendingInvitations > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: -3, right: -5,
                    minWidth: 14, height: 14,
                    borderRadius: '50%',
                    background: 'var(--danger)',
                    color: 'var(--bg-card)',
                    fontSize: 9,
                    fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '2px solid var(--bg-sidebar)',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {pendingInvitations}
                  </span>
                )}
                {item.path === '/app/patrimonio' && pendingDebts > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: -3, right: -5,
                    minWidth: 14, height: 14,
                    borderRadius: '50%',
                    background: 'var(--danger)',
                    color: 'var(--bg-card)',
                    fontSize: 9, fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '2px solid var(--bg-sidebar)',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {pendingDebts}
                  </span>
                )}
              </div>
              <span className="nav-item-text transition-opacity duration-200 whitespace-nowrap">
                {t(item.key)}
              </span>
              {item.path === '/app/dashboard' && pendingInvitations > 0 && !isCollapsed && (
                <span className="pill pill--danger" style={{ marginLeft: 'auto' }}>
                  {pendingInvitations}
                </span>
              )}
            </NavLink>
          ))}

          {/* Separator */}
          <div style={{
            height: 1,
            background: 'var(--border-subtle)',
            margin: '12px 12px',
          }} />

          {/* Configuración */}
          <NavLink
            to="/app/config"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            title={isCollapsed ? t('nav.config') : ''}
          >
            <div className="nav-item-icon">
              <SlidersHorizontal size={20} />
            </div>
            <span className="nav-item-text transition-opacity duration-200 whitespace-nowrap">
              {t('nav.config')}
            </span>
          </NavLink>
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
            {primaryNavItems.map((item) => (
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
            <div style={{ height: 1, background: 'var(--border-color)', margin: '8px 16px', opacity: 0.5 }} />
            <NavLink
              to="/app/config"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <div className="nav-item-icon"><SlidersHorizontal size={20} /></div>
              <span className="nav-item-text">{t('nav.config')}</span>
            </NavLink>
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
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>

    </div>
  )
}

