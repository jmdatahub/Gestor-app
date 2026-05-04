import { useState, useRef, useEffect } from 'react'
import {
  Building,
  User,
  ChevronDown,
  Check,
  Plus,
  Crown,
  Shield,
  Eye,
  Users,
  Sparkles,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useWorkspace } from '../../context/WorkspaceContext'

interface HeaderWorkspaceSelectorProps {
  onBeforeSwitch?: () => Promise<void>
}

// Helper to get role icon and color (mirrors OrganizationsList getRoleInfo)
const getRoleInfo = (role: string) => {
  switch (role) {
    case 'owner':
      return { icon: Crown, color: '#F59E0B', label: 'Propietario', bg: 'rgba(245, 158, 11, 0.15)' }
    case 'admin':
      return { icon: Shield, color: '#8B5CF6', label: 'Administrador', bg: 'rgba(139, 92, 246, 0.15)' }
    case 'member':
      return { icon: User, color: '#3B82F6', label: 'Miembro', bg: 'rgba(59, 130, 246, 0.15)' }
    case 'viewer':
      return { icon: Eye, color: '#64748B', label: 'Visualizador', bg: 'rgba(100, 116, 139, 0.15)' }
    default:
      return { icon: User, color: '#64748B', label: role, bg: 'rgba(100, 116, 139, 0.15)' }
  }
}

const PURPLE_GRADIENT = 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)'
const PURPLE_GRADIENT_SOFT = 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)'
const GREEN_GRADIENT = 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)'
const PURPLE_LINE = 'linear-gradient(90deg, #8B5CF6 0%, #A78BFA 50%, #C4B5FD 100%)'
const GREEN_LINE = 'linear-gradient(90deg, #22C55E 0%, #4ADE80 100%)'

export function HeaderWorkspaceSelector({ onBeforeSwitch }: HeaderWorkspaceSelectorProps) {
  const navigate = useNavigate()
  const { currentWorkspace, workspaces, switchWorkspace, userRole } = useWorkspace()
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

  const activeRoleInfo = currentWorkspace && userRole ? getRoleInfo(userRole) : null
  const ActiveRoleIcon = activeRoleInfo?.icon

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          minWidth: '210px',
          height: '44px',
          padding: '0 10px 0 6px',
          background: 'var(--bg-card)',
          border: `1px solid ${isOpen ? 'transparent' : 'var(--border-color)'}`,
          borderRadius: '12px',
          color: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          cursor: 'pointer',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: isOpen
            ? '0 0 0 3px rgba(139, 92, 246, 0.18), 0 6px 18px rgba(0, 0, 0, 0.08)'
            : '0 1px 3px rgba(0, 0, 0, 0.04)',
          outline: isOpen
            ? `1.5px solid ${currentWorkspace ? '#8B5CF6' : '#22C55E'}`
            : 'none',
          outlineOffset: '-1.5px',
        }}
        onMouseEnter={(e) => {
          if (!isOpen) {
            e.currentTarget.style.boxShadow = '0 4px 14px rgba(0, 0, 0, 0.08)'
            e.currentTarget.style.transform = 'translateY(-1px)'
          }
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.04)'
            e.currentTarget.style.transform = 'translateY(0)'
          }
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            overflow: 'hidden',
            flex: 1,
          }}
        >
          {/* Avatar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '9px',
              background: currentWorkspace ? PURPLE_GRADIENT : GREEN_GRADIENT,
              color: 'white',
              boxShadow: currentWorkspace
                ? '0 3px 10px rgba(139, 92, 246, 0.35)'
                : '0 3px 10px rgba(34, 197, 94, 0.30)',
              flexShrink: 0,
            }}
          >
            {currentWorkspace ? <Building size={16} /> : <User size={16} />}
          </div>

          {/* Name + role */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              overflow: 'hidden',
              lineHeight: 1.2,
              minWidth: 0,
            }}
          >
            <span
              style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '140px',
                color: 'var(--text-primary)',
              }}
            >
              {currentWorkspace ? currentWorkspace.name : 'Personal'}
            </span>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 500,
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                marginTop: '1px',
              }}
            >
              {activeRoleInfo && ActiveRoleIcon ? (
                <>
                  <ActiveRoleIcon size={10} style={{ color: activeRoleInfo.color }} />
                  <span style={{ color: activeRoleInfo.color, fontWeight: 600 }}>
                    {activeRoleInfo.label}
                  </span>
                </>
              ) : (
                <>
                  <Sparkles size={10} style={{ color: '#22C55E' }} />
                  <span style={{ color: '#22C55E', fontWeight: 600 }}>Privado</span>
                </>
              )}
            </span>
          </div>
        </div>

        <ChevronDown
          size={16}
          style={{
            color: 'var(--text-secondary)',
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            flexShrink: 0,
          }}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            width: '280px',
            background: 'var(--dropdown-bg, var(--bg-card))',
            border: '1px solid var(--dropdown-border, var(--border-color))',
            borderRadius: '14px',
            boxShadow:
              '0 12px 32px rgba(0, 0, 0, 0.12), 0 4px 12px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(139, 92, 246, 0.04)',
            zIndex: 1000,
            padding: '8px',
            overflow: 'hidden',
            animation: 'header-ws-dropdown-in 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
            transformOrigin: 'top left',
          }}
        >
          {/* Inline keyframes (scoped via style tag) */}
          <style>{`
            @keyframes header-ws-dropdown-in {
              from { opacity: 0; transform: translateY(-6px) scale(0.98); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
            .header-ws-item {
              transition: background 0.18s ease, transform 0.18s ease;
            }
            .header-ws-item:hover {
              transform: translateX(2px);
            }
          `}</style>

          {/* Section header */}
          <div
            style={{
              padding: '6px 10px 8px',
              fontSize: '0.68rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              letterSpacing: '0.08em',
            }}
          >
            Cambiar espacio
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {/* Personal Workspace */}
            {(() => {
              const isActive = !currentWorkspace
              return (
                <button
                  className="header-ws-item"
                  onClick={() => handleSwitch(null)}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'var(--bg-sidebar-hover, rgba(34, 197, 94, 0.06))'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent'
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    width: '100%',
                    padding: '10px',
                    border: isActive ? '1.5px solid #22C55E' : '1.5px solid transparent',
                    background: isActive
                      ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.10), rgba(34, 197, 94, 0.04))'
                      : 'transparent',
                    color: 'var(--text-primary)',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    textAlign: 'left' as const,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {/* Decorative gradient line for active */}
                  {isActive && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '2px',
                        background: GREEN_LINE,
                      }}
                    />
                  )}

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      background: GREEN_GRADIENT,
                      color: 'white',
                      boxShadow: '0 3px 10px rgba(34, 197, 94, 0.30)',
                      flexShrink: 0,
                    }}
                  >
                    <User size={18} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span
                      style={{
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      Espacio Personal
                    </span>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        color: 'var(--text-secondary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      Tus finanzas privadas
                    </span>
                  </div>

                  {isActive && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        background: GREEN_GRADIENT,
                        boxShadow: '0 2px 6px rgba(34, 197, 94, 0.35)',
                        flexShrink: 0,
                      }}
                    >
                      <Check size={13} color="white" strokeWidth={3} />
                    </div>
                  )}
                </button>
              )
            })()}

            {/* Subtle separator */}
            {workspaces.length > 0 && (
              <div
                style={{
                  height: '1px',
                  background:
                    'linear-gradient(90deg, transparent 0%, var(--border-color) 50%, transparent 100%)',
                  margin: '6px 4px',
                }}
              />
            )}

            {workspaces.length > 0 && (
              <div
                style={{
                  padding: '4px 10px 6px',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  letterSpacing: '0.08em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Users size={11} />
                Organizaciones
              </div>
            )}

            <div
              style={{
                maxHeight: '260px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                paddingRight: '2px',
              }}
            >
              {workspaces.map((ws) => {
                const isActive = currentWorkspace?.id === ws.org_id
                const roleInfo = getRoleInfo(ws.role)
                const RoleIcon = roleInfo.icon

                return (
                  <button
                    key={ws.org_id}
                    className="header-ws-item"
                    onClick={() => handleSwitch(ws.org_id)}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background =
                          'var(--bg-sidebar-hover, rgba(139, 92, 246, 0.06))'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'transparent'
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      width: '100%',
                      padding: '10px',
                      border: isActive ? '1.5px solid #8B5CF6' : '1.5px solid transparent',
                      background: isActive
                        ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.10), rgba(99, 102, 241, 0.04))'
                        : 'transparent',
                      color: 'var(--text-primary)',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      textAlign: 'left' as const,
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Decorative gradient line for active */}
                    {isActive && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: '2px',
                          background: PURPLE_LINE,
                        }}
                      />
                    )}

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        background: PURPLE_GRADIENT_SOFT,
                        color: 'white',
                        boxShadow: '0 3px 10px rgba(139, 92, 246, 0.30)',
                        flexShrink: 0,
                      }}
                    >
                      <Building size={18} />
                    </div>

                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '3px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {ws.organization?.name || 'Organización'}
                      </span>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 7px',
                          borderRadius: '20px',
                          background: roleInfo.bg,
                          color: roleInfo.color,
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          width: 'fit-content',
                          letterSpacing: '0.02em',
                        }}
                      >
                        <RoleIcon size={9} strokeWidth={2.5} />
                        {roleInfo.label}
                      </span>
                    </div>

                    {isActive && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          background: GREEN_GRADIENT,
                          boxShadow: '0 2px 6px rgba(34, 197, 94, 0.35)',
                          flexShrink: 0,
                        }}
                      >
                        <Check size={13} color="white" strokeWidth={3} />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Subtle separator */}
            <div
              style={{
                height: '1px',
                background:
                  'linear-gradient(90deg, transparent 0%, var(--border-color) 50%, transparent 100%)',
                margin: '6px 4px',
              }}
            />

            {/* Create New - gradient styled */}
            <button
              onClick={() => {
                setIsOpen(false)
                navigate('/app/organizations')
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 6px 18px rgba(139, 92, 246, 0.40)'
                e.currentTarget.style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 3px 10px rgba(139, 92, 246, 0.28)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: '100%',
                padding: '10px 12px',
                border: 'none',
                background: PURPLE_GRADIENT,
                color: 'white',
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: '0.825rem',
                fontWeight: 600,
                boxShadow: '0 3px 10px rgba(139, 92, 246, 0.28)',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                marginTop: '2px',
              }}
            >
              <Plus size={16} strokeWidth={2.5} />
              Crear Organización
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
