import { useState, useEffect, useMemo } from 'react'
import { api } from '../../lib/apiClient'
import { useAuth } from '../../context/AuthContext'
import { useWorkspace } from '../../context/WorkspaceContext'
import { fetchCategories, type Category } from '../../services/movementService'
import { getTextColorClass, getCategoryPillStyle, getDefaultCategoryColor } from '../../utils/categoryColors'
import { Plus, Edit2, Tag, TrendingUp, TrendingDown } from 'lucide-react'
import { UiSelect } from '../../components/ui/UiSelect'
import { UiField } from '../../components/ui/UiField'
import { UiInput } from '../../components/ui/UiInput'
import { UiModal, UiModalBody, UiModalFooter } from '../../components/ui/UiModal'
import { Panel } from '../../components/shared/Panel'
import { EmptyState } from '../../components/shared/EmptyState'
import { StatCard } from '../../components/shared/StatCard'

export default function CategoriesList() {
  const { user } = useAuth()
  const { currentWorkspace } = useWorkspace()  // Add workspace context
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [kind, setKind] = useState<string>('expense')
  const [color, setColor] = useState('#818cf8')
  const [submitting, setSubmitting] = useState(false)

  // Reload when workspace changes
  useEffect(() => {
    loadCategories()
  }, [currentWorkspace])

  const loadCategories = async () => {
    if (!user) return

    try {
      const orgId = currentWorkspace?.id || null
      const data = await fetchCategories(user.id, orgId)
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

    if (!user) return

    try {
      if (editingCategory) {
        // Update existing
        await api.patch('/api/v1/categories/' + editingCategory.id, { name, kind, color })
      } else {
        // Create new
        const orgId = currentWorkspace?.id || null
        await api.post('/api/v1/categories', { name, kind, color, organizationId: orgId })
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
      await api.delete('/api/v1/categories/' + categoryId)
      loadCategories()
    } catch (error) {
      console.error('Error deleting category:', error)
    }
  }

  const { expenseCategories, incomeCategories } = useMemo(() => ({
    expenseCategories: categories.filter(c => c.kind === 'expense'),
    incomeCategories: categories.filter(c => c.kind === 'income'),
  }), [categories])

  const renderCategoryRow = (cat: Category) => (
    <div key={cat.id} className="cat-row">
      <span
        className={`px-2 py-1 rounded text-xs font-bold ${getTextColorClass(cat.color)}`}
        style={{ ...getCategoryPillStyle(cat.color), minWidth: 40, textAlign: 'center' }}
      >
        {cat.name.slice(0, 2).toUpperCase()}
      </span>
      <span className="cat-row__name">{cat.name}</span>
      <button
        className="btn btn-icon btn-secondary"
        onClick={() => handleOpenEdit(cat)}
        title="Editar"
        style={{ padding: 6 }}
      >
        <Edit2 size={14} />
      </button>
    </div>
  )

  return (
    <div className="page-container fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Categorías</h1>
          <p className="page-subtitle">Organiza tus movimientos por categorías con colores</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenCreate}>
          <Plus size={18} />
          <span style={{ marginLeft: 6 }}>Nueva categoría</span>
        </button>
      </div>

      {!loading && categories.length > 0 && (
        <div className="stat-grid mb-4">
          <StatCard
            label="Categorías totales"
            value={categories.length}
            tone="primary"
            icon={<Tag size={18} />}
          />
          <StatCard
            label="Gastos"
            value={expenseCategories.length}
            tone="danger"
            icon={<TrendingDown size={18} />}
          />
          <StatCard
            label="Ingresos"
            value={incomeCategories.length}
            tone="success"
            icon={<TrendingUp size={18} />}
          />
        </div>
      )}

      {loading ? (
        <div className="d-flex items-center justify-center" style={{ minHeight: 200 }}>
          <div className="spinner" />
        </div>
      ) : categories.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<Tag size={32} />}
            title="Sin categorías"
            description="Crea tu primera categoría para empezar a organizar tus movimientos."
            action={
              <button className="btn btn-primary" onClick={handleOpenCreate}>
                <Plus size={16} />
                <span style={{ marginLeft: 6 }}>Crear categoría</span>
              </button>
            }
          />
        </Panel>
      ) : (
        <div className="dash-grid">
          <div className="col-6">
            <Panel title="Gastos" subtitle={`${expenseCategories.length} categorías`} icon={<TrendingDown size={16} />}>
              {expenseCategories.length === 0 ? (
                <EmptyState compact title="Sin categorías de gasto" />
              ) : (
                <div>{expenseCategories.map(renderCategoryRow)}</div>
              )}
            </Panel>
          </div>
          <div className="col-6">
            <Panel title="Ingresos" subtitle={`${incomeCategories.length} categorías`} icon={<TrendingUp size={16} />}>
              {incomeCategories.length === 0 ? (
                <EmptyState compact title="Sin categorías de ingreso" />
              ) : (
                <div>{incomeCategories.map(renderCategoryRow)}</div>
              )}
            </Panel>
          </div>
        </div>
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
