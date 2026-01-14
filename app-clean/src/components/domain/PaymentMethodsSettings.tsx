import { useState, useEffect } from 'react'
import { Plus, Trash2, Edit2, Check, Star, GripVertical, CreditCard } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { 
  getPaymentMethods, 
  createPaymentMethod, 
  updatePaymentMethod, 
  deletePaymentMethod, 
  setDefaultPaymentMethod,
  type PaymentMethod 
} from '../../services/paymentMethodService'
import { UiModal, UiModalHeader, UiModalBody, UiModalFooter } from '../ui/UiModal'
import { UiInput } from '../ui/UiInput'
import { UiField } from '../ui/UiField'
import { useToast } from '../Toast'

export function PaymentMethodsSettings() {
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null)
  
  // Form State
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const toast = useToast()

  useEffect(() => {
    loadMethods()
  }, [])

  async function loadMethods() {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      const data = await getPaymentMethods(user.id)
      setMethods(data)
    } catch (error) {
      console.error('Error loading payment methods:', error)
      toast.error('Error', 'No se pudieron cargar los métodos de pago')
    } finally {
      setLoading(false)
    }
  }

  function handleOpenModal(method?: PaymentMethod) {
    if (method) {
      setEditingMethod(method)
      setName(method.name)
    } else {
      setEditingMethod(null)
      setName('')
    }
    setShowModal(true)
  }

  async function handleSave() {
    if (!name.trim()) return

    try {
      setSaving(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      if (editingMethod) {
        await updatePaymentMethod(editingMethod.id, { name })
        toast.success('Actualizado', 'Método de pago actualizado')
      } else {
        await createPaymentMethod(user.id, name)
        toast.success('Creado', 'Nuevo método de pago añadido')
      }
      
      await loadMethods()
      setShowModal(false)
    } catch (error) {
      console.error('Error saving payment method:', error)
      toast.error('Error', 'No se pudo guardar el cambio')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Estás seguro de eliminar este método de pago?')) return

    try {
      const success = await deletePaymentMethod(id)
      if (success) {
        toast.success('Eliminado', 'Método de pago eliminado')
        loadMethods()
      } else {
         toast.error('Error', 'No se pudo eliminar (quizás está en uso)')
      }
    } catch (error) {
       console.error('Error deleting:', error)
    }
  }

  async function handleSetDefault(id: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      await setDefaultPaymentMethod(user.id, id)
      loadMethods()
      toast.success('Actualizado', 'Método por defecto cambiado')
    } catch (error) {
      console.error('Error setting default:', error)
    }
  }

  if (loading) return <div className="p-4 text-center text-gray-500">Cargando métodos...</div>

  return (
    <div className="space-y-3">
      {methods.map((method) => (
        <div 
          key={method.id} 
          className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-gray-100 dark:border-gray-700 rounded-xl group hover:border-primary/30 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className={`
              w-8 h-8 rounded-full flex items-center justify-center
              ${method.is_default ? 'bg-primary/10 text-primary' : 'bg-gray-100 dark:bg-slate-700 text-gray-500'}
            `}>
              {method.is_default ? <Star size={14} fill="currentColor" /> : <CreditCard size={14} />}
            </div>
            
            <div>
              <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                  {method.name}
                  {method.is_default && <span className="ml-2 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Default</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {!method.is_default && (
               <button 
                 onClick={() => handleSetDefault(method.id)}
                 className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                 title="Marcar como por defecto"
               >
                 <Star size={14} />
               </button>
            )}
            
            <button 
               onClick={() => handleOpenModal(method)}
               className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors"
               title="Editar"
            >
               <Edit2 size={14} />
            </button>
            
            <button 
               onClick={() => handleDelete(method.id)}
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
        Añadir método de pago
      </button>

      {/* Modal */}
      <UiModal isOpen={showModal} onClose={() => setShowModal(false)} width="400px">
        <UiModalHeader>
          {editingMethod ? 'Editar método' : 'Nuevo método de pago'}
        </UiModalHeader>
        <UiModalBody>
          <UiInput 
            label="Nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Tarjeta Restaurante"
            autoFocus
          />
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
    </div>
  )
}
