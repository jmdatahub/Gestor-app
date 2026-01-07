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

  // Info
  const displayName = currentWorkspace ? currentWorkspace.name : 'Espacio Personal'
  const displaySubtext = currentWorkspace ? 'Organización Pro' : 'Plan Gratuito'
  
  // Gradients
  const avatarGradient = currentWorkspace 
    ? 'bg-gradient-to-br from-indigo-600 via-indigo-500 to-indigo-400' 
    : 'bg-gradient-to-br from-slate-700 via-slate-600 to-slate-500'

  return (
    <div className="relative" ref={menuRef}>
      
      {/* Menu Popup */}
      {isOpen && (
        <div 
          className="absolute bottom-full left-0 mb-3 w-[260px] rounded-xl overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-200 z-50 shadow-2xl bg-[#1e293b] border border-slate-700 ring-1 ring-black/20"
          style={{ left: isCollapsed ? '-0.5rem' : '0' }}
        >
           {/* Header */}
           <div className="px-3 py-3 bg-[#0f172a] border-b border-slate-700 flex items-center justify-between">
             <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
               Cambiar Espacio
             </span>
             <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full font-medium border border-indigo-500/20">
               {workspaces.length + 1} disponibles
             </span>
           </div>

           {/* List */}
           <div className="p-1 flex flex-col gap-1 max-h-[300px] overflow-y-auto custom-scrollbar bg-[#1e293b]">
              
              {/* Personal Option */}
              <button
                onClick={() => handleSwitch(null)}
                className={`group flex items-center gap-3 w-full p-2 rounded-lg transition-all text-left ${
                  !currentWorkspace ? 'bg-slate-700/50' : 'hover:bg-slate-800'
                }`}
              >
                <div className={`
                  w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0
                  ${!currentWorkspace ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-700 text-slate-400 group-hover:bg-slate-600 group-hover:text-slate-200'}
                `}>
                  <User size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium truncate ${!currentWorkspace ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>
                    Personal
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">Tu espacio privado</div>
                </div>
                {!currentWorkspace && <Check size={14} className="text-indigo-400" strokeWidth={2.5} />}
              </button>

              {/* Label */}
              {workspaces.length > 0 && (
                <div className="px-2 py-1.5 mt-1 border-t border-slate-700/50">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Organizaciones</span>
                </div>
              )}

              {/* Organizations */}
              {workspaces.map((ws) => {
                const isActive = currentWorkspace?.id === ws.org_id
                return (
                  <button
                    key={ws.org_id}
                    onClick={() => handleSwitch(ws.org_id)}
                    className={`group flex items-center gap-3 w-full p-2 rounded-lg transition-all text-left ${
                      isActive ? 'bg-slate-700/50' : 'hover:bg-slate-800'
                    }`}
                  >
                    <div className={`
                      w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0
                      ${isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700 group-hover:border-slate-600'}
                    `}>
                      <Building size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium truncate ${isActive ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>
                        {ws.organization.name}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {isActive ? 'Activo' : 'Organización'}
                      </div>
                    </div>
                    {isActive && <Check size={14} className="text-indigo-400" strokeWidth={2.5} />}
                  </button>
                )
              })}
           </div>

           {/* Footer */}
           <div className="p-1 border-t border-slate-700 bg-[#0f172a] grid grid-cols-2 gap-1">
              <button
                onClick={() => { setIsOpen(false); navigate('/app/organizations'); }}
                className="flex items-center justify-center gap-2 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Crear nueva organización"
              >
                 <Plus size={14} />
                 <span className="text-[11px] font-medium">Crear</span>
              </button>
              
              <button 
               onClick={handleSignOut}
               className="flex items-center justify-center gap-2 p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
               title="Cerrar sesión"
              >
               <LogOut size={14} />
               <span className="text-[11px] font-medium">Salir</span>
             </button>
           </div>
        </div>
      )}

      {/* Trigger Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full flex items-center gap-3 p-2 rounded-xl transition-all duration-200 border
          ${isOpen ? 'bg-slate-800 border-slate-700' : 'border-transparent hover:bg-slate-800/50 hover:border-slate-800'}
        `}
      >
        <div className={`
          flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-white shadow-md
          ${avatarGradient} ring-1 ring-white/10
        `}>
          {currentWorkspace ? <Building size={16} strokeWidth={2.5} /> : <User size={16} strokeWidth={2.5} />}
        </div>

        {!isCollapsed && (
          <>
            <div className="flex-1 text-left min-w-0">
              <div className="text-sm font-bold text-slate-200 truncate flex items-center gap-1.5">
                {displayName}
                {currentWorkspace && <span className="flex h-1.5 w-1.5 rounded-full bg-indigo-500"></span>}
              </div>
              <div className="text-[11px] font-medium text-slate-500 truncate">
                {displaySubtext}
              </div>
            </div>

            <div className={`text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
              <ChevronsUpDown size={14} />
            </div>
          </>
        )}
      </button>
    </div>
  )
}

export default SidebarUserMenu
