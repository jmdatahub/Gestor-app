import React, { useState, useRef, useEffect } from 'react'
import { useWorkspace } from '../../context/WorkspaceContext'
import { LogOut, Check, Building, User, ChevronUp, ChevronsUpDown, Plus, Settings } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useNavigate } from 'react-router-dom'

interface SidebarUserMenuProps {
  isCollapsed: boolean
}

const SidebarUserMenu: React.FC<SidebarUserMenuProps> = ({ isCollapsed }) => {
  const { currentWorkspace, workspaces, switchWorkspace } = useWorkspace()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSwitch = (orgId: string | null) => {
    switchWorkspace(orgId)
    setIsOpen(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/auth')
  }

  // Get current display info
  const displayName = currentWorkspace ? currentWorkspace.name : 'Espacio Personal'
  const displaySubtext = currentWorkspace ? 'Organización' : 'Usuario Free'
  const initial = currentWorkspace ? currentWorkspace.name.substring(0, 2).toUpperCase() : 'U'

  return (
    <div className="relative" ref={menuRef}>
      {/* Menu Popup (Above) */}
      {isOpen && (
        <div 
          className="absolute bottom-full left-0 mb-2 w-64 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-xl overflow-hidden animate-in slide-in-from-bottom-2 fade-in z-50"
          style={{ 
             left: isCollapsed ? '0' : '0', 
             width: '260px' // Fixed width for menu even if sidebar is collapsed (it will overlap) (Actually if collapsed, sidebar might clip? Sidebar has overflow-hidden usually? No, sidebar footer usually doesn't clip overflow if we handle it right. We might need portal or fixed positioning if sidebar clips. AppLayout sidebar usually doesn't clip vertical overflow, but explicit width might be strict. Let's try relative first.)
          }}
        >
           {/* Header */}
           <div className="p-3 border-b border-[var(--border-color)] bg-[var(--bg-header)] flex items-center justify-between">
             <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Mi Cuenta</span>
           </div>

           {/* Workspace List */}
           <div className="p-2 flex flex-col gap-1 max-h-60 overflow-y-auto">
              <div className="px-2 py-1 text-[10px] font-bold text-[var(--text-secondary)] uppercase">Espacios de Trabajo</div>
              
              {/* Personal */}
              <button
                onClick={() => handleSwitch(null)}
                className={`flex items-center gap-3 w-full p-2 rounded-lg text-sm transition-colors ${
                  !currentWorkspace 
                    ? 'bg-[var(--primary-light)] text-[var(--primary)]' 
                    : 'hover:bg-[var(--gray-50)] text-[var(--text-primary)]'
                }`}
              >
                <div className="w-6 h-6 rounded flex items-center justify-center bg-gray-200 text-gray-500">
                  <User size={14} />
                </div>
                <div className="flex-1 text-left truncate">
                  <div className="font-medium">Personal</div>
                </div>
                {!currentWorkspace && <Check size={14} />}
              </button>

              {/* Orgs */}
              {workspaces.map((ws) => (
                <button
                  key={ws.org_id}
                  onClick={() => handleSwitch(ws.org_id)}
                  className={`flex items-center gap-3 w-full p-2 rounded-lg text-sm transition-colors ${
                    currentWorkspace?.id === ws.org_id
                      ? 'bg-[var(--primary-light)] text-[var(--primary)]' 
                      : 'hover:bg-[var(--gray-50)] text-[var(--text-primary)]'
                  }`}
                >
                  <div className="w-6 h-6 rounded flex items-center justify-center bg-indigo-100 text-indigo-500">
                    <Building size={14} />
                  </div>
                  <div className="flex-1 text-left truncate">
                    <div className="font-medium">{ws.organization.name}</div>
                  </div>
                  {currentWorkspace?.id === ws.org_id && <Check size={14} />}
                </button>
              ))}

              <button
                onClick={() => { setIsOpen(false); navigate('/app/organizations'); }}
                className="flex items-center gap-3 w-full p-2 rounded-lg text-sm hover:bg-[var(--gray-50)] text-[var(--text-secondary)] mt-1"
              >
                 <div className="w-6 h-6 rounded flex items-center justify-center border border-dashed border-gray-300">
                    <Plus size={14} />
                 </div>
                 <span className="text-left font-medium">Crear / Unirse...</span>
              </button>
           </div>

           <div className="border-t border-[var(--border-color)] my-1"></div>

           {/* Actions */}
           <div className="p-2">
             <button 
               onClick={handleSignOut}
               className="flex items-center gap-3 w-full p-2 rounded-lg text-sm text-red-500 hover:bg-red-50 transition-colors"
             >
               <LogOut size={16} />
               <span className="font-medium">Cerrar Sesión</span>
             </button>
           </div>
        </div>
      )}

      {/* Main Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center gap-3 p-2 rounded-xl transition-all duration-200 ${
          isOpen ? 'bg-[var(--bg-card)] shadow-sm' : 'hover:bg-[var(--bg-header)]'
        }`}
      >
        {/* Avatar */}
        <div className={`
          flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold shadow-sm transition-all
          ${currentWorkspace ? 'bg-gradient-to-br from-indigo-500 to-purple-600' : 'bg-gradient-to-br from-gray-700 to-gray-900'}
        `}>
          {currentWorkspace ? <Building size={18} /> : <User size={18} />}
        </div>

        {/* Info (Hidden if collapsed) */}
        {!isCollapsed && (
          <div className="flex-1 text-left overflow-hidden">
            <div className="font-bold text-sm truncate text-[var(--text-primary)]">
              {displayName}
            </div>
            <div className="text-[10px] uppercase font-bold text-[var(--text-secondary)] truncate">
              {displaySubtext}
            </div>
          </div>
        )}

        {/* Chevron (Hidden if collapsed) */}
        {!isCollapsed && (
          <ChevronsUpDown size={16} className="text-[var(--text-secondary)]" />
        )}
      </button>
    </div>
  )
}

export default SidebarUserMenu
