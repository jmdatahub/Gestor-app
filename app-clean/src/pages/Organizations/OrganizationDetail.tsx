import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { 
  getOrganizationById, 
  getOrganizationMembers, 
  updateOrganization, 
  removeMember,
  inviteMember,
  type Organization, 
  type OrganizationMember,
  type AppRole
} from '../../services/organizationService'
import { useWorkspace } from '../../context/WorkspaceContext'
import { ArrowLeft, Users, Settings as SettingsIcon, LogOut, Save, Plus, Trash2 } from 'lucide-react'
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
      const [orgData, membersData] = await Promise.all([
        getOrganizationById(id),
        getOrganizationMembers(id)
      ])
      
      setOrg(orgData)
      setMembers(membersData)
      
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

  if (loading) return <div className="p-8">Cargando...</div>
  if (!org) return <div className="p-8">Organización no encontrada</div>

  return (
    <div className="page-container">
      {/* Header */}
      <div className="mb-6">
        <button 
          onClick={() => navigate('/app/organizations')} 
          className="flex items-center text-gray-500 hover:text-gray-800 mb-4"
        >
          <ArrowLeft size={16} className="mr-1" />
          Volver
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
                        <th>User ID (Email Hidden)</th>
                        <th>Rol</th>
                        <th className="text-right">Acciones</th>
                     </tr>
                  </thead>
                  <tbody>
                     {members.map(m => (
                        <tr key={m.user_id}>
                           <td className="font-mono text-sm">{m.user_id}</td>
                           <td><span className="badge badge-gray">{m.role}</span></td>
                           <td className="text-right">
                              {/* Can't remove yourself usually, but for now simple check */}
                              <button 
                                className="btn btn-icon btn-ghost text-red-500"
                                onClick={() => handleRemoveMember(m.user_id)}
                                title="Eliminar miembro"
                              >
                                 <Trash2 size={16} />
                              </button>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
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
