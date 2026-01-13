import { useState, useRef, useEffect } from 'react'
import { Building, User, ChevronDown, Check, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useWorkspace } from '../../context/WorkspaceContext'

interface HeaderWorkspaceSelectorProps {
  onBeforeSwitch?: () => Promise<void>
}

export function HeaderWorkspaceSelector({ onBeforeSwitch }: HeaderWorkspaceSelectorProps) {
  const navigate = useNavigate()
  const { currentWorkspace, workspaces, switchWorkspace } = useWorkspace()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleSwitch = async (orgId: string | null) => {
    // If selecting current, just close
    if (
      (orgId === null && currentWorkspace === null) ||
      (currentWorkspace && orgId === currentWorkspace.id)
    ) {
      setIsOpen(false)
      return
    }

    setIsOpen(false)
    
    // Play transition animation if callback provided
    if (onBeforeSwitch) {
      await onBeforeSwitch()
    }
    
    switchWorkspace(orgId)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-200
          ${isOpen 
            ? 'bg-slate-800 border-slate-600 text-white' 
            : 'bg-slate-900/50 border-slate-700/50 text-slate-200 hover:bg-slate-800 hover:border-slate-600'}
        `}
        style={{ minWidth: 160 }}
      >
        <div className={`p-1 rounded-md ${currentWorkspace ? 'bg-indigo-500/20 text-indigo-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
          {currentWorkspace ? <Building size={14} /> : <User size={14} />}
        </div>
        
        <div className="flex-1 text-left min-w-0">
          <div className="text-xs font-medium truncate">
            {currentWorkspace ? currentWorkspace.name : 'Personal'}
          </div>
        </div>

        <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-1 space-y-0.5">
            <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Cambiar Espacio
            </div>
            
            {/* Personal Workspace */}
            <button
              onClick={() => handleSwitch(null)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                !currentWorkspace 
                  ? 'bg-emerald-500/10 text-emerald-400' 
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className={`p-1.5 rounded-md ${!currentWorkspace ? 'bg-emerald-500/20' : 'bg-slate-800'}`}>
                <User size={16} />
              </div>
              <span className="flex-1 text-left">Personal</span>
              {!currentWorkspace && <Check size={16} />}
            </button>

            {/* Organizations Divider */}
            {workspaces.length > 0 && (
              <div className="my-1 border-t border-slate-800 mx-2" />
            )}
            
            {workspaces.length > 0 && (
              <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Organizaciones
              </div>
            )}

            {/* Organization List */}
            <div className="max-h-60 overflow-y-auto custom-scrollbar">
              {workspaces.map(ws => {
                const isActive = currentWorkspace?.id === ws.org_id
                return (
                  <button
                    key={ws.org_id}
                    onClick={() => handleSwitch(ws.org_id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive 
                        ? 'bg-indigo-500/10 text-indigo-400' 
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className={`p-1.5 rounded-md ${isActive ? 'bg-indigo-500/20' : 'bg-slate-800'}`}>
                      <Building size={16} />
                    </div>
                    <span className="flex-1 text-left truncate">{ws.organization.name}</span>
                    {isActive && <Check size={16} />}
                  </button>
                )
              })}
            </div>

            {/* Create New Org Action */}
            <div className="border-t border-slate-800 mt-1 pt-1">
              <button
                onClick={() => {
                  setIsOpen(false)
                  navigate('/app/organizations')
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <div className="p-1.5 rounded-md bg-slate-800">
                  <Plus size={16} />
                </div>
                Create Organization
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
