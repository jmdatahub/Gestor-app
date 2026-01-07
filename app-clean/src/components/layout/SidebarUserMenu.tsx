import React, { useState, useRef, useEffect } from 'react'
import { useWorkspace } from '../../context/WorkspaceContext'
import { LogOut, Check, Building, User, ChevronsUpDown, Plus, Sparkles } from 'lucide-react'
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

  // Visual Helpers
  const displayName = currentWorkspace ? currentWorkspace.name : 'Espacio Personal'
  const displaySubtext = currentWorkspace ? 'Organización Pro' : 'Plan Gratuito'
  
  // Custom Gradients based on type
  const avatarGradient = currentWorkspace 
    ? 'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500' // Org: Vivid
    : 'bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900'     // Personal: Sleek Dark

  return (
    <div className="relative" ref={menuRef}>
      
      {/* Menu Popup (Floating with Glassmorphism) */}
      {isOpen && (
        <div 
          className="absolute bottom-full left-0 mb-3 w-[260px] rounded-2xl overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-200 z-50 shadow-2xl ring-1 ring-black/5"
          style={{
            backgroundColor: 'rgba(var(--bg-card-rgb), 0.95)', // Assuming vars exist, else fallback
            backdropFilter: 'blur(12px)',
            border: '1px solid var(--border-color)',
            left: isCollapsed ? '-0.5rem' : '0' // Adjust slightly if collapsed
          }}
        >
           {/* Header Section */}
           <div className="p-4 bg-gradient-to-r from-[var(--bg-header)] to-[var(--bg-card)] border-b border-[var(--border-color)]">
             <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center justify-between">
               <span>Cambiar Espacio</span>
               <span className="bg-[var(--primary)]/10 text-[var(--primary)] text-[10px] px-2 py-0.5 rounded-full">
                 {workspaces.length + 1} disponibles
               </span>
             </h3>
           </div>

           {/* List */}
           <div className="p-2 flex flex-col gap-1 max-h-[300px] overflow-y-auto custom-scrollbar">
              
              {/* Personal Option */}
              <button
                onClick={() => handleSwitch(null)}
                className={`group flex items-center gap-3 w-full p-3 rounded-xl transition-all duration-200 border border-transparent ${
                  !currentWorkspace 
                    ? 'bg-[var(--primary)]/5 border-[var(--primary)]/10' 
                    : 'hover:bg-[var(--bg-header)] hover:border-[var(--border-color)]'
                }`}
              >
                <div className={`
                  w-8 h-8 rounded-lg flex items-center justify-center shadow-sm transition-transform group-hover:scale-105
                  ${!currentWorkspace ? 'bg-[var(--primary)] text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}
                `}>
                  <User size={16} />
                </div>
                <div className="flex-1 text-left">
                  <div className={`text-sm font-semibold ${!currentWorkspace ? 'text-[var(--primary)]' : 'text-[var(--text-primary)]'}`}>
                    Personal
                  </div>
                  <div className="text-[10px] text-[var(--text-secondary)]">Tu espacio privado</div>
                </div>
                {!currentWorkspace && (
                  <div className="bg-[var(--primary)] rounded-full p-1">
                    <Check size={10} className="text-white" strokeWidth={4} />
                  </div>
                )}
              </button>

              {/* Separator Label */}
              {workspaces.length > 0 && (
                <div className="px-3 py-2 mt-1">
                  <span className="text-[10px] font-bold text-[var(--text-secondary)]/70 uppercase">Organizaciones</span>
                </div>
              )}

              {/* Organizations */}
              {workspaces.map((ws) => {
                const isActive = currentWorkspace?.id === ws.org_id
                return (
                  <button
                    key={ws.org_id}
                    onClick={() => handleSwitch(ws.org_id)}
                    className={`group flex items-center gap-3 w-full p-3 rounded-xl transition-all duration-200 border border-transparent ${
                      isActive
                        ? 'bg-[var(--primary)]/5 border-[var(--primary)]/10' 
                        : 'hover:bg-[var(--bg-header)] hover:border-[var(--border-color)]'
                    }`}
                  >
                    <div className={`
                      w-8 h-8 rounded-lg flex items-center justify-center shadow-sm transition-transform group-hover:scale-105
                      ${isActive 
                        ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white' 
                        : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500'}
                    `}>
                      <Building size={16} />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className={`text-sm font-semibold truncate ${isActive ? 'text-[var(--primary)]' : 'text-[var(--text-primary)]'}`}>
                        {ws.organization.name}
                      </div>
                      <div className="text-[10px] text-[var(--text-secondary)] truncate">
                        {isActive ? 'Activo ahora' : 'Ver espacio'}
                      </div>
                    </div>
                    {isActive && (
                      <div className="bg-[var(--primary)] rounded-full p-1">
                        <Check size={10} className="text-white" strokeWidth={4} />
                      </div>
                    )}
                  </button>
                )
              })}
           </div>

           {/* Footer Actions */}
           <div className="p-2 border-t border-[var(--border-color)] bg-[var(--bg-header)]/50 backdrop-blur-sm grid grid-cols-2 gap-2">
              <button
                onClick={() => { setIsOpen(false); navigate('/app/organizations'); }}
                className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg hover:bg-[var(--bg-card)] hover:shadow-sm transition-all text-[var(--text-secondary)] hover:text-[var(--primary)]"
              >
                 <Plus size={16} />
                 <span className="text-[10px] font-medium">Crear Org</span>
              </button>
              
              <button 
               onClick={handleSignOut}
               className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg hover:bg-red-50 hover:text-red-600 transition-all text-[var(--text-secondary)]"
              >
               <LogOut size={16} />
               <span className="text-[10px] font-medium">Salir</span>
             </button>
           </div>
        </div>
      )}

      {/* Main Trigger Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full flex items-center gap-3 p-2 rounded-2xl transition-all duration-200 border
          ${isOpen 
            ? 'bg-[var(--bg-card)] border-[var(--border-color)] shadow-lg scale-[1.02]' 
            : 'border-transparent hover:bg-[var(--bg-header)] hover:border-[var(--border-color)]/50'
          }
        `}
      >
        {/* Avatar with Ring */}
        <div className={`
          flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md
          ${avatarGradient}
          ring-2 ring-white/10 ring-offset-2 ring-offset-[var(--bg-sidebar)]
        `}>
          {currentWorkspace ? <Building size={18} strokeWidth={2.5} /> : <User size={18} strokeWidth={2.5} />}
        </div>

        {/* Info Area */}
        {!isCollapsed && (
          <>
            <div className="flex-1 text-left min-w-0">
              <div className="text-sm font-bold text-[var(--text-primary)] truncate flex items-center gap-1.5">
                {displayName}
                {currentWorkspace && <Sparkles size={10} className="text-amber-400 fill-amber-400 animate-pulse" />}
              </div>
              <div className="text-[11px] font-medium text-[var(--text-secondary)] truncate opacity-80">
                {displaySubtext}
              </div>
            </div>

            {/* Selector Icon */}
            <div className="text-[var(--text-secondary)] opacity-50 group-hover:opacity-100 transition-opacity">
              <ChevronsUpDown size={16} />
            </div>
          </>
        )}
      </button>
    </div>
  )
}

export default SidebarUserMenu
