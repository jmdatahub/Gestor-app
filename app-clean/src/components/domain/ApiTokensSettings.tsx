/**
 * API Tokens Settings - Native CSS Only
 */
import { useState, useEffect } from 'react'
import { Plus, Trash2, Copy, Check, AlertTriangle } from 'lucide-react'
import { getApiTokens, createApiToken, revokeApiToken, type ApiToken } from '../../services/apiTokenService'
import { useToast } from '../Toast'
import { supabase } from '../../lib/supabaseClient'
import { UiInput } from '../ui/UiInput'
import { UiModal, UiModalHeader, UiModalBody, UiModalFooter } from '../ui/UiModal'

// Separate component for each token row (allows useState per row)
function TokenRow({ token, onRevoke }: { token: ApiToken; onRevoke: (id: string) => void }) {
  const [isHovering, setIsHovering] = useState(false)

  return (
    <div 
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        padding: '8px 12px',
        marginBottom: '4px',
        borderRadius: 'var(--radius-sm)',
        background: isHovering ? 'var(--danger-soft)' : 'transparent',
        border: isHovering ? '1px solid var(--danger)' : '1px solid var(--border-color)',
        transition: 'all 0.2s ease',
        cursor: isHovering ? 'pointer' : 'default'
      }}
      onClick={() => isHovering && onRevoke(token.id)}
    >
      <span style={{ 
        fontSize: '0.9rem',
        color: isHovering ? 'var(--danger)' : 'inherit',
        transition: 'color 0.2s ease'
      }}>
        {isHovering ? `Eliminar "${token.name}"` : token.name}
      </span>
      <button
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onClick={(e) => {
          e.stopPropagation()
          onRevoke(token.id)
        }}
        style={{ 
          padding: '4px 8px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: isHovering ? 'var(--danger)' : 'var(--text-muted)',
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          alignItems: 'center',
          transition: 'color 0.2s ease'
        }}
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}

export function ApiTokensSettings() {
  const toast = useToast()
  const [tokens, setTokens] = useState<ApiToken[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newTokenName, setNewTokenName] = useState('')
  const [creating, setCreating] = useState(false)
  const [newlyCreatedToken, setNewlyCreatedToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => { loadTokens() }, [])

  const loadTokens = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    try {
      const data = await getApiTokens(user.id)
      setTokens(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!newTokenName.trim()) return
    setCreating(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    try {
      const { token, record } = await createApiToken(user.id, newTokenName.trim())
      setTokens(prev => [record, ...prev])
      setNewlyCreatedToken(token)
      setNewTokenName('')
    } catch (err) {
      toast.error('Error', 'No se pudo crear')
    } finally {
      setCreating(false)
    }
  }

  const handleRevoke = async (tokenId: string) => {
    try {
      await revokeApiToken(tokenId)
      setTokens(prev => prev.filter(t => t.id !== tokenId))
    } catch (err) {
      console.error(err)
    }
  }

  const handleCopy = () => {
    if (newlyCreatedToken) {
      navigator.clipboard.writeText(newlyCreatedToken)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const closeModal = () => {
    setShowCreateModal(false)
    setNewlyCreatedToken(null)
    setCopied(false)
    setNewTokenName('')
  }

  if (loading) return null

  return (
    <>
      {tokens.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          {tokens.map(token => (
            <TokenRow key={token.id} token={token} onRevoke={handleRevoke} />
          ))}
        </div>
      )}

      <button
        className="btn btn-secondary"
        style={{ width: '100%' }}
        onClick={() => setShowCreateModal(true)}
      >
        <Plus size={16} />
        {tokens.length === 0 ? 'Crear token' : 'Nuevo token'}
      </button>

      <UiModal isOpen={showCreateModal} onClose={closeModal}>
        <UiModalHeader>{newlyCreatedToken ? 'Token creado' : 'Nuevo token'}</UiModalHeader>
        <UiModalBody>
          {newlyCreatedToken ? (
            <div>
              <div style={{ 
                display: 'flex', 
                gap: '8px', 
                padding: '8px 12px', 
                background: 'var(--warning-soft)', 
                borderRadius: 'var(--radius-sm)',
                marginBottom: '12px',
                fontSize: '0.8rem',
                color: 'var(--warning)'
              }}>
                <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                <span>Copia este token. No se mostrará de nuevo.</span>
              </div>
              <div style={{ position: 'relative' }}>
                <code style={{ 
                  display: 'block',
                  padding: '12px',
                  background: '#1a1a2e',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.75rem',
                  color: '#22C55E',
                  wordBreak: 'break-all',
                  paddingRight: '40px'
                }}>
                  {newlyCreatedToken}
                </code>
                <button 
                  onClick={handleCopy}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                >
                  {copied ? <Check size={14} color="#22C55E" /> : <Copy size={14} color="#64748B" />}
                </button>
              </div>
            </div>
          ) : (
            <UiInput
              label="Nombre"
              value={newTokenName}
              onChange={(e) => setNewTokenName(e.target.value)}
              placeholder="Ej: Script Excel"
              autoFocus
            />
          )}
        </UiModalBody>
        <UiModalFooter>
          {newlyCreatedToken ? (
            <button className="btn btn-primary" onClick={closeModal}>Listo</button>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={creating || !newTokenName.trim()}>
                Crear
              </button>
            </>
          )}
        </UiModalFooter>
      </UiModal>
    </>
  )
}
