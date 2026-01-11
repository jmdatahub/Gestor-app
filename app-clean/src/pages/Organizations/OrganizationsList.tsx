import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useWorkspace } from '../../context/WorkspaceContext'
import { createOrganization, deleteOrganization, getOrganizationMembers, OrganizationMember } from '../../services/organizationService'
import { useI18n } from '../../hooks/useI18n'
import { Plus, Building, Users, ArrowRight, Check, Crown, Shield, User, Eye, ChevronDown, ChevronUp, Sparkles, Briefcase, Mail, X, UserPlus, Trash2, Pencil, MoreVertical } from 'lucide-react'
import { UiCard } from '../../components/ui/UiCard'
import { UiModal, UiModalHeader, UiModalBody, UiModalFooter } from '../../components/ui/UiModal'
import { UiInput } from '../../components/ui/UiInput'

// Helper to get role icon and color
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

export default function OrganizationsList() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { currentWorkspace, workspaces, switchWorkspace, isLoading } = useWorkspace()
  
  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [newOrgDescription, setNewOrgDescription] = useState('')
  const [newOrgParentId, setNewOrgParentId] = useState<string | null>(null)
  const [inviteEmails, setInviteEmails] = useState<string[]>([])
  const [currentInviteEmail, setCurrentInviteEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Members State (for expanded cards)
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set())
  const [orgMembers, setOrgMembers] = useState<Record<string, OrganizationMember[]>>({})
  const [loadingMembers, setLoadingMembers] = useState<Set<string>>(new Set())
  
  // Actions menu state
  const [actionsMenuOpen, setActionsMenuOpen] = useState<string | null>(null)

  const handleDeleteOrg = async (orgId: string, orgName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setActionsMenuOpen(null)
    
    if (!confirm(`¿Estás seguro de eliminar "${orgName}"? Esta acción no se puede deshacer.`)) return
    
    try {
      await deleteOrganization(orgId)
      // If we deleted the current workspace, switch to personal
      if (currentWorkspace?.id === orgId) {
        switchWorkspace(null)
      }
      window.location.reload()
    } catch (err: any) {
      console.error('Error deleting organization:', err)
      alert(err.message || 'Error al eliminar la organización')
    }
  }

  const handleSwitchToPersonal = () => {
    switchWorkspace(null)
    navigate('/app/dashboard')
  }

  const handleSwitchToOrg = (orgId: string) => {
    switchWorkspace(orgId)
    navigate('/app/dashboard')
  }
  
  const toggleExpandOrg = async (orgId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const newExpanded = new Set(expandedOrgs)
    
    if (newExpanded.has(orgId)) {
      newExpanded.delete(orgId)
    } else {
      newExpanded.add(orgId)
      // Always reload members when expanding to ensure fresh data
      if (!loadingMembers.has(orgId)) {
        setLoadingMembers(prev => new Set(prev).add(orgId))
        try {
          const members = await getOrganizationMembers(orgId)
          console.log('[DEBUG] OrganizationsList - Members loaded:', members)
          setOrgMembers(prev => ({ ...prev, [orgId]: members }))
        } catch (err) {
          console.error('Error loading members:', err)
        } finally {
          setLoadingMembers(prev => {
            const next = new Set(prev)
            next.delete(orgId)
            return next
          })
        }
      }
    }
    setExpandedOrgs(newExpanded)
  }

  // Invite email helpers
  const addInviteEmail = () => {
    const email = currentInviteEmail.trim().toLowerCase()
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !inviteEmails.includes(email)) {
      setInviteEmails([...inviteEmails, email])
      setCurrentInviteEmail('')
    }
  }

  const removeInviteEmail = (email: string) => {
    setInviteEmails(inviteEmails.filter(e => e !== email))
  }

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newOrgName.trim()) return
    
    setSubmitting(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('No se pudo obtener el usuario')
        return
      }

      const newOrg = await createOrganization(user.id, { 
        name: newOrgName.trim(),
        description: newOrgDescription.trim() || undefined,
        parent_id: newOrgParentId || undefined
      })
      
      // Log invited emails for future invite system
      if (inviteEmails.length > 0) {
        console.log('[INFO] Pending invitations for org', newOrg.id, ':', inviteEmails)
        // TODO: Implement proper invite system via Edge Function
        // For now, we save them to organization_invitations table if it exists
        for (const email of inviteEmails) {
          try {
            await supabase.from('organization_invitations').insert({
              org_id: newOrg.id,
              email: email,
              role: 'member',
              invited_by: user.id
            })
          } catch (inviteErr) {
            console.warn('Could not create invitation for', email, inviteErr)
          }
        }
      }
      
      setShowCreateModal(false)
      setNewOrgName('')
      setNewOrgDescription('')
      setNewOrgParentId(null)
      setInviteEmails([])
      setCurrentInviteEmail('')
      
      // Refresh the page to reload workspaces
      window.location.reload()
    } catch (err: any) {
      console.error('Error creating organization:', err)
      setError(err.message || 'Error al crear la organización')
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="d-flex items-center justify-center" style={{ minHeight: '200px' }}>
          <div className="spinner"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      {/* Header with gradient accent */}
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(139, 92, 246, 0.35)'
            }}>
              <Briefcase size={24} color="white" />
            </div>
            <h1 className="page-title" style={{ margin: 0 }}>Mis Organizaciones</h1>
          </div>
          <p className="page-subtitle" style={{ marginLeft: '60px' }}>Gestiona tus empresas y espacios de trabajo colaborativo</p>
        </div>
        <button 
          className="btn btn-primary" 
          onClick={() => setShowCreateModal(true)}
          style={{
            background: 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)',
            boxShadow: '0 4px 14px rgba(139, 92, 246, 0.35)',
            padding: '0.75rem 1.5rem'
          }}
        >
          <Plus size={20} />
          Nueva Organización
        </button>
      </div>

      {/* Workspaces List - Vertical Layout */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        {/* Personal Workspace Card - Enhanced */}
        <div 
          onClick={handleSwitchToPersonal}
          style={{
            background: 'var(--bg-card)',
            borderRadius: '16px',
            border: !currentWorkspace ? '2px solid #3B82F6' : '1px solid var(--border-color)',
            padding: '1.5rem',
            cursor: 'pointer',
            transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            boxShadow: !currentWorkspace 
              ? '0 0 0 4px rgba(59, 130, 246, 0.15), 0 8px 24px rgba(0, 0, 0, 0.08)' 
              : '0 2px 8px rgba(0, 0, 0, 0.04)',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseEnter={(e) => {
            if (currentWorkspace) {
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.08)'
              e.currentTarget.style.transform = 'translateY(-2px)'
            }
          }}
          onMouseLeave={(e) => {
            if (currentWorkspace) {
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.04)'
              e.currentTarget.style.transform = 'translateY(0)'
            }
          }}
        >
          {/* Decorative gradient line */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, #3B82F6 0%, #60A5FA 100%)'
          }} />
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Icon with gradient background */}
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #3B82F6 0%, #60A5FA 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
              flexShrink: 0
            }}>
              <Building size={28} color="white" />
            </div>
            
            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                <h3 style={{ 
                  fontSize: '1.25rem', 
                  fontWeight: 700, 
                  color: 'var(--text-primary)',
                  margin: 0
                }}>
                  Espacio Personal
                </h3>
                {!currentWorkspace && (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.25rem 0.625rem',
                    borderRadius: '20px',
                    background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
                    color: 'white',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    boxShadow: '0 2px 8px rgba(34, 197, 94, 0.3)'
                  }}>
                    <Check size={12} /> Activo
                  </span>
                )}
              </div>
              <p style={{ 
                color: 'var(--text-secondary)', 
                fontSize: '0.9rem',
                margin: 0
              }}>
                Tus finanzas personales, ahorros y gastos privados
              </p>
            </div>
            
            {/* Action */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Ir al Dashboard</span>
              <ArrowRight size={18} />
            </div>
          </div>
        </div>

        {/* Organization Cards - Enhanced */}
        {workspaces.map((ws) => {
          const isActive = currentWorkspace?.id === ws.org_id
          const isExpanded = expandedOrgs.has(ws.org_id)
          const members = orgMembers[ws.org_id] || []
          const isLoadingMembers = loadingMembers.has(ws.org_id)
          const roleInfo = getRoleInfo(ws.role)
          const RoleIcon = roleInfo.icon
          
          return (
            <div 
              key={ws.org_id}
              style={{
                background: 'var(--bg-card)',
                borderRadius: '16px',
                border: isActive ? '2px solid #8B5CF6' : '1px solid var(--border-color)',
                overflow: 'hidden',
                transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                boxShadow: isActive 
                  ? '0 0 0 4px rgba(139, 92, 246, 0.15), 0 8px 24px rgba(0, 0, 0, 0.08)' 
                  : '0 2px 8px rgba(0, 0, 0, 0.04)'
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.08)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.04)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }
              }}
            >
              {/* Decorative gradient line */}
              <div style={{
                height: '4px',
                background: 'linear-gradient(90deg, #8B5CF6 0%, #A78BFA 50%, #C4B5FD 100%)'
              }} />
              
              {/* Main Card Content */}
              <div 
                onClick={() => handleSwitchToOrg(ws.org_id)}
                style={{ 
                  padding: '1.5rem',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  {/* Icon with gradient background */}
                  <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '14px',
                    background: 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
                    flexShrink: 0
                  }}>
                    <Users size={28} color="white" />
                  </div>
                  
                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                      <h3 style={{ 
                        fontSize: '1.25rem', 
                        fontWeight: 700, 
                        color: 'var(--text-primary)',
                        margin: 0
                      }}>
                        {ws.organization?.name || 'Organización'}
                      </h3>
                      
                      {/* Role Badge */}
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.375rem',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '20px',
                        background: roleInfo.bg,
                        color: roleInfo.color,
                        fontSize: '0.75rem',
                        fontWeight: 600
                      }}>
                        <RoleIcon size={12} /> {roleInfo.label}
                      </span>
                      
                      {isActive && (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.25rem 0.625rem',
                          borderRadius: '20px',
                          background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
                          color: 'white',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          boxShadow: '0 2px 8px rgba(34, 197, 94, 0.3)'
                        }}>
                          <Check size={12} /> Activo
                        </span>
                      )}
                    </div>
                    
                    {/* Stats Row */}
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '1rem',
                      color: 'var(--text-secondary)',
                      fontSize: '0.875rem',
                      flexWrap: 'wrap'
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <Users size={14} />
                        {members.length > 0 ? `${members.length} miembro${members.length !== 1 ? 's' : ''}` : 'Cargando...'}
                      </span>
                      
                      {/* Parent Org Badge */}
                      {ws.organization?.parent_id && (() => {
                        const parentOrg = workspaces.find(w => w.org_id === ws.organization.parent_id)
                        return parentOrg ? (
                          <span style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.375rem',
                            padding: '0.125rem 0.5rem',
                            borderRadius: '12px',
                            background: 'rgba(139, 92, 246, 0.1)',
                            border: '1px solid rgba(139, 92, 246, 0.2)',
                            color: '#8B5CF6',
                            fontSize: '0.75rem',
                            fontWeight: 500
                          }}>
                            ↳ {parentOrg.organization?.name}
                          </span>
                        ) : null
                      })()}
                      
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <Sparkles size={14} />
                        Espacio colaborativo
                      </span>
                    </div>
                    
                    {/* Description */}
                    {ws.organization?.description && (
                      <p style={{ 
                        margin: '0.5rem 0 0 0', 
                        fontSize: '0.8rem', 
                        color: 'var(--text-muted)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '400px'
                      }}>
                        {ws.organization.description}
                      </p>
                    )}
                  </div>
                  
                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button 
                      className="btn btn-sm"
                      onClick={(e) => { e.stopPropagation(); navigate(`/app/organizations/${ws.org_id}`) }}
                      style={{
                        background: 'var(--gray-100)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-color)'
                      }}
                    >
                      <Pencil size={14} style={{ marginRight: '0.25rem' }} /> Editar
                    </button>
                    <button 
                      className="btn btn-sm"
                      onClick={(e) => toggleExpandOrg(ws.org_id, e)}
                      style={{
                        background: isExpanded ? 'rgba(139, 92, 246, 0.1)' : 'var(--gray-100)',
                        color: isExpanded ? '#8B5CF6' : 'var(--text-primary)',
                        border: isExpanded ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid var(--border-color)',
                        padding: '0.375rem'
                      }}
                    >
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                    
                    {/* Delete button - only for owners */}
                    {ws.role === 'owner' && (
                      <button 
                        className="btn btn-sm"
                        onClick={(e) => handleDeleteOrg(ws.org_id, ws.organization?.name || 'Organización', e)}
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          color: '#EF4444',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                          padding: '0.375rem'
                        }}
                        title="Eliminar organización"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Expanded Members Section */}
              {isExpanded && (
                <div style={{
                  borderTop: '1px solid var(--border-color)',
                  padding: '1rem 1.5rem',
                  background: 'var(--gray-50)'
                }}>
                  <h4 style={{ 
                    fontSize: '0.8rem', 
                    fontWeight: 600, 
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <Users size={14} /> Miembros del equipo
                  </h4>
                  
                  {isLoadingMembers ? (
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      padding: '1rem',
                      color: 'var(--text-secondary)'
                    }}>
                      <div className="spinner" style={{ width: '20px', height: '20px' }}></div>
                      <span style={{ marginLeft: '0.5rem', fontSize: '0.875rem' }}>Cargando miembros...</span>
                    </div>
                  ) : members.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {members.map((member) => {
                        const memberRoleInfo = getRoleInfo(member.role)
                        const MemberRoleIcon = memberRoleInfo.icon
                        return (
                          <div 
                            key={member.user_id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.75rem',
                              padding: '0.625rem 0.875rem',
                              borderRadius: '10px',
                              background: 'var(--bg-card)',
                              border: '1px solid var(--border-color)'
                            }}
                          >
                            {/* Avatar placeholder */}
                            <div style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              background: `linear-gradient(135deg, ${memberRoleInfo.color}40 0%, ${memberRoleInfo.color}20 100%)`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              <MemberRoleIcon size={16} color={memberRoleInfo.color} />
                            </div>
                            
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ 
                                margin: 0, 
                                fontSize: '0.875rem', 
                                fontWeight: 500,
                                color: 'var(--text-primary)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                {member.profile?.display_name || member.profile?.email || `Usuario ${member.user_id.slice(0, 8)}...`}
                              </p>
                            </div>
                            
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '12px',
                              background: memberRoleInfo.bg,
                              color: memberRoleInfo.color,
                              fontSize: '0.7rem',
                              fontWeight: 600
                            }}>
                              {memberRoleInfo.label}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p style={{ 
                      color: 'var(--text-muted)', 
                      fontSize: '0.875rem',
                      textAlign: 'center',
                      padding: '0.5rem'
                    }}>
                      No hay información de miembros disponible
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Empty State if no organizations - Enhanced */}
      {workspaces.length === 0 && (
        <div style={{
          marginTop: '2rem',
          padding: '3rem',
          textAlign: 'center',
          background: 'var(--bg-card)',
          borderRadius: '20px',
          border: '2px dashed var(--border-color)'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(99, 102, 241, 0.15) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem'
          }}>
            <Users size={40} style={{ color: '#8B5CF6', opacity: 0.7 }} />
          </div>
          <h3 style={{ 
            fontSize: '1.25rem', 
            fontWeight: 600, 
            color: 'var(--text-primary)',
            marginBottom: '0.5rem'
          }}>
            Aún no perteneces a ninguna organización
          </h3>
          <p style={{ 
            color: 'var(--text-secondary)', 
            fontSize: '0.9rem',
            marginBottom: '1.5rem'
          }}>
            Crea una nueva organización para colaborar con tu equipo o espera a que te inviten a una.
          </p>
          <button 
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
            style={{
              background: 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)',
              boxShadow: '0 4px 14px rgba(139, 92, 246, 0.35)'
            }}
          >
            <Plus size={20} />
            Crear mi primera organización
          </button>
        </div>
      )}

      {/* Create Organization Modal - Enhanced */}
      <UiModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} width="440px">
        <UiModalHeader>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Briefcase size={20} color="white" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Nueva Organización</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>Crea un espacio para tu equipo</p>
            </div>
          </div>
        </UiModalHeader>
        <form onSubmit={handleCreateOrg}>
          <UiModalBody>
            {error && (
              <div style={{
                marginBottom: '1rem',
                padding: '0.875rem',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#DC2626',
                borderRadius: '10px',
                fontSize: '0.875rem'
              }}>
                {error}
              </div>
            )}
            <UiInput
              label="Nombre de la organización"
              placeholder="Ej: Acme Corporation"
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              required
            />
            
            {/* Description Field */}
            <div style={{ marginTop: '1rem' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.375rem', 
                fontSize: '0.875rem', 
                fontWeight: 500,
                color: 'var(--text-primary)'
              }}>
                Descripción <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</span>
              </label>
              <textarea
                placeholder="Describe brevemente el propósito de esta organización..."
                value={newOrgDescription}
                onChange={(e) => setNewOrgDescription(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '0.75rem',
                  fontSize: '0.9rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
              />
            </div>
            
            {/* Parent Organization Selector */}
            {workspaces.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.375rem', 
                  fontSize: '0.875rem', 
                  fontWeight: 500,
                  color: 'var(--text-primary)'
                }}>
                  Pertenece a <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(conglomerado)</span>
                </label>
                <select
                  value={newOrgParentId || ''}
                  onChange={(e) => setNewOrgParentId(e.target.value || null)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    fontSize: '0.9rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer'
                  }}
                >
                  <option value="">— Ninguno (organización independiente) —</option>
                  {workspaces.map((ws) => (
                    <option key={ws.org_id} value={ws.org_id}>
                      {ws.organization?.name || 'Organización'}
                    </option>
                  ))}
                </select>
                <p style={{ 
                  fontSize: '0.75rem', 
                  color: 'var(--text-muted)', 
                  marginTop: '0.375rem' 
                }}>
                  Si esta organización forma parte de un grupo mayor, selecciónalo aquí.
                </p>
              </div>
            )}
            
            {/* Invite Members Section */}
            <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
              <label style={{ 
                display: 'flex', 
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.5rem', 
                fontSize: '0.875rem', 
                fontWeight: 500,
                color: 'var(--text-primary)'
              }}>
                <UserPlus size={16} />
                Invitar miembros <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</span>
              </label>
              
              {/* Email input */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={currentInviteEmail}
                  onChange={(e) => setCurrentInviteEmail(e.target.value)}
                  onKeyPress={(e) => { if (e.key === 'Enter') { e.preventDefault(); addInviteEmail(); } }}
                  style={{
                    flex: 1,
                    padding: '0.625rem 0.75rem',
                    fontSize: '0.9rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)'
                  }}
                />
                <button
                  type="button"
                  onClick={addInviteEmail}
                  disabled={!currentInviteEmail.trim()}
                  style={{
                    padding: '0.625rem 1rem',
                    borderRadius: '8px',
                    background: currentInviteEmail.trim() ? 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)' : 'var(--gray-200)',
                    color: currentInviteEmail.trim() ? 'white' : 'var(--text-muted)',
                    border: 'none',
                    cursor: currentInviteEmail.trim() ? 'pointer' : 'not-allowed',
                    fontSize: '0.875rem',
                    fontWeight: 600
                  }}
                >
                  Añadir
                </button>
              </div>
              
              {/* Added emails list */}
              {inviteEmails.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                  {inviteEmails.map((email) => (
                    <span
                      key={email}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.375rem',
                        padding: '0.25rem 0.625rem',
                        borderRadius: '16px',
                        background: 'rgba(139, 92, 246, 0.1)',
                        border: '1px solid rgba(139, 92, 246, 0.2)',
                        color: '#8B5CF6',
                        fontSize: '0.8rem'
                      }}
                    >
                      <Mail size={12} />
                      {email}
                      <button
                        type="button"
                        onClick={() => removeInviteEmail(email)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '2px',
                          cursor: 'pointer',
                          color: '#8B5CF6',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              
              <p style={{ 
                fontSize: '0.75rem', 
                color: 'var(--text-muted)', 
                marginTop: '0.5rem' 
              }}>
                Las invitaciones se enviarán después de crear la organización.
              </p>
            </div>
          </UiModalBody>
          <UiModalFooter>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => setShowCreateModal(false)}
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={submitting || !newOrgName.trim()}
              style={{
                background: 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)',
                boxShadow: '0 4px 14px rgba(139, 92, 246, 0.35)'
              }}
            >
              {submitting ? 'Creando...' : 'Crear Organización'}
            </button>
          </UiModalFooter>
        </form>
      </UiModal>
    </div>
  )
}
