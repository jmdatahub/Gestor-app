import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { 
  getOrganizationById, 
  getOrganizationMembers, 
  getOrganizationInvitations,
  updateOrganization, 
  removeMember,
  cancelInvitation,
  inviteMember,
  type Organization, 
  type OrganizationMember,
  type OrganizationInvitation,
  type AppRole
} from '../../services/organizationService'
import { useWorkspace } from '../../context/WorkspaceContext'
import { ArrowLeft, Users, Settings as SettingsIcon, LogOut, Save, Plus, Trash2, Mail, Clock, X } from 'lucide-react'
import { UiCard } from '../../components/ui/UiCard'
import { UiInput } from '../../components/ui/UiInput'
import { UiSegmented } from '../../components/ui/UiSegmented'
import { UiModal, UiModalHeader, UiModalBody, UiModalFooter } from '../../components/ui/UiModal'
import { UiSelect } from '../../components/ui/UiSelect'

export default function OrganizationDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { switchWorkspace, currentWorkspace } = useWorkspace()
  
  const [org, setOrg] = useState<Organization | null>(null)
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'general' | 'members'>('general')
  
  // Edit State
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [saving, setSaving] = useState(false)

  // Invite State
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<AppRole>('member')

  useEffect(() => {
    if (id) loadData()
  }, [id])

  const loadData = async () => {
    if (!id) return
    try {
      setLoading(true)
      const [orgData, membersData, invitationsData] = await Promise.all([
        getOrganizationById(id),
        getOrganizationMembers(id),
        getOrganizationInvitations(id)
      ])
      
      setOrg(orgData)
      setMembers(membersData)
      setInvitations(invitationsData)
      
      if (orgData) {
        setName(orgData.name)
        setSlug(orgData.slug || '')
      }
    } catch (error) {
      console.error('Error loading organization:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    setSaving(true)
    try {
      await updateOrganization(id, { name, slug: slug || null })
      alert('Organización actualizada')
      // Refresh current workspace if we are editing the active one
      if (currentWorkspace?.id === id) {
        // Force reload by switching or refreshing page
        window.location.reload() 
      }
    } catch (error) {
      console.error('Error updating:', error)
      alert('Error al actualizar')
    } finally {
      setSaving(false)
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    
    try {
      await inviteMember(id, inviteEmail, inviteRole)
      alert('Invitación enviada (Simulación)')
      setShowInviteModal(false)
      setInviteEmail('')
    } catch (error: any) {
      console.error('Invite error:', error)
      alert(error.message || 'Error al invitar')
    }
  }

  const handleRemoveMember = async (userId: string) => {
    if (!id || !confirm('¿Eliminar miembro?')) return
    try {
      await removeMember(id, userId)
      loadData()
    } catch (error) {
       console.error('Error removing member:', error)
       alert('Error al eliminar miembro')
    }
  }

  const handleCancelInvitation = async (invitationId: string) => {
    if (!confirm('¿Cancelar esta invitación?')) return
    try {
      await cancelInvitation(invitationId)
      loadData()
    } catch (error) {
       console.error('Error canceling invitation:', error)
       alert('Error al cancelar invitación')
    }
  }

  if (loading) return <div className="p-8">Cargando...</div>
  if (!org) return <div className="p-8">Organización no encontrada</div>

  return (
    <div className="page-container">
      {/* Header */}
      <div className="mb-6">
        <button 
          onClick={() => navigate('/app/organizations')} 
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            marginBottom: '1rem',
            borderRadius: '8px',
            background: 'var(--gray-100)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-secondary)',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'var(--gray-200)'
            e.currentTarget.style.color = 'var(--text-primary)'
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'var(--gray-100)'
            e.currentTarget.style.color = 'var(--text-secondary)'
          }}
        >
          <ArrowLeft size={16} />
          Volver a Organizaciones
        </button>
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">{org.name}</h1>
          {currentWorkspace?.id !== org.id && (
             <button className="btn btn-outline" onClick={() => switchWorkspace(org.id)}>
               Cambiar a esta Organización
             </button>
          )}
        </div>
      </div>

      <div className="mb-6">
        <UiSegmented 
           value={activeTab} 
           onChange={(v) => setActiveTab(v as any)}
           options={[
             { value: 'general', label: 'General', icon: <SettingsIcon size={16} /> },
             { value: 'members', label: 'Miembros', icon: <Users size={16} /> },
           ]}
        />
      </div>

      {activeTab === 'general' && (
        <UiCard className="max-w-xl">
           <form onSubmit={handleUpdate} className="p-6">
              <h3 className="text-lg font-bold mb-4">Configuración General</h3>
              <div className="space-y-4">
                 <UiInput label="Nombre de la Organización" value={name} onChange={e => setName(e.target.value)} required />
                 {/* <UiInput label="Slug / Identificador" value={slug} onChange={e => setSlug(e.target.value)} /> */}
                 <div className="pt-4">
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                        <Save size={16} /> {saving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                 </div>
              </div>
           </form>
        </UiCard>
      )}

      {activeTab === 'members' && (
         <UiCard>
            <div className="p-6">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold">Miembros del equipo</h3>
                  <button className="btn btn-primary" onClick={() => setShowInviteModal(true)}>
                     <Plus size={16} /> Invitar Miembro
                  </button>
               </div>
               
               <table className="table w-full">
                  <thead>
                     <tr>
                        <th>Miembro</th>
                        <th>Rol</th>
                        <th className="text-right">Acciones</th>
                     </tr>
                  </thead>
                  <tbody>
                     {members.map(m => {
                       const profile = m.profile
                       const displayName = profile?.display_name || profile?.email?.split('@')[0] || 'Usuario'
                       const email = profile?.email || 'Sin email'
                       const avatarType = profile?.avatar_type || ''
                       const isEmoji = avatarType.startsWith('emoji:')
                       const avatarEmoji = isEmoji ? avatarType.split(':')[1] : null
                       const avatarBg = avatarType.startsWith('bg:') ? avatarType.split(':')[1] : '#6366f1'
                       
                       return (
                        <tr key={m.user_id}>
                           <td>
                             <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                               <div style={{ 
                                 width: 36, height: 36, borderRadius: 8, 
                                 background: isEmoji ? '#1e293b' : avatarBg,
                                 display: 'flex', alignItems: 'center', justifyContent: 'center',
                                 fontSize: isEmoji ? 18 : 14, fontWeight: 700, color: 'white',
                                 border: '2px solid #334155'
                               }}>
                                 {avatarEmoji || displayName.charAt(0).toUpperCase()}
                               </div>
                               <div>
                                 <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{displayName}</div>
                                 <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{email}</div>
                               </div>
                             </div>
                           </td>
                           <td><span className="badge badge-gray">{m.role}</span></td>
                           <td className="text-right">
                              <button 
                                className="btn btn-icon btn-ghost text-red-500"
                                onClick={() => handleRemoveMember(m.user_id)}
                                title="Eliminar miembro"
                              >
                                 <Trash2 size={16} />
                              </button>
                           </td>
                        </tr>
                       )
                     })}
                  </tbody>
               </table>
               
               {/* Pending Invitations Section */}
               {invitations.length > 0 && (
                 <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                     <Mail size={18} style={{ color: '#8B5CF6' }} />
                     <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                       Invitaciones Pendientes ({invitations.length})
                     </h4>
                   </div>
                   
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                     {invitations.map(inv => (
                       <div 
                         key={inv.id}
                         style={{
                           display: 'flex',
                           alignItems: 'center',
                           justifyContent: 'space-between',
                           padding: '0.75rem 1rem',
                           borderRadius: '10px',
                           background: 'rgba(139, 92, 246, 0.05)',
                           border: '1px solid rgba(139, 92, 246, 0.15)'
                         }}
                       >
                         <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                           <div style={{
                             width: 36, height: 36, borderRadius: 8,
                             background: 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)',
                             display: 'flex', alignItems: 'center', justifyContent: 'center',
                             color: 'white'
                           }}>
                             <Mail size={16} />
                           </div>
                           <div>
                             <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{inv.email}</div>
                             <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                               <Clock size={10} />
                               Invitado el {new Date(inv.created_at).toLocaleDateString('es-ES')}
                             </div>
                           </div>
                         </div>
                         
                         <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                           <span style={{
                             padding: '0.25rem 0.625rem',
                             borderRadius: '12px',
                             background: 'rgba(139, 92, 246, 0.1)',
                             color: '#8B5CF6',
                             fontSize: '0.75rem',
                             fontWeight: 600
                           }}>
                             {inv.role}
                           </span>
                           <button
                             onClick={() => handleCancelInvitation(inv.id)}
                             style={{
                               padding: '0.375rem',
                               borderRadius: '6px',
                               background: 'rgba(239, 68, 68, 0.1)',
                               border: '1px solid rgba(239, 68, 68, 0.2)',
                               color: '#EF4444',
                               cursor: 'pointer',
                               display: 'flex',
                               alignItems: 'center'
                             }}
                             title="Cancelar invitación"
                           >
                             <X size={14} />
                           </button>
                         </div>
                       </div>
                     ))}
                   </div>
                 </div>
               )}
            </div>
         </UiCard>
      )}

      {/* Invite Modal */}
      <UiModal isOpen={showInviteModal} onClose={() => setShowInviteModal(false)} width="400px">
         <UiModalHeader>Invitar Miembro</UiModalHeader>
         <form onSubmit={handleInvite}>
           <UiModalBody>
              <div className="bg-yellow-50 p-3 rounded mb-4 text-sm text-yellow-800">
                 ⚠️ Nota: Las invitaciones por email requieren un backend serverless. 
                 Esta funcionalidad es una simulación visual por ahora.
              </div>
              <UiInput 
                label="Email" 
                type="email" 
                value={inviteEmail} 
                onChange={e => setInviteEmail(e.target.value)} 
                required 
              />
              <div className="mt-4">
                 <label className="label">Rol</label>
                 <UiSelect 
                    value={inviteRole}
                    onChange={(v) => setInviteRole(v as AppRole)}
                    options={[
                        { value: 'admin', label: 'Admin'},
                        { value: 'member', label: 'Member'},
                        { value: 'viewer', label: 'Viewer'}
                    ]}
                 />
              </div>
           </UiModalBody>
           <UiModalFooter>
              <button type="button" className="btn btn-secondary" onClick={() => setShowInviteModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Enviar Invitación</button>
           </UiModalFooter>
         </form>
      </UiModal>
    </div>
  )
}
