import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useWorkspace } from '../../context/WorkspaceContext'
import { LogOut, Check, Building, User, ChevronsUpDown, Plus } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'

interface SidebarUserMenuProps {
  isCollapsed: boolean
}

const SidebarUserMenu: React.FC<SidebarUserMenuProps> = ({ isCollapsed }) => {
  const { currentWorkspace, workspaces, switchWorkspace } = useWorkspace()
  const { user, signOut } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  // Calculate menu position when opening
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setMenuPosition({
        top: rect.top - 12, // 12px gap above trigger
        left: rect.left
      })
    }
  }, [isOpen])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        menuRef.current && !menuRef.current.contains(target) &&
        triggerRef.current && !triggerRef.current.contains(target)
      ) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleSwitch = (orgId: string | null) => {
    switchWorkspace(orgId)
    setIsOpen(false)
  }

  const handleSignOut = () => {
    signOut()
    navigate('/auth')
  }

  // Display info
  const displayName = currentWorkspace ? currentWorkspace.name : 'Personal'
  const displaySubtext = currentWorkspace ? 'Organización Pro' : 'Plan Gratuito'
  
  // Styles
  const menuContainerStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: `calc(100vh - ${menuPosition.top}px)`,
    left: menuPosition.left,
    width: '260px',
    borderRadius: '12px',
    overflow: 'hidden',
    zIndex: 9999,
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.15)',
    animation: 'dropdown-in 0.2s ease-out'
  }

  const sectionHeaderStyle: React.CSSProperties = {
    padding: '12px',
    backgroundColor: 'var(--bg-surface)',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  }

  const itemStyle = (isActive: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: isActive ? 'var(--primary-soft)' : 'transparent',
    color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.15s ease'
  })

  const avatarStyle = (isActive: boolean): React.CSSProperties => ({
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isActive ? 'var(--primary)' : 'var(--bg-surface-hover)',
    color: isActive ? '#FFFFFF' : 'var(--text-muted)',
    flexShrink: 0
  })

  const triggerButtonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    width: '100%',
    padding: '8px',
    borderRadius: '12px',
    border: '1px solid',
    borderColor: isOpen ? 'var(--sidebar-border)' : 'transparent',
    backgroundColor: isOpen ? 'var(--bg-sidebar-hover)' : 'transparent',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  }

  const mainAvatarStyle: React.CSSProperties = {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: currentWorkspace ? 'linear-gradient(135deg, #6366F1 0%, #A855F7 100%)' : 'var(--bg-surface-hover)',
    color: '#FFFFFF',
    flexShrink: 0,
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)'
  }

  const footerActionStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '10px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--text-muted)',
    fontSize: '11px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    width: '100%'
  }

  // Menu content as a portal
  const menuContent = isOpen ? createPortal(
    <div ref={menuRef} style={menuContainerStyle}>
       {/* Header */}
       <div style={sectionHeaderStyle}>
         <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
           Cambiar Espacio
         </span>
         <span style={{ fontSize: '10px', backgroundColor: 'var(--primary-soft)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '999px', border: '1px solid var(--primary-border, var(--primary-soft))' }}>
           {workspaces.length + 1}
         </span>
       </div>

       {/* List */}
       <div style={{ padding: '6px', maxHeight: '300px', overflowY: 'auto' }}>
          
          {/* Personal Option */}
          <button
            onClick={() => handleSwitch(null)}
            style={itemStyle(!currentWorkspace)}
            onMouseEnter={(e) => { if (currentWorkspace) e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)' }}
            onMouseLeave={(e) => { if (currentWorkspace) e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            <div style={avatarStyle(!currentWorkspace)}>
              <User size={16} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: !currentWorkspace ? 'var(--primary)' : 'var(--text-primary)' }}>Personal</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Espacio privado</div>
            </div>
            {!currentWorkspace && <Check size={14} style={{ color: 'var(--primary)' }} strokeWidth={3} />}
          </button>

          {workspaces.length > 0 && (
            <div style={{ padding: '12px 12px 6px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Organizaciones
            </div>
          )}

          {/* Organizations */}
          {workspaces.map((ws) => {
            const isActive = currentWorkspace?.id === ws.org_id
            return (
              <button
                key={ws.org_id}
                onClick={() => handleSwitch(ws.org_id)}
                style={itemStyle(isActive)}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)' }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent' }}
              >
                <div style={avatarStyle(isActive)}>
                  <Building size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: isActive ? 'var(--primary)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ws.organization.name}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Organización</div>
                </div>
                {isActive && <Check size={14} style={{ color: 'var(--primary)' }} strokeWidth={3} />}
              </button>
            )
          })}
       </div>

       {/* Footer */}
       <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', padding: '6px', backgroundColor: 'var(--bg-surface)', borderTop: '1px solid var(--border-color)' }}>
          <button
            onClick={() => { setIsOpen(false); navigate('/app/profile'); }}
            style={footerActionStyle}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--primary-soft)'; e.currentTarget.style.color = 'var(--primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
             <User size={14} />
             <span>Perfil</span>
          </button>
          <button
            onClick={() => { setIsOpen(false); navigate('/app/organizations'); }}
            style={footerActionStyle}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
             <Plus size={14} />
             <span>Crear</span>
          </button>

          <button
           onClick={handleSignOut}
           style={footerActionStyle}
           onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.color = '#F87171'; }}
           onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
           <LogOut size={14} />
           <span>Salir</span>
         </button>
       </div>
    </div>,
    document.body
  ) : null

  return (
    <>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        style={triggerButtonStyle}
        onMouseEnter={(e) => { if (!isOpen) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)' }}
        onMouseLeave={(e) => { if (!isOpen) e.currentTarget.style.backgroundColor = 'transparent' }}
      >
        <div style={mainAvatarStyle}>
          {currentWorkspace ? <Building size={18} strokeWidth={2.5} /> : <User size={18} strokeWidth={2.5} />}
        </div>

        {!isCollapsed && (
          <>
            <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</span>
                {currentWorkspace && <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#6366F1' }}></div>}
              </div>
              <div style={{ fontSize: '10px', fontWeight: 500, color: '#94A3B8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {displaySubtext}
              </div>
            </div>

            <div style={{ color: '#94A3B8', transition: 'transform 0.2s ease', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
              <ChevronsUpDown size={14} />
            </div>
          </>
        )}
      </button>

      {menuContent}
    </>
  )
}

export default SidebarUserMenu

