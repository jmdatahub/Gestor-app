import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useWorkspace } from '../../context/WorkspaceContext'
import { createOrganization } from '../../services/organizationService'
import { useI18n } from '../../hooks/useI18n'
import { Plus, Building, Users, ArrowRight, Check } from 'lucide-react'
import { UiCard } from '../../components/ui/UiCard'
import { UiModal, UiModalHeader, UiModalBody, UiModalFooter } from '../../components/ui/UiModal'
import { UiInput } from '../../components/ui/UiInput'

export default function OrganizationsList() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { currentWorkspace, workspaces, switchWorkspace, isLoading } = useWorkspace()
  
  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSwitchToPersonal = () => {
    switchWorkspace(null)
    navigate('/app/dashboard')
  }

  const handleSwitchToOrg = (orgId: string) => {
    switchWorkspace(orgId)
    navigate('/app/dashboard')
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

      await createOrganization(user.id, { name: newOrgName.trim() })
      
      setShowCreateModal(false)
      setNewOrgName('')
      
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
      {/* Header */}
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

      {/* Workspaces Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Personal Workspace Card */}
        <UiCard 
          className={`cursor-pointer border-2 transition-all hover:shadow-lg ${!currentWorkspace ? 'border-primary' : 'border-transparent hover:border-gray-200'}`}
        >
          <div className="p-6" onClick={handleSwitchToPersonal}>
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
              Tus finanzas personales, ahorros y gastos privados.
            </p>
            <div className="flex justify-end">
              <button className="btn btn-sm btn-ghost">
                Ir al Dashboard <ArrowRight size={16} className="ml-1" />
              </button>
            </div>
          </div>
        </UiCard>

        {/* Organization Cards */}
        {workspaces.map((ws) => {
          const isActive = currentWorkspace?.id === ws.org_id
          return (
            <UiCard 
              key={ws.org_id}
              className={`cursor-pointer border-2 transition-all hover:shadow-lg ${isActive ? 'border-primary' : 'border-transparent hover:border-gray-200'}`}
            >
              <div className="p-6" onClick={() => handleSwitchToOrg(ws.org_id)}>
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
                <h3 className="text-xl font-bold mb-2">{ws.organization?.name || 'Organización'}</h3>
                <p className="text-gray-500 text-sm mb-2">
                  Rol: <span className="font-medium capitalize">{ws.role}</span>
                </p>
                <div className="flex justify-between mt-4">
                  <button 
                    className="btn btn-sm btn-ghost"
                    onClick={(e) => { e.stopPropagation(); navigate(`/app/organizations/${ws.org_id}`) }}
                  >
                    Ver detalles
                  </button>
                  <button className="btn btn-sm btn-ghost">
                    Cambiar <ArrowRight size={16} className="ml-1" />
                  </button>
                </div>
              </div>
            </UiCard>
          )
        })}
      </div>

      {/* Empty State if no organizations */}
      {workspaces.length === 0 && (
        <div className="mt-8 p-8 text-center text-secondary bg-gray-50 rounded-lg">
          <Users size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium mb-2">Aún no perteneces a ninguna organización</p>
          <p className="text-sm">Crea una nueva organización o espera a que te inviten a una.</p>
        </div>
      )}

      {/* Create Organization Modal */}
      <UiModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} width="400px">
        <UiModalHeader>
          <h3 className="text-lg font-bold">Nueva Organización</h3>
        </UiModalHeader>
        <form onSubmit={handleCreateOrg}>
          <UiModalBody>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}
            <UiInput
              label="Nombre de la empresa"
              placeholder="Ej: Mi StartUp S.L."
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              required
            />
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
            >
              {submitting ? 'Creando...' : 'Crear'}
            </button>
          </UiModalFooter>
        </form>
      </UiModal>
    </div>
  )
}
