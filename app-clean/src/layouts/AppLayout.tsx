import { useEffect, useState, useRef, useCallback } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import SettingsPanel from '../components/SettingsPanel'
import { useI18n } from '../hooks/useI18n'
import { useOffline } from '../context/OfflineContext'
import SidebarUserMenu from '../components/layout/SidebarUserMenu'
import { getMyPendingInvitations } from '../services/organizationService'
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
  
  // Workspace Switch Transition State
  const [isSwitchingWorkspace, setIsSwitchingWorkspace] = useState(false)

  // ... (existing code) ...

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

  // ... (existing helper functions) ...

  return (
    <div className="app-container">
      
      {/* Workspace Switch Transition Overlay */}
      {isSwitchingWorkspace && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)',
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
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 24,
            boxShadow: '0 0 40px rgba(99, 102, 241, 0.5)',
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
            color: '#94a3b8', 
            marginTop: 8,
            animation: 'slideUp 0.6s ease-out'
          }}>
             Un momento por favor
          </p>
        </div>
      )}

      {/* Sidebar - Desktop */}
      {/* ... (existing sidebar code) ... */}

      {/* Main Content */}
      <main className="app-main">
        <header className="app-header flex justify-between items-center px-6 h-[80px] border-b border-[var(--border-color)] bg-[var(--bg-header)]">
          <div className="header-brand flex items-center gap-4">
            <h1 className="header-title">{t('app.name')}</h1>
            {/* Workspace Selector in Header */}
            <div style={{ marginLeft: 8 }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: 14, marginRight: 16 }}>|</span>
              <HeaderWorkspaceSelector onBeforeSwitch={handleWorkspaceSwitch} />
            </div>
          </div>
            {/* Right Side Actions */}
            {/* ... (existing right side actions) ... */}
        </header>

        {/* ... (existing main content) ... */}
      </main>

    </div>
  )
}

