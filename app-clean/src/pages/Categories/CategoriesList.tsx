import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { fetchCategories, type Category } from '../../services/movementService'
import { getTextColorClass, getCategoryPillStyle, getDefaultCategoryColor } from '../../utils/categoryColors'
import { Plus, Edit2, X, Tag } from 'lucide-react'
import { UiSelect } from '../../components/ui/UiSelect'
import { UiField } from '../../components/ui/UiField'
import { UiCard, UiCardBody } from '../../components/ui/UiCard'
import { UiInput } from '../../components/ui/UiInput'
import { UiModal, UiModalHeader, UiModalBody, UiModalFooter } from '../../components/ui/UiModal'

export default function CategoriesList() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [kind, setKind] = useState<string>('expense')
  const [color, setColor] = useState('#818cf8')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      const data = await fetchCategories(user.id)
      setCategories(data)
    } catch (error) {
      console.error('Error loading categories:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenCreate = () => {
    setEditingCategory(null)
    setName('')
    setKind('expense')
    setColor(getDefaultCategoryColor(categories.length))
    setShowModal(true)
  }

  const handleOpenEdit = (category: Category) => {
    setEditingCategory(category)
    setName(category.name)
    setKind(category.kind as 'income' | 'expense')
    setColor(category.color || getDefaultCategoryColor(categories.findIndex(c => c.id === category.id)))
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      if (editingCategory) {
        // Update existing
        const { error } = await supabase
          .from('categories')
          .update({ name, kind, color })
          .eq('id', editingCategory.id)

        if (error) throw error
      } else {
        // Create new
        const { error } = await supabase
          .from('categories')
          .insert([{ user_id: user.id, name, kind, color }])

        if (error) throw error
      }

      setShowModal(false)
      loadCategories()
    } catch (error) {
      console.error('Error saving category:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (categoryId: string) => {
    if (!confirm('¿Eliminar esta categoría?')) return

    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId)

      if (error) throw error
      loadCategories()
    } catch (error) {
      console.error('Error deleting category:', error)
    }
  }

  if (loading) {
     return (
       <div className="d-flex items-center justify-center" style={{ minHeight: '200px' }}>
         <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Categorías</h1>
          <p className="page-subtitle">Organiza tus movimientos por categorías con colores</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenCreate}>
          <Plus size={20} />
          Nueva categoría
        </button>
      </div>

      {/* Categories Grid */}
      {categories.length === 0 ? (
        <UiCard className="p-8 d-flex flex-col items-center justify-center text-center">
          <div className="mb-4 text-secondary opacity-50">
            <Tag size={48} />
          </div>
          <p className="text-secondary mb-4">No tienes categorías creadas</p>
          <button className="btn btn-primary" onClick={handleOpenCreate}>
            Crear primera categoría
          </button>
        </UiCard>
      ) : (
        <UiCard>
            <UiCardBody noPadding>
                <div className="table-container">
                    <table className="table w-full">
                        <thead>
                        <tr>
                            <th>Color</th>
                            <th>Nombre</th>
                            <th>Tipo</th>
                            <th style={{ textAlign: 'right' }}>Acciones</th>
                        </tr>
                        </thead>
                        <tbody>
                        {categories.map((cat) => (
                            <tr key={cat.id}>
                            <td style={{ width: '100px' }}>
                                <span
                                className={`px-2 py-1 rounded text-xs font-bold ${getTextColorClass(cat.color)}`}
                                style={getCategoryPillStyle(cat.color)}
                                >
                                {cat.name.slice(0, 2).toUpperCase()}
                                </span>
                            </td>
                            <td style={{ fontWeight: 500 }}>{cat.name}</td>
                            <td>
                                <span className={`badge ${cat.kind === 'income' ? 'badge-success' : 'badge-danger'}`}>
                                {cat.kind === 'income' ? 'Ingreso' : 'Gasto'}
                                </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                                <button className="btn btn-icon btn-secondary" onClick={() => handleOpenEdit(cat)} title="Editar">
                                <Edit2 size={16} />
                                </button>
                            </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            </UiCardBody>
        </UiCard>
      )}

      {/* Create/Edit Modal */}
      <UiModal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)}
        title={editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
        width="400px"
      >
        <form onSubmit={handleSubmit}>
          <UiModalBody>
            <div className="form-group">
              <UiInput
                label="Nombre"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Comida, Transporte..."
                required
              />
            </div>

            <div className="form-group">
              <UiField label="Tipo">
                <UiSelect
                  value={kind}
                  onChange={(val) => setKind(val)}
                  options={[
                      { value: 'expense', label: 'Gasto' },
                      { value: 'income', label: 'Ingreso' }
                  ]}
                />
              </UiField>
            </div>

            <div className="form-group">
              <label className="label">Color</label>
              <div className="relative d-flex items-center gap-2 border border-gray-200 rounded p-2">
                <div
                  className="w-8 h-8 rounded-full border border-gray-100 cursor-pointer shadow-sm transistion-transform hover:scale-105"
                  style={{ backgroundColor: color }}
                  onClick={() => document.getElementById('color-input')?.click()}
                />
                <input
                  id="color-input"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="absolute opacity-0 w-0 h-0"
                />
                 <span
                   className={`px-2 py-1 rounded text-xs font-bold transition-all ${getTextColorClass(color)}`}
                   style={getCategoryPillStyle(color)}
                 >
                   Vista previa
                 </span>
              </div>
            </div>
          </UiModalBody>
          <UiModalFooter>
             <div style={{ flex: 1 }}>
                {editingCategory && (
                <button
                    type="button"
                    className="btn btn-ghost text-danger"
                    onClick={() => {
                        if (confirm('¿Seguro que quieres eliminar esta categoría?')) {
                            handleDelete(editingCategory.id)
                            setShowModal(false)
                        }
                    }}
                >
                    Eliminar
                </button>
                )}
            </div>
            <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Guardando...' : 'Guardar'}
            </button>
          </UiModalFooter>
        </form>
      </UiModal>
    </div>
  )
}
