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
    if (
      (orgId === null && currentWorkspace === null) ||
      (currentWorkspace && orgId === currentWorkspace.id)
    ) {
      setIsOpen(false)
      return
    }

    setIsOpen(false)
    
    if (onBeforeSwitch) {
      await onBeforeSwitch()
    }
    
    switchWorkspace(orgId)
  }

  // Styles using CSS variables from index.css
  const itemStyle = {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '8px 12px', // Reduced padding
    border: 'none',
    background: 'transparent',
    color: 'var(--text-primary)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    textAlign: 'left' as const,
    gap: '10px',
    fontSize: '0.85rem', // Slightly smaller text
    transition: 'background var(--transition-fast)'
  }

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      {/* Trigger Button - Mimic .select-trigger from index.css */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="select-trigger"
        style={{
          minWidth: '180px', // Reduced width
          height: '36px', // Slightly shorter
          padding: '0 10px',
          background: 'var(--bg-card)',
          borderColor: isOpen ? 'var(--primary)' : 'var(--border-color)',
          color: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
          <div style={{ 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '20px', height: '20px', // Smaller icon box
            borderRadius: '5px',
            background: currentWorkspace ? 'var(--primary-soft)' : 'var(--success-soft)',
            color: currentWorkspace ? 'var(--primary)' : 'var(--success)'
          }}>
            {currentWorkspace ? <Building size={13} /> : <User size={13} />}
          </div>
          <span style={{ fontSize: '0.85rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {currentWorkspace ? currentWorkspace.name : 'Personal'}
          </span>
        </div>
        
        <ChevronDown 
          size={14} 
          style={{ 
             color: 'var(--text-secondary)',
             transform: isOpen ? 'rotate(180deg)' : 'none',
             transition: 'transform 0.2s'
          }} 
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0,
          width: '200px',
          background: 'var(--dropdown-bg)',
          border: '1px solid var(--dropdown-border)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--dropdown-shadow)',
          zIndex: 1000,
          padding: '4px',
          animation: 'dropdown-in 0.2s ease-out'
        }}>
          {/* Header */}
          <div style={{ 
            padding: '6px 10px', 
            fontSize: '0.7rem', // Smaller header text
            fontWeight: 600, 
            textTransform: 'uppercase', 
            color: 'var(--text-muted)',
            letterSpacing: '0.05em'
          }}>
            Cambiar Espacio
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {/* Personal Workspace */}
            <button
              onClick={() => handleSwitch(null)}
              // Using inline hover via onMouseEnter/Leave would be messy in React without styled-components/classes
              // So relying on simple inline styles and standard css hover if possible, 
              // or just using a class if we can. 
              // Let's use a class "dropdown-item" defined locally or reuse .sidebar-item logic?
              // I'll add a hover effect via style tag injection or just keep it simple with a known class.
              // Reusing 'sidebar-item' class might work but it's fixed width.
              // I will use standard styles and rely on 'className="btn-ghost w-full"' if available, 
              // but let's manual style to be safe.
              className="dropdown-item"
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-sidebar-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              style={{...itemStyle, gap: '8px', padding: '6px 10px', fontSize: '0.8rem', background: !currentWorkspace ? 'var(--primary-soft)' : 'transparent'}}
            >
               <div style={{ 
                 width: '24px', height: '24px', borderRadius: '5px',
                 background: 'var(--success-soft)', color: 'var(--success)',
                 display: 'flex', alignItems: 'center', justifyContent: 'center'
               }}>
                 <User size={14} />
               </div>
               <span style={{ flex: 1 }}>Personal</span>
               {!currentWorkspace && <Check size={14} color="var(--primary)" />}
            </button>

            {workspaces.length > 0 && <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />}

            {workspaces.length > 0 && (
              <div style={{ 
                padding: '4px 10px', 
                fontSize: '0.7rem', 
                fontWeight: 600, 
                textTransform: 'uppercase', 
                color: 'var(--text-muted)',
                letterSpacing: '0.05em'
              }}>
                Organizaciones
              </div>
            )}

            <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
              {workspaces.map(ws => {
                const isActive = currentWorkspace?.id === ws.org_id
                return (
                  <button
                    key={ws.org_id}
                    onClick={() => handleSwitch(ws.org_id)}
                    onMouseEnter={(e) => e.currentTarget.style.background = isActive ? 'var(--primary-soft)' : 'var(--bg-sidebar-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = isActive ? 'var(--primary-soft)' : 'transparent'}
                    style={{...itemStyle, gap: '8px', padding: '6px 10px', fontSize: '0.8rem', background: isActive ? 'var(--primary-soft)' : 'transparent'}}
                  >
                    <div style={{ 
                      width: '24px', height: '24px', borderRadius: '5px', 
                      background: 'var(--primary-soft)', color: 'var(--primary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <Building size={14} />
                    </div>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ws.organization.name}
                    </span>
                    {isActive && <Check size={14} color="var(--primary)" />}
                  </button>
                )
              })}
            </div>

            <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />

            {/* Create New */}
            <button
               onClick={() => {
                 setIsOpen(false)
                 navigate('/app/organizations')
               }}
               onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-sidebar-hover)'}
               onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
               style={{...itemStyle, gap: '8px', padding: '6px 10px', fontSize: '0.8rem', color: 'var(--text-secondary)'}}
            >
              <div style={{ 
                width: '24px', height: '24px', borderRadius: '5px', 
                background: 'var(--gray-100)', color: 'var(--gray-500)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Plus size={14} />
              </div>
              Create Organization
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
