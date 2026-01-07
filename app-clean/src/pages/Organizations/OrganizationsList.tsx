import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { getUserOrganizations, createOrganization, type Organization } from '../../services/organizationService'
import { useWorkspace } from '../../context/WorkspaceContext'
import { Plus, Building, Users, ArrowRight, Check } from 'lucide-react'
import { UiCard } from '../../components/ui/UiCard'
import { UiModal, UiModalHeader, UiModalBody, UiModalFooter } from '../../components/ui/UiModal'
import { UiInput } from '../../components/ui/UiInput'
import { useI18n } from '../../hooks/useI18n'

export default function OrganizationsList() {
  const navigate = useNavigate()
  const { switchWorkspace, currentWorkspace, workspaces } = useWorkspace()
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadOrgs()
  }, [])

  // Reload when context workspaces change (e.g. after creation)
  useEffect(() => {
    // Sync with context if needed, but we also fetch fresh list
  }, [workspaces])

  const loadOrgs = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      const data = await getUserOrganizations(user.id)
      setOrgs(data)
    } catch (error) {
      console.error('Error loading organizations:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newOrgName.trim()) return
    setSubmitting(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      const newOrg = await createOrganization(user.id, { name: newOrgName })
      setShowCreateModal(false)
      setNewOrgName('')
      loadOrgs()
      // Optionally switch to new org immediately
      // switchWorkspace(newOrg.id) 
    } catch (error) {
      console.error('Error creating organization:', error)
      alert('Error creating organization')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSwitch = (orgId: string | null) => {
    switchWorkspace(orgId)
    navigate('/app/dashboard')
  }

  if (loading) {
    return <div className="p-8 text-center">Loading...</div>
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Mis Organizaciones</h1>
          <p className="page-subtitle">Gestiona tus empresas y espacios de trabajo</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          <Plus size={20} />
          Crear Organización
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Personal Workspace Card */}
        <UiCard 
          className={`cursor-pointer border-2 ${!currentWorkspace ? 'border-primary' : 'border-transparent hover:border-gray-200'}`}
          onClick={() => handleSwitch(null)}
        >
          <div className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                <Building size={24} />
              </div>
              {!currentWorkspace && (
                <span className="badge badge-success">
                  <Check size={14} className="mr-1" /> Activo
                </span>
              )}
            </div>
            <h3 className="text-xl font-bold mb-2">Espacio Personal</h3>
            <p className="text-gray-500 text-sm mb-4">
              Tus finanzas personales, ahorros y gastos privados only for you.
            </p>
            <div className="flex justify-end">
             <button className="btn btn-sm btn-ghost" onClick={(e) => {
                 e.stopPropagation();
                 handleSwitch(null);
             }}>
                 Ir al Dashboard <ArrowRight size={16} className="ml-1" />
             </button>
            </div>
          </div>
        </UiCard>

        {/* Organizations Cards */}
        {orgs.map(org => {
          const isActive = currentWorkspace?.id === org.id
          return (
            <UiCard 
                key={org.id} 
                className={`cursor-pointer border-2 ${isActive ? 'border-primary' : 'border-transparent hover:border-gray-200'}`}
                onClick={() => navigate(`/app/organizations/${org.id}`)}
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-purple-100 text-purple-600 rounded-lg">
                    <Users size={24} />
                  </div>
                  {isActive && (
                    <span className="badge badge-success">
                      <Check size={14} className="mr-1" /> Activo
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-bold mb-2">{org.name}</h3>
                <p className="text-gray-500 text-sm mb-4">
                    {/* Placeholder for role or members count */}
                    Organization ID: {org.id.substring(0, 8)}...
                </p>
                <div className="flex justify-between items-center mt-4">
                    <button 
                        className="btn btn-sm btn-secondary"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleSwitch(org.id);
                        }}
                    >
                        Switch To
                    </button>
                    <button 
                        className="btn btn-sm btn-ghost"
                        onClick={(e) => {
                             e.stopPropagation();
                             navigate(`/app/organizations/${org.id}`);
                        }}
                    >
                        Manage <ArrowRight size={16} className="ml-1" />
                    </button>
                </div>
              </div>
            </UiCard>
          )
        })}
      </div>

      {/* Create Modal */}
      <UiModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} width="400px">
        <UiModalHeader>
          <h3 className="text-lg font-bold">Nueva Organización</h3>
        </UiModalHeader>
        <form onSubmit={handleCreate}>
          <UiModalBody>
            <UiInput 
              label="Nombre de la empresa" 
              placeholder="Ej: Mi StartUp S.L." 
              value={newOrgName}
              onChange={e => setNewOrgName(e.target.value)}
              required
            />
          </UiModalBody>
          <UiModalFooter>
            <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Creando...' : 'Crear'}
            </button>
          </UiModalFooter>
        </form>
      </UiModal>
    </div>
  )
}
