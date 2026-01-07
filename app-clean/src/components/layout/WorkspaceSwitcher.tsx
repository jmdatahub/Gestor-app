import React, { useState, useRef, useEffect } from 'react'
import { useWorkspace } from '../../context/WorkspaceContext'
import { Building, User, ChevronUp, Check, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const WorkspaceSwitcher: React.FC = () => {
  const { currentWorkspace, workspaces, switchWorkspace } = useWorkspace()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  // Close when clicking outside
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

  return (
    <div 
      ref={menuRef}
      className="fixed bottom-6 right-6 z-50 flex flex-col items-end"
    >
      {/* Menu Popup */}
      {isOpen && (
        <div 
          className="mb-3 w-64 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-200"
          style={{ boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' }}
        >
          <div className="p-3 border-b border-[var(--border-color)] bg-[var(--bg-header)]">
            <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Cambiar Espacio
            </h3>
          </div>
          
          <div className="p-2 flex flex-col gap-1 max-h-60 overflow-y-auto">
            {/* Personal Option */}
            <button
              onClick={() => handleSwitch(null)}
              className={`flex items-center gap-3 w-full p-2 rounded-lg text-sm transition-colors ${
                !currentWorkspace 
                  ? 'bg-[var(--primary-light)] text-[var(--primary)]' 
                  : 'hover:bg-[var(--gray-50)] text-[var(--text-primary)]'
              }`}
            >
              <div className={`p-1.5 rounded-md ${!currentWorkspace ? 'bg-[var(--primary)] text-white' : 'bg-gray-200 text-gray-500'}`}>
                <User size={16} />
              </div>
              <span className="font-medium flex-1 text-left">Espacio Personal</span>
              {!currentWorkspace && <Check size={16} />}
            </button>

            {/* Organizations */}
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
                <div className={`p-1.5 rounded-md ${currentWorkspace?.id === ws.org_id ? 'bg-[var(--primary)] text-white' : 'bg-indigo-100 text-indigo-500'}`}>
                  <Building size={16} />
                </div>
                <span className="font-medium flex-1 text-left truncate">{ws.organization.name}</span>
                {currentWorkspace?.id === ws.org_id && <Check size={16} />}
              </button>
            ))}
          </div>

          <div className="p-2 border-t border-[var(--border-color)]">
             <button
               onClick={() => { setIsOpen(false); navigate('/app/organizations'); }}
               className="flex items-center justify-center gap-2 w-full p-2 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--gray-50)] transition-colors"
             >
               <Plus size={14} />
               Gestionar Organizaciones
             </button>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 pl-4 pr-3 py-3 rounded-full shadow-lg transition-all hover:scale-105 active:scale-95"
        style={{ 
          background: 'var(--bg-card)', 
          border: '1px solid var(--border-color)',
          color: 'var(--text-primary)'
        }}
      >
        <div className="flex items-center gap-2">
           <div className={`p-1 rounded-md ${currentWorkspace ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-600'}`}>
             {currentWorkspace ? <Building size={18} /> : <User size={18} />}
           </div>
           <div className="flex flex-col items-start mr-2">
             <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)] leading-none mb-0.5">
               Estás en
             </span>
             <span className="text-sm font-bold leading-none">
               {currentWorkspace ? currentWorkspace.name : 'Personal'}
             </span>
           </div>
        </div>
        <ChevronUp size={20} className={`text-[var(--text-secondary)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
    </div>
  )
}

export default WorkspaceSwitcher
