/**
 * API Tokens Settings Component
 * Allows users to manage their API tokens
 */
import { useState, useEffect } from 'react'
import { Key, Plus, Trash2, Copy, Check, AlertTriangle, Clock } from 'lucide-react'
import { getApiTokens, createApiToken, revokeApiToken, type ApiToken } from '../../services/apiTokenService'
import { useToast } from '../Toast'
import { supabase } from '../../lib/supabaseClient'
import { UiInput } from '../ui/UiInput'
import { UiModal, UiModalHeader, UiModalBody, UiModalFooter } from '../ui/UiModal'

export function ApiTokensSettings() {
  const toast = useToast()
  const [tokens, setTokens] = useState<ApiToken[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newTokenName, setNewTokenName] = useState('')
  const [creating, setCreating] = useState(false)
  
  // State for showing the newly created token (only once)
  const [newlyCreatedToken, setNewlyCreatedToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    loadTokens()
  }, [])

  const loadTokens = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      const data = await getApiTokens(user.id)
      setTokens(data)
    } catch (err) {
      console.error('Error loading tokens:', err)
      toast.error('Error', 'No se pudieron cargar los tokens')
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
      // Don't close modal yet - show the token first
    } catch (err) {
      console.error('Error creating token:', err)
      toast.error('Error', 'No se pudo crear el token')
    } finally {
      setCreating(false)
    }
  }

  const handleRevoke = async (tokenId: string, tokenName: string) => {
    if (!confirm(`¿Estás seguro de revocar el token "${tokenName}"? Esta acción no se puede deshacer.`)) {
      return
    }

    try {
      await revokeApiToken(tokenId)
      setTokens(prev => prev.filter(t => t.id !== tokenId))
      toast.success('Token revocado', `"${tokenName}" ha sido eliminado`)
    } catch (err) {
      console.error('Error revoking token:', err)
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

  const closeCreateModal = () => {
    setShowCreateModal(false)
    setNewlyCreatedToken(null)
    setCopied(false)
    setNewTokenName('')
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Nunca'
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Key size={20} className="text-primary" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Tokens de API</h3>
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus size={16} />
          Nuevo Token
        </button>
      </div>

      {/* Info Banner */}
      <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-lg text-sm text-blue-700 dark:text-blue-300">
        Los tokens te permiten acceder a la API desde scripts externos (Python, cURL, etc.). Guarda el token en un lugar seguro, solo se muestra una vez.
      </div>

      {/* Token List */}
      {tokens.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Key size={32} className="mx-auto mb-2 opacity-50" />
          <p>No tienes tokens creados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tokens.map(token => (
            <div
              key={token.id}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-100 dark:border-gray-700"
            >
              <div className="flex-1">
                <div className="font-medium text-gray-900 dark:text-white">{token.name}</div>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    Último uso: {formatDate(token.last_used_at)}
                  </span>
                  <span>Creado: {formatDate(token.created_at)}</span>
                </div>
              </div>
              <button
                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                onClick={() => handleRevoke(token.id, token.name)}
                title="Revocar token"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <UiModal isOpen={showCreateModal} onClose={closeCreateModal}>
        <UiModalHeader>
          {newlyCreatedToken ? '🔐 Token Creado' : 'Nuevo Token de API'}
        </UiModalHeader>
        <UiModalBody>
          {newlyCreatedToken ? (
            <div className="space-y-4">
              {/* Warning */}
              <div className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <AlertTriangle className="text-yellow-600 shrink-0 mt-0.5" size={20} />
                <div className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>¡Importante!</strong> Copia este token ahora. No podrás volver a verlo después de cerrar esta ventana.
                </div>
              </div>

              {/* Token Display */}
              <div className="relative">
                <div className="p-3 bg-gray-900 rounded-lg font-mono text-sm text-green-400 break-all pr-12">
                  {newlyCreatedToken}
                </div>
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-700 rounded transition-colors"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check size={18} className="text-green-400" />
                  ) : (
                    <Copy size={18} className="text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          ) : (
            <UiInput
              label="Nombre del token"
              value={newTokenName}
              onChange={(e) => setNewTokenName(e.target.value)}
              placeholder="Ej: Script Python Import"
              autoFocus
            />
          )}
        </UiModalBody>
        <UiModalFooter>
          {newlyCreatedToken ? (
            <button
              className="btn btn-primary"
              onClick={closeCreateModal}
            >
              He copiado el token
            </button>
          ) : (
            <>
              <button
                className="btn btn-secondary"
                onClick={closeCreateModal}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreate}
                disabled={creating || !newTokenName.trim()}
              >
                {creating ? 'Creando...' : 'Crear Token'}
              </button>
            </>
          )}
        </UiModalFooter>
      </UiModal>
    </div>
  )
}
