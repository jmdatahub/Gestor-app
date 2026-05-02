import { useState, useEffect } from 'react'
import { Plus, Trash2, Edit2, Store, AlertTriangle } from 'lucide-react'
import {
  fetchAllProviders,
  createProvider,
  type Provider,
} from '../../services/providerService'
import { api } from '../../lib/apiClient'
import { UiModal, UiModalHeader, UiModalBody, UiModalFooter } from '../ui/UiModal'
import { UiInput } from '../ui/UiInput'
import { useToast } from '../Toast'

export function ProvidersSettings() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [saving, setSaving] = useState(false)

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<Provider | null>(null)
  const [deleting, setDeleting] = useState(false)

  const toast = useToast()

  useEffect(() => {
    loadProviders()
  }, [])

  async function loadProviders() {
    try {
      setLoading(true)
      const data = await fetchAllProviders('')
      setProviders(data)
    } catch (error) {
      console.error('Error loading providers:', error)
      toast.error('Error', 'No se pudieron cargar los proveedores')
    } finally {
      setLoading(false)
    }
  }

  function handleOpenModal(provider?: Provider) {
    if (provider) {
      setEditingProvider(provider)
      setName(provider.name)
      setCategory(provider.category ?? '')
    } else {
      setEditingProvider(null)
      setName('')
      setCategory('')
    }
    setShowModal(true)
  }

  async function handleSave() {
    if (!name.trim()) return
    try {
      setSaving(true)
      if (editingProvider) {
        await api.patch(`/api/v1/providers/${editingProvider.id}`, {
          name: name.trim(),
          category: category.trim() || null,
        })
        toast.success('Actualizado', 'Proveedor actualizado')
      } else {
        await createProvider(name.trim(), category.trim() || undefined)
        toast.success('Creado', 'Nuevo proveedor añadido')
      }
      await loadProviders()
      setShowModal(false)
    } catch (error) {
      console.error('Error saving provider:', error)
      toast.error('Error', 'No se pudo guardar el proveedor')
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      await api.delete(`/api/v1/providers/${deleteTarget.id}`)
      toast.success('Eliminado', 'Proveedor eliminado')
      setDeleteTarget(null)
      loadProviders()
    } catch (error) {
      console.error('Error deleting provider:', error)
      toast.error('Error', 'No se pudo eliminar el proveedor')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <div className="p-4 text-center text-gray-500">Cargando proveedores...</div>

  return (
    <div className="space-y-3">
      {/* Empty state */}
      {providers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-center text-gray-400 dark:text-gray-500">
          <Store size={36} className="mb-3 opacity-40" />
          <p className="text-sm font-medium">Sin proveedores</p>
          <p className="text-xs mt-1">Añade proveedores para asignarlos a tus movimientos</p>
        </div>
      )}

      {providers.map((provider) => (
        <div
          key={provider.id}
          className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-gray-100 dark:border-gray-700 rounded-xl group hover:border-primary/30 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 dark:bg-slate-700 text-gray-500">
              <Store size={14} />
            </div>

            <div>
              <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                {provider.name}
              </div>
              {provider.category && (
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{provider.category}</div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => handleOpenModal(provider)}
              className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors"
              title="Editar"
            >
              <Edit2 size={14} />
            </button>

            <button
              onClick={() => setDeleteTarget(provider)}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
              title="Eliminar"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}

      <button
        onClick={() => handleOpenModal()}
        className="w-full py-2 flex items-center justify-center gap-2 text-primary bg-primary/5 hover:bg-primary/10 border border-dashed border-primary/20 rounded-xl transition-all font-medium text-sm"
      >
        <Plus size={16} />
        Añadir proveedor
      </button>

      {/* Create / Edit modal */}
      <UiModal isOpen={showModal} onClose={() => setShowModal(false)} width="400px">
        <UiModalHeader>
          {editingProvider ? 'Editar proveedor' : 'Nuevo proveedor'}
        </UiModalHeader>
        <UiModalBody>
          <div className="space-y-4">
            <UiInput
              label="Nombre *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Mercadona"
              autoFocus
            />
            <UiInput
              label="Categoría (opcional)"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Ej. Alimentación"
            />
          </div>
        </UiModalBody>
        <UiModalFooter>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!name.trim() || saving}
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </UiModalFooter>
      </UiModal>

      {/* Delete confirmation modal */}
      <UiModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} width="400px">
        <UiModalHeader>Eliminar proveedor</UiModalHeader>
        <UiModalBody>
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-gray-700 dark:text-gray-300">
              ¿Eliminar <strong>{deleteTarget?.name}</strong>? Esta acción no se puede deshacer.
            </p>
          </div>
        </UiModalBody>
        <UiModalFooter>
          <button
            className="btn btn-secondary"
            onClick={() => setDeleteTarget(null)}
            disabled={deleting}
          >
            Cancelar
          </button>
          <button
            className="btn btn-danger"
            onClick={handleConfirmDelete}
            disabled={deleting}
          >
            {deleting ? 'Eliminando...' : 'Eliminar'}
          </button>
        </UiModalFooter>
      </UiModal>
    </div>
  )
}
