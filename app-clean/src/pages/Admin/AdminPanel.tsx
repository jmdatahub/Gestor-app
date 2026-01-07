import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useI18n } from '../../hooks/useI18n'
import { Shield, Users, Building, AlertTriangle, UserX, UserCheck } from 'lucide-react'
import { UiCard } from '../../components/ui/UiCard'

// Super Admin email - hardcoded for now
const SUPER_ADMIN_EMAIL = 'mp.jorge00@gmail.com'

interface UserProfile {
  id: string
  email: string | undefined
  created_at: string
  is_suspended?: boolean
}

export default function AdminPanel() {
  const { t } = useI18n()
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<UserProfile[]>([])
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null)

  useEffect(() => {
    checkAdminAccess()
  }, [])

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) {
        setCurrentUserEmail(user.email)
        setIsSuperAdmin(user.email === SUPER_ADMIN_EMAIL)
      }
    } catch (error) {
      console.error('Error checking admin access:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="d-flex items-center justify-center" style={{ minHeight: '200px' }}>
          <div className="spinner"></div>
        </div>
      </div>
    )
  }

  if (!isSuperAdmin) {
    return (
      <div className="page-container">
        <UiCard className="max-w-lg mx-auto mt-12 text-center p-8">
          <AlertTriangle size={64} className="mx-auto mb-4 text-yellow-500" />
          <h2 className="text-2xl font-bold mb-2">Acceso Denegado</h2>
          <p className="text-gray-500 mb-4">
            Esta sección está reservada para administradores del sistema.
          </p>
          <p className="text-sm text-gray-400">
            Tu email: {currentUserEmail || 'No identificado'}
          </p>
        </UiCard>
      </div>
    )
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <Shield className="text-primary" size={32} />
            Panel de Administración
          </h1>
          <p className="page-subtitle">Control total del sistema - Super Admin</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <UiCard className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
              <Users size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold">--</p>
              <p className="text-sm text-gray-500">Usuarios Registrados</p>
            </div>
          </div>
        </UiCard>

        <UiCard className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 text-purple-600 rounded-lg">
              <Building size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold">--</p>
              <p className="text-sm text-gray-500">Organizaciones</p>
            </div>
          </div>
        </UiCard>

        <UiCard className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-100 text-red-600 rounded-lg">
              <UserX size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold">--</p>
              <p className="text-sm text-gray-500">Usuarios Suspendidos</p>
            </div>
          </div>
        </UiCard>
      </div>

      {/* Users Management Section */}
      <UiCard>
        <div className="p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Users size={20} />
            Gestión de Usuarios
          </h3>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-yellow-800 text-sm">
              <strong>⚠️ Nota:</strong> Para ver la lista de usuarios, necesitas crear la tabla <code>profiles</code> 
              en Supabase con una política RLS que permita a super admins ver todos los perfiles.
            </p>
          </div>

          <p className="text-gray-500 text-center py-8">
            La gestión de usuarios estará disponible cuando se configure la tabla de perfiles.
          </p>
        </div>
      </UiCard>
    </div>
  )
}
