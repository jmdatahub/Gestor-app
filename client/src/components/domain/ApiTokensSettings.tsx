/**
 * API Tokens Settings - Native CSS Only
 * Now supports v2 tokens: Workspaces and Granular Scopes
 */
import { useState, useEffect } from 'react'
import { Plus, Trash2, Copy, Check, AlertTriangle, Shield, CheckSquare, Square, Building2 } from 'lucide-react'
import { getApiTokens, createApiToken, revokeApiToken, type ApiToken, API_SCOPES, ApiScope, DEFAULT_SCOPES } from '../../services/apiTokenService'
import { useToast } from '../Toast'
import { useAuth } from '../../context/AuthContext'
import { UiInput } from '../ui/UiInput'
import { UiModal, UiModalHeader, UiModalBody, UiModalFooter } from '../ui/UiModal'
import { useWorkspace } from '../../context/WorkspaceContext'

function TokenRow({ token, onRevoke }: { token: ApiToken; onRevoke: (id: string) => void }) {
  const [isHovering, setIsHovering] = useState(false)

  // Determine what type of token it is
  const workspaceLabel = token.organization ? `Workspace: ${token.organization.name}` : 'Datos Locales (Personal)'

  return (
    <div 
      style={{ 
        display: 'flex', 
        alignItems: 'flex-start', 
        justifyContent: 'space-between',
        padding: '12px',
        marginBottom: '8px',
        borderRadius: 'var(--radius-md)',
        background: isHovering ? 'var(--bg-secondary)' : 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span style={{ fontWeight: 500 }}>{token.name}</span>
          <span style={{ 
            fontSize: '0.7rem', 
            padding: '2px 6px', 
            borderRadius: '4px', 
            background: token.organization ? 'var(--primary-soft)' : 'var(--bg-secondary)',
            color: 'var(--text-muted)'
          }}>
            {workspaceLabel}
          </span>
        </div>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
          {token.scopes.slice(0, 3).map(scope => (
            <span key={scope} style={{
              fontSize: '0.65rem',
              padding: '2px 4px',
              borderRadius: '2px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)'
            }}>
              {scope}
            </span>
          ))}
          {token.scopes.length > 3 && (
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
              +{token.scopes.length - 3} más
            </span>
          )}
        </div>
        
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
          Creado: {new Date(token.created_at).toLocaleDateString()}
        </div>
      </div>

      <button
        onClick={() => onRevoke(token.id)}
        className="btn btn-danger"
        style={{ padding: '6px 8px', opacity: isHovering ? 1 : 0.5 }}
        title="Revocar token"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

export function ApiTokensSettings() {
  const toast = useToast()
  const { user } = useAuth()
  const { workspaces } = useWorkspace()
  
  const [tokens, setTokens] = useState<ApiToken[]>([])
  const [loading, setLoading] = useState(true)
  
  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  
  // New Token Form State
  const [newTokenName, setNewTokenName] = useState('')
  const [selectedOrgId, setSelectedOrgId] = useState<string>('') // empty = personal
  const [selectedScopes, setSelectedScopes] = useState<Set<ApiScope>>(new Set(DEFAULT_SCOPES))
  
  // Result State
  const [newlyCreatedToken, setNewlyCreatedToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => { loadTokens() }, [])

  const loadTokens = async () => {
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
    if (selectedScopes.size === 0) {
      toast.error('Error', 'Debes seleccionar al menos un permiso (scope)')
      return
    }
    
    setCreating(true)
    if (!user) return
    
    try {
      const finalOrgId = selectedOrgId === 'global' ? null : (selectedOrgId || null)
      const finalScopes = Array.from(selectedScopes)
      if (selectedOrgId === 'global') {
        finalScopes.push('global:access' as ApiScope) // Add global tag
      }
      
      const { token, record } = await createApiToken(user.id, {
        name: newTokenName.trim(),
        organization_id: finalOrgId,
        scopes: finalScopes
      })
      
      setTokens(prev => [record, ...prev])
      setNewlyCreatedToken(token)
    } catch (err) {
      toast.error('Error', 'No se pudo crear el token')
    } finally {
      setCreating(false)
    }
  }

  const handleRevoke = async (tokenId: string) => {
    try {
      await revokeApiToken(tokenId)
      setTokens(prev => prev.filter(t => t.id !== tokenId))
      toast.success('Token revocado', 'El token ya no podrá ser usado')
    } catch (err) {
      console.error(err)
      toast.error('Error', 'No se pudo revocar el token')
    }
  }

  const handleCopy = () => {
    if (newlyCreatedToken) {
      navigator.clipboard.writeText(newlyCreatedToken)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const toggleScope = (scopeId: ApiScope) => {
    const newScopes = new Set(selectedScopes)
    if (newScopes.has(scopeId)) {
      newScopes.delete(scopeId)
    } else {
      newScopes.add(scopeId)
    }
    setSelectedScopes(newScopes)
  }

  const resetForm = () => {
    setShowCreateModal(false)
    setNewlyCreatedToken(null)
    setCopied(false)
    setNewTokenName('')
    setSelectedOrgId('')
    setSelectedScopes(new Set(DEFAULT_SCOPES))
  }

  // Group scopes by their 'group' property for UI
  const scopesByGroup = API_SCOPES.reduce((acc, scope) => {
    if (!acc[scope.group]) acc[scope.group] = []
    acc[scope.group].push(scope)
    return acc
  }, {} as Record<string, typeof API_SCOPES[number][]>)

  if (loading) return null

  return (
    <>
      {tokens.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          {tokens.map(token => (
            <TokenRow key={token.id} token={token} onRevoke={handleRevoke} />
          ))}
        </div>
      )}

      <button
        className="btn btn-secondary"
        style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
        onClick={() => setShowCreateModal(true)}
      >
        <Plus size={16} style={{ marginRight: '8px' }} />
        {tokens.length === 0 ? 'Crear primer token de API' : 'Nuevo token'}
      </button>

      <UiModal isOpen={showCreateModal} onClose={resetForm}>
        <UiModalHeader>{newlyCreatedToken ? 'Token creado con éxito' : 'Crear nuevo Token API'}</UiModalHeader>
        <UiModalBody>
          {newlyCreatedToken ? (
            <div>
              <div style={{ 
                display: 'flex', gap: '8px', padding: '12px', background: 'var(--warning-soft)', 
                borderRadius: 'var(--radius-sm)', marginBottom: '16px', color: 'var(--warning)',
                alignItems: 'flex-start'
              }}>
                <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span style={{ fontSize: '0.85rem', lineHeight: 1.4 }}>
                  Copia este token ahora. <strong>No volverás a verlo</strong>. Si lo pierdes tendrás que revocarlo y crear uno nuevo.
                </span>
              </div>
              <div style={{ position: 'relative' }}>
                <code style={{ 
                  display: 'block', padding: '16px', background: '#1a1a2e', 
                  borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', color: '#22C55E',
                  wordBreak: 'break-all', paddingRight: '48px', border: '1px solid #2e2e48'
                }}>
                  {newlyCreatedToken}
                </code>
                <button 
                  onClick={handleCopy}
                  title="Copiar al portapapeles"
                  style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'var(--bg-secondary)', border: 'none', cursor: 'pointer',
                    padding: '8px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}
                >
                  {copied ? <Check size={16} color="#22C55E" /> : <Copy size={16} color="var(--text-primary)" />}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <UiInput
                label="Nombre del token"
                value={newTokenName}
                onChange={(e) => setNewTokenName(e.target.value)}
                placeholder="Ej: Automatización Make.com"
                autoFocus
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  Workspace (Entorno de trabajo)
                </label>
                <div style={{ position: 'relative' }}>
                  <Building2 size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-muted)' }} />
                  <select 
                    value={selectedOrgId}
                    onChange={(e) => setSelectedOrgId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 36px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    <option value="" style={{ background: '#1a1a2e', color: '#fff' }}>Datos Locales (Solo mis datos personales)</option>
                    <option value="global" style={{ background: '#2c1e16', color: '#f97316', fontWeight: 'bold' }}>🗝️ Acceso Maestro (Todos los Workspaces)</option>
                    <optgroup label="Mis Workspaces" style={{ background: '#131320', color: '#a0a0b0' }}>
                      {workspaces.map(w => (
                        <option key={w.org_id} value={w.org_id} style={{ background: '#1a1a2e', color: '#fff' }}>{w.organization.name}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  El token solo tendrá acceso a los datos del workspace seleccionado.
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '-4px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Shield size={14} /> Permisos (Scopes)
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={() => setSelectedScopes(new Set(API_SCOPES.map(s => s.id)))}
                      style={{ background: 'none', border: 'none', fontSize: '0.7rem', color: 'var(--primary)', cursor: 'pointer', padding: 0 }}
                    >
                      Seleccionar todos
                    </button>
                    <span style={{ color: 'var(--border-color)' }}>|</span>
                    <button 
                      onClick={() => setSelectedScopes(new Set())}
                      style={{ background: 'none', border: 'none', fontSize: '0.7rem', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                    >
                      Ninguno
                    </button>
                  </div>
                </div>
                
                <div style={{ 
                  background: 'var(--bg-secondary)', 
                  padding: '12px', 
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}>
                  {Object.entries(scopesByGroup).map(([group, scopes]) => (
                    <div key={group} style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                        {group}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {scopes.map(scope => {
                          const isSelected = selectedScopes.has(scope.id)
                          return (
                            <div 
                              key={scope.id} 
                              onClick={() => toggleScope(scope.id)}
                              style={{ 
                                display: 'flex', alignItems: 'center', gap: '8px', 
                                padding: '6px 8px', borderRadius: '4px',
                                cursor: 'pointer',
                                background: isSelected ? 'var(--primary-soft)' : 'transparent',
                                transition: 'background 0.2s'
                              }}
                            >
                              {isSelected ? 
                                <CheckSquare size={16} color="var(--primary)" /> : 
                                <Square size={16} color="var(--text-muted)" />
                              }
                              <span style={{ fontSize: '0.8rem', color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                {scope.label}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </UiModalBody>
        <UiModalFooter>
          {newlyCreatedToken ? (
            <button className="btn btn-primary" onClick={resetForm}>He guardado mi token</button>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={resetForm}>Cancelar</button>
              <button 
                className="btn btn-primary" 
                onClick={handleCreate} 
                disabled={creating || !newTokenName.trim() || selectedScopes.size === 0}
              >
                {creating ? 'Creando...' : 'Crear token'}
              </button>
            </>
          )}
        </UiModalFooter>
      </UiModal>
    </>
  )
}
