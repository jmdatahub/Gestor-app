import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { 
  getMyPendingInvitations, 
  acceptInvitation, 
  declineInvitation,
  type PendingInvitation 
} from '../../services/organizationService'
import { Mail, Check, X, Building2, Clock } from 'lucide-react'

interface PendingInvitationsProps {
  userEmail: string | null
  userId: string | null
  onInvitationAccepted?: () => void
}

export function PendingInvitations({ userEmail, userId, onInvitationAccepted }: PendingInvitationsProps) {
  const [invitations, setInvitations] = useState<PendingInvitation[]>([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    if (userEmail) {
      loadInvitations()
    }
  }, [userEmail])

  const loadInvitations = async () => {
    if (!userEmail) return
    setLoading(true)
    try {
      const data = await getMyPendingInvitations(userEmail)
      setInvitations(data)
    } catch (error) {
      console.error('Error loading invitations:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async (invitationId: string) => {
    if (!userId) return
    setActionLoading(invitationId)
    try {
      await acceptInvitation(invitationId, userId)
      // Reload invitations
      await loadInvitations()
      onInvitationAccepted?.()
      // Trigger global refresh (AppLayout)
      window.dispatchEvent(new Event('refreshInvitations'))
    } catch (error: any) {
      console.error('Error accepting invitation:', error)
      alert(error.message || 'Error al aceptar la invitación')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDecline = async (invitationId: string) => {
    if (!confirm('¿Rechazar esta invitación?')) return
    setActionLoading(invitationId)
    try {
      await declineInvitation(invitationId)
      await loadInvitations()
      window.dispatchEvent(new Event('refreshInvitations'))
    } catch (error: any) {
      console.error('Error declining invitation:', error)
      alert(error.message || 'Error al rechazar la invitación')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return null // Don't show loading state - will show when ready
  }

  if (invitations.length === 0) {
    return null // Don't render anything if no invitations
  }

  return (
    <div style={{
      marginBottom: '1.5rem',
      padding: '1rem',
      background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(99, 102, 241, 0.1) 100%)',
      border: '1px solid rgba(139, 92, 246, 0.3)',
      borderRadius: '16px'
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '0.5rem', 
        marginBottom: '0.75rem' 
      }}>
        <Mail size={18} style={{ color: '#8B5CF6' }} />
        <h4 style={{ 
          margin: 0, 
          fontSize: '0.9rem', 
          fontWeight: 600, 
          color: 'var(--text-primary)' 
        }}>
          Invitaciones Pendientes ({invitations.length})
        </h4>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {invitations.map(inv => (
          <div 
            key={inv.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1rem',
              borderRadius: '12px',
              background: 'var(--card-bg)',
              border: '1px solid var(--border-color)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white'
              }}>
                <Building2 size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                  {inv.organization?.name || 'Organización'}
                </div>
                <div style={{ 
                  fontSize: '0.75rem', 
                  color: 'var(--text-muted)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.375rem' 
                }}>
                  <span style={{
                    padding: '0.125rem 0.5rem',
                    borderRadius: '8px',
                    background: 'rgba(139, 92, 246, 0.1)',
                    color: '#8B5CF6',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    textTransform: 'uppercase'
                  }}>
                    {inv.role}
                  </span>
                  <Clock size={10} />
                  {new Date(inv.created_at).toLocaleDateString('es-ES')}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => handleAccept(inv.id)}
                disabled={actionLoading === inv.id}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  color: 'white',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: actionLoading === inv.id ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  opacity: actionLoading === inv.id ? 0.7 : 1
                }}
              >
                <Check size={14} />
                Aceptar
              </button>
              <button
                onClick={() => handleDecline(inv.id)}
                disabled={actionLoading === inv.id}
                style={{
                  padding: '0.5rem',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  color: '#EF4444',
                  cursor: actionLoading === inv.id ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  opacity: actionLoading === inv.id ? 0.7 : 1
                }}
                title="Rechazar invitación"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
