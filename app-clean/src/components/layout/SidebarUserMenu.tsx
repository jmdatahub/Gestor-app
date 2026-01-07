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

  // Get current display info
  const displayName = currentWorkspace ? currentWorkspace.name : 'Espacio Personal'
  const displaySubtext = currentWorkspace ? 'Organización Pro' : 'Plan Gratuito'
  
  // Custom Gradients (using standard Tailwind colors instead of vars for gradients to ensure render)
  const avatarGradient = currentWorkspace 
    ? 'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500' 
    : 'bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900'

  return (
    <div className="relative" ref={menuRef}>
      
      {/* Menu Popup */}
      {isOpen && (
        <div 
          className="absolute bottom-full left-0 mb-3 w-[260px] rounded-2xl overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-200 z-50 shadow-2xl"
          style={{
            backgroundColor: 'var(--bg-card)', // Solid color fallback
            border: '1px solid var(--border-color)',
            left: isCollapsed ? '-0.5rem' : '0'
          }}
        >
           {/* Header Section */}
           <div 
             className="p-4 border-b flex items-center justify-between"
             style={{ background: 'var(--bg-header)', borderColor: 'var(--border-color)' }}
           >
             <h3 className="text-xs font-bold uppercase tracking-wider flex items-center justify-between w-full" style={{ color: 'var(--text-secondary)' }}>
               <span>Cambiar Espacio</span>
               <span style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }} className="text-[10px] px-2 py-0.5 rounded-full">
                 {workspaces.length + 1} disponibles
               </span>
             </h3>
           </div>

           {/* List */}
           <div className="p-2 flex flex-col gap-1 max-h-[300px] overflow-y-auto custom-scrollbar">
              
              {/* Personal Option */}
              <button
                onClick={() => handleSwitch(null)}
                className="group flex items-center gap-3 w-full p-3 rounded-xl transition-all duration-200 border"
                style={{ 
                  backgroundColor: !currentWorkspace ? 'var(--primary-soft)' : 'transparent',
                  borderColor: 'transparent',
                }}
              >
                <div className={`
                  w-8 h-8 rounded-lg flex items-center justify-center shadow-sm transition-transform group-hover:scale-105
                  ${!currentWorkspace ? 'text-white' : 'bg-gray-100 text-gray-500'}
                `}
                style={{ backgroundColor: !currentWorkspace ? 'var(--primary)' : undefined }}
                >
                  <User size={16} />
                </div>
                <div className="flex-1 text-left">
                  <div className="text-sm font-semibold" style={{ color: !currentWorkspace ? 'var(--primary)' : 'var(--text-primary)' }}>
                    Personal
                  </div>
                  <div className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>Tu espacio privado</div>
                </div>
                {!currentWorkspace && (
                  <div className="rounded-full p-1" style={{ backgroundColor: 'var(--primary)' }}>
                    <Check size={10} className="text-white" strokeWidth={4} />
                  </div>
                )}
              </button>

              {/* Separator Label */}
              {workspaces.length > 0 && (
                <div className="px-3 py-2 mt-1">
                  <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>Organizaciones</span>
                </div>
              )}

              {/* Organizations */}
              {workspaces.map((ws) => {
                const isActive = currentWorkspace?.id === ws.org_id
                return (
                  <button
                    key={ws.org_id}
                    onClick={() => handleSwitch(ws.org_id)}
                    className="group flex items-center gap-3 w-full p-3 rounded-xl transition-all duration-200 border"
                    style={{ 
                      backgroundColor: isActive ? 'var(--primary-soft)' : 'transparent',
                      borderColor: 'transparent'
                    }}
                  >
                    <div className={`
                      w-8 h-8 rounded-lg flex items-center justify-center shadow-sm transition-transform group-hover:scale-105
                    `}
                    style={{ 
                      background: isActive ? 'linear-gradient(to bottom right, #6366f1, #a855f7)' : 'rgba(99, 102, 241, 0.1)',
                      color: isActive ? 'white' : 'var(--primary)'
                    }}
                    >
                      <Building size={16} />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="text-sm font-semibold truncate" style={{ color: isActive ? 'var(--primary)' : 'var(--text-primary)' }}>
                        {ws.organization.name}
                      </div>
                      <div className="text-[10px] truncate" style={{ color: 'var(--text-secondary)' }}>
                        {isActive ? 'Activo ahora' : 'Ver espacio'}
                      </div>
                    </div>
                    {isActive && (
                      <div className="rounded-full p-1" style={{ backgroundColor: 'var(--primary)' }}>
                        <Check size={10} className="text-white" strokeWidth={4} />
                      </div>
                    )}
                  </button>
                )
              })}
           </div>

           {/* Footer Actions */}
           <div 
             className="p-2 border-t grid grid-cols-2 gap-2"
             style={{ 
               background: 'var(--bg-header)', 
               borderColor: 'var(--border-color)' 
             }}
           >
              <button
                onClick={() => { setIsOpen(false); navigate('/app/organizations'); }}
                className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg transition-all"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-body)'; e.currentTarget.style.color = 'var(--primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >
                 <Plus size={16} />
                 <span className="text-[10px] font-medium">Crear Org</span>
              </button>
              
              <button 
               onClick={handleSignOut}
               className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg transition-all"
               style={{ color: 'var(--text-secondary)' }}
               onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#FEF2F2'; e.currentTarget.style.color = '#EF4444'; }}
               onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
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
        `}
        style={{
          backgroundColor: isOpen ? 'var(--bg-card)' : 'transparent',
          borderColor: isOpen ? 'var(--border-color)' : 'transparent',
          boxShadow: isOpen ? 'var(--shadow-lg)' : 'none'
        }}
      >
        {/* Avatar with Ring */}
        <div className={`
          flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md
          ${avatarGradient}
        `}>
          {currentWorkspace ? <Building size={18} strokeWidth={2.5} /> : <User size={18} strokeWidth={2.5} />}
        </div>

        {/* Info Area */}
        {!isCollapsed && (
          <>
            <div className="flex-1 text-left min-w-0">
              <div className="text-sm font-bold truncate flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                {displayName}
                {currentWorkspace && <Sparkles size={10} className="text-amber-400 fill-amber-400 animate-pulse" />}
              </div>
              <div className="text-[11px] font-medium truncate opacity-80" style={{ color: 'var(--text-secondary)' }}>
                {displaySubtext}
              </div>
            </div>

            {/* Selector Icon */}
            <div style={{ color: 'var(--text-secondary)' }}>
              <ChevronsUpDown size={16} />
            </div>
          </>
        )}
      </button>
    </div>
  )
}

export default SidebarUserMenu
