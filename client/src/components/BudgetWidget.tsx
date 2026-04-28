import { useState, useEffect } from 'react'
import { AlertTriangle, Plus, Settings, X, Target, TrendingUp, Sparkles } from 'lucide-react'
import { getMonthlyCategoryBreakdown, type CategorySummary, formatCurrency } from '../services/summaryService'
import { getBudgetsForMonth, setBudget, deleteBudget, getCurrentMonth, type Budget, type BudgetInput } from '../services/budgetService'
import { UiModal, UiModalHeader, UiModalBody, UiModalFooter } from './ui/UiModal'

interface BudgetWidgetProps {
  userId: string
}

interface BudgetProgress {
  categoryName: string
  spent: number
  limit: number
  percentage: number
  isOverBudget: boolean
  remaining: number
}

export function BudgetWidget({ userId }: BudgetWidgetProps) {
  const [categorySpending, setCategorySpending] = useState<CategorySummary[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<string>('')
  const [editingLimit, setEditingLimit] = useState<string>('')
  const [saving, setSaving] = useState(false)

  const currentMonth = getCurrentMonth()
  const monthName = new Date().toLocaleString('es-ES', { month: 'long' })
  const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1)

  useEffect(() => {
    loadData()
  }, [userId])

  const loadData = async () => {
    try {
      const now = new Date()
      const [spending, budgetData] = await Promise.all([
        getMonthlyCategoryBreakdown(userId, now.getFullYear(), now.getMonth() + 1),
        getBudgetsForMonth(userId, currentMonth)
      ])
      setCategorySpending(spending)
      setBudgets(budgetData)
    } catch (error) {
      console.error('Error loading budget data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getProgressItems = (): BudgetProgress[] => {
    return budgets.map(budget => {
      const spending = categorySpending.find(c => c.categoryName === budget.category_name)
      const spent = spending?.total || 0
      const percentage = budget.monthly_limit > 0 ? (spent / budget.monthly_limit) * 100 : 0
      
      return {
        categoryName: budget.category_name,
        spent,
        limit: budget.monthly_limit,
        percentage,
        isOverBudget: spent > budget.monthly_limit,
        remaining: budget.monthly_limit - spent
      }
    }).sort((a, b) => b.percentage - a.percentage)
  }

  const handleSaveBudget = async () => {
    if (!editingCategory || !editingLimit) return
    
    setSaving(true)
    try {
      const input: BudgetInput = {
        user_id: userId,
        category_name: editingCategory,
        monthly_limit: parseFloat(editingLimit),
        month: currentMonth
      }
      
      await setBudget(input)
      await loadData()
      setEditingCategory('')
      setEditingLimit('')
    } catch (error) {
      console.error('Error saving budget:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteBudget = async (categoryName: string) => {
    try {
      await deleteBudget(userId, categoryName, currentMonth)
      await loadData()
    } catch (error) {
      console.error('Error deleting budget:', error)
    }
  }

  const progressItems = getProgressItems()
  const overBudgetCount = progressItems.filter(p => p.isOverBudget).length
  const totalBudget = budgets.reduce((sum, b) => sum + b.monthly_limit, 0)
  const totalSpent = progressItems.reduce((sum, p) => sum + p.spent, 0)
  const overallPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0
  
  const availableCategories = categorySpending.filter(
    c => !budgets.some(b => b.category_name === c.categoryName)
  )

  const getProgressColor = (percentage: number, isOver: boolean) => {
    if (isOver) return 'var(--danger)'
    if (percentage > 80) return 'var(--warning)'
    if (percentage > 50) return '#f59e0b'
    return 'var(--success)'
  }

  if (loading) {
    return (
      <div className="section-card" style={{ padding: '1.5rem' }}>
        <div className="animate-pulse" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ height: '24px', background: 'var(--muted)', borderRadius: '8px', width: '50%' }} />
          <div style={{ height: '60px', background: 'var(--muted)', borderRadius: '12px' }} />
          <div style={{ height: '40px', background: 'var(--muted)', borderRadius: '8px' }} />
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="section-card" style={{ overflow: 'hidden', borderRadius: '16px' }}>
        {/* Header compacto con gradiente */}
        <div style={{
          background: 'linear-gradient(135deg, var(--primary) 0%, #8b5cf6 100%)',
          padding: '0.875rem 1rem',
          color: 'white',
          borderRadius: '16px 16px 0 0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Target size={18} />
              <div>
                <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                  Presupuestos
                </span>
                <span style={{ fontSize: '0.75rem', opacity: 0.85, marginLeft: '0.5rem' }}>
                  {capitalizedMonth}
                </span>
              </div>
            </div>
            <button 
              onClick={() => setShowConfigModal(true)}
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: 'none',
                borderRadius: '6px',
                padding: '0.35rem',
                cursor: 'pointer',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Settings size={14} />
            </button>
          </div>

          {/* Barra de progreso total si hay presupuestos */}
          {budgets.length > 0 && (
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                fontSize: '0.75rem',
                marginBottom: '0.35rem',
                opacity: 0.9
              }}>
                <span>Gastado</span>
                <span>{formatCurrency(totalSpent)} / {formatCurrency(totalBudget)}</span>
              </div>
              <div style={{
                height: '4px',
                background: 'rgba(255,255,255,0.2)',
                borderRadius: '2px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(overallPercentage, 100)}%`,
                  background: overallPercentage > 100 ? '#ef4444' : 'white',
                  borderRadius: '2px',
                  transition: 'width 0.5s ease'
                }} />
              </div>
            </div>
          )}
        </div>

        {/* Contenido */}
        <div style={{ padding: '1rem' }}>
          {progressItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1rem 0.5rem' }}>
              <Sparkles size={24} style={{ color: 'var(--primary)', opacity: 0.6, marginBottom: '0.5rem' }} />
              <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
                Define límites de gasto
              </p>
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => setShowConfigModal(true)}
              >
                <Plus size={14} />
                Configurar
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {progressItems.map((item, index) => (
                <div 
                  key={item.categoryName}
                  style={{
                    padding: '1rem',
                    borderRadius: '12px',
                    background: item.isOverBudget ? 'rgba(239, 68, 68, 0.08)' : 'var(--background)',
                    border: `1px solid ${item.isOverBudget ? 'rgba(239, 68, 68, 0.2)' : 'var(--border)'}`,
                    transition: 'transform 0.2s, box-shadow 0.2s'
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'flex-start',
                    marginBottom: '0.75rem' 
                  }}>
                    <div>
                      <span style={{ 
                        fontWeight: 600, 
                        fontSize: '0.95rem',
                        color: 'var(--text-primary)'
                      }}>
                        {item.categoryName}
                      </span>
                      <div style={{ 
                        fontSize: '0.8rem', 
                        color: 'var(--text-secondary)',
                        marginTop: '0.25rem'
                      }}>
                        {item.isOverBudget ? (
                          <span style={{ color: 'var(--danger)', fontWeight: 500 }}>
                            Excedido en {formatCurrency(Math.abs(item.remaining))}
                          </span>
                        ) : (
                          <span>Quedan {formatCurrency(item.remaining)}</span>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ 
                        fontWeight: 700, 
                        fontSize: '1.1rem',
                        color: getProgressColor(item.percentage, item.isOverBudget)
                      }}>
                        {Math.round(item.percentage)}%
                      </span>
                      <div style={{ 
                        fontSize: '0.75rem', 
                        color: 'var(--text-secondary)'
                      }}>
                        {formatCurrency(item.spent)} / {formatCurrency(item.limit)}
                      </div>
                    </div>
                  </div>

                  {/* Barra de progreso mejorada */}
                  <div style={{
                    height: '10px',
                    background: 'var(--muted)',
                    borderRadius: '5px',
                    overflow: 'hidden',
                    position: 'relative'
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(item.percentage, 100)}%`,
                      background: `linear-gradient(90deg, ${getProgressColor(item.percentage, item.isOverBudget)}, ${
                        item.isOverBudget ? '#dc2626' : item.percentage > 80 ? '#f59e0b' : '#22c55e'
                      })`,
                      borderRadius: '5px',
                      transition: 'width 0.5s ease',
                      boxShadow: item.percentage > 50 ? `0 0 8px ${getProgressColor(item.percentage, item.isOverBudget)}40` : 'none'
                    }} />
                  </div>

                  {item.isOverBudget && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginTop: '0.75rem',
                      padding: '0.5rem 0.75rem',
                      background: 'rgba(239, 68, 68, 0.1)',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      color: 'var(--danger)'
                    }}>
                      <AlertTriangle size={14} />
                      <span>¡Cuidado! Has superado el límite</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer con badges */}
        {budgets.length > 0 && (
          <div style={{
            padding: '1rem 1.25rem',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--background-subtle)'
          }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {overBudgetCount > 0 && (
                <span style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '20px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: 'var(--danger)',
                  fontSize: '0.75rem',
                  fontWeight: 600
                }}>
                  ⚠️ {overBudgetCount} excedido{overBudgetCount > 1 ? 's' : ''}
                </span>
              )}
              {overBudgetCount === 0 && (
                <span style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '20px',
                  background: 'rgba(34, 197, 94, 0.1)',
                  color: 'var(--success)',
                  fontSize: '0.75rem',
                  fontWeight: 600
                }}>
                  ✓ Todo bajo control
                </span>
              )}
            </div>
            <button
              onClick={() => setShowConfigModal(true)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--primary)',
                fontSize: '0.85rem',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
            >
              <Plus size={16} /> Añadir
            </button>
          </div>
        )}
      </div>

      {/* Modal mejorado */}
      <UiModal isOpen={showConfigModal} onClose={() => setShowConfigModal(false)}>
        <UiModalHeader>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--primary) 0%, #8b5cf6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white'
            }}>
              <Target size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 600 }}>Configurar Presupuestos</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {capitalizedMonth} {new Date().getFullYear()}
              </div>
            </div>
          </div>
        </UiModalHeader>
        <UiModalBody>
          {/* Presupuestos activos */}
          {budgets.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ 
                fontSize: '0.85rem', 
                fontWeight: 600, 
                marginBottom: '0.75rem',
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Activos ({budgets.length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {budgets.map(b => {
                  const progress = progressItems.find(p => p.categoryName === b.category_name)
                  return (
                    <div 
                      key={b.category_name} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        padding: '0.875rem 1rem',
                        background: 'var(--background)',
                        borderRadius: '12px',
                        border: '1px solid var(--border)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: getProgressColor(progress?.percentage || 0, progress?.isOverBudget || false)
                        }} />
                        <span style={{ fontWeight: 500 }}>{b.category_name}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ 
                          fontWeight: 600,
                          color: 'var(--text-primary)'
                        }}>
                          {formatCurrency(b.monthly_limit)}
                        </span>
                        <button 
                          onClick={() => handleDeleteBudget(b.category_name)}
                          style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '0.4rem',
                            cursor: 'pointer',
                            color: 'var(--danger)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Añadir nuevo */}
          {availableCategories.length > 0 && (
            <div>
              <h4 style={{ 
                fontSize: '0.85rem', 
                fontWeight: 600, 
                marginBottom: '0.75rem',
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Selecciona una categoría
              </h4>
              
              {/* Lista de categorías clickables */}
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column',
                gap: '0.5rem',
                marginBottom: editingCategory ? '1rem' : 0
              }}>
                {availableCategories.map(c => (
                  <button
                    key={c.categoryName}
                    onClick={() => setEditingCategory(c.categoryName)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.875rem 1rem',
                      borderRadius: '12px',
                      border: editingCategory === c.categoryName 
                        ? '2px solid var(--primary)' 
                        : '1px solid var(--border)',
                      background: editingCategory === c.categoryName 
                        ? 'var(--primary-light)' 
                        : 'var(--surface)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: editingCategory === c.categoryName 
                          ? 'var(--primary)' 
                          : c.color || 'var(--muted)'
                      }} />
                      <span style={{ 
                        fontWeight: 500, 
                        color: 'var(--text-primary)',
                        fontSize: '0.95rem'
                      }}>
                        {c.categoryName}
                      </span>
                    </div>
                    <span style={{ 
                      fontSize: '0.85rem', 
                      color: 'var(--text-secondary)',
                      fontWeight: 500
                    }}>
                      {formatCurrency(c.total)} gastado
                    </span>
                  </button>
                ))}
              </div>

              {/* Input de límite - solo aparece cuando hay categoría seleccionada */}
              {editingCategory && (
                <div style={{
                  padding: '1rem',
                  background: 'var(--primary-light)',
                  borderRadius: '12px',
                  border: '1px solid var(--primary)',
                  animation: 'fadeIn 0.2s ease'
                }}>
                  <div style={{ 
                    fontSize: '0.85rem', 
                    color: 'var(--text-secondary)',
                    marginBottom: '0.5rem'
                  }}>
                    Límite mensual para <strong style={{ color: 'var(--text-primary)' }}>{editingCategory}</strong>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <span style={{
                        position: 'absolute',
                        left: '1rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-secondary)',
                        fontWeight: 600,
                        fontSize: '1.1rem'
                      }}>€</span>
                      <input
                        type="number"
                        value={editingLimit}
                        onChange={(e) => setEditingLimit(e.target.value)}
                        placeholder="100"
                        min={0}
                        step={10}
                        autoFocus
                        className="input"
                        style={{
                          width: '100%',
                          padding: '0.875rem 1rem 0.875rem 2.5rem',
                          borderRadius: '10px',
                          fontSize: '1.1rem',
                          fontWeight: 600
                        }}
                      />
                    </div>
                    <button 
                      onClick={handleSaveBudget}
                      disabled={!editingLimit || saving}
                      className="btn btn-primary"
                      style={{
                        padding: '0.875rem 1.5rem',
                        borderRadius: '10px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      {saving ? (
                        <div className="animate-spin" style={{ 
                          width: '18px', 
                          height: '18px', 
                          border: '2px solid transparent',
                          borderTopColor: 'white',
                          borderRadius: '50%'
                        }} />
                      ) : (
                        <>
                          <Plus size={18} />
                          Guardar
                        </>
                      )}
                    </button>
                    <button 
                      onClick={() => { setEditingCategory(''); setEditingLimit(''); }}
                      style={{
                        padding: '0.875rem',
                        borderRadius: '10px',
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {availableCategories.length === 0 && budgets.length > 0 && (
            <div style={{
              textAlign: 'center',
              padding: '2rem',
              background: 'var(--background)',
              borderRadius: '12px',
              border: '1px solid var(--border)'
            }}>
              <TrendingUp size={32} style={{ color: 'var(--success)', marginBottom: '0.75rem' }} />
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                ¡Todas las categorías tienen presupuesto!
              </p>
            </div>
          )}

          {categorySpending.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '2rem',
              background: 'var(--background)',
              borderRadius: '12px',
              border: '1px solid var(--border)'
            }}>
              <Target size={32} style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem', opacity: 0.5 }} />
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                Registra gastos para poder asignar presupuestos
              </p>
            </div>
          )}
        </UiModalBody>
        <UiModalFooter>
          <button 
            className="btn btn-secondary" 
            onClick={() => setShowConfigModal(false)}
            style={{ borderRadius: '10px', padding: '0.75rem 1.5rem' }}
          >
            Cerrar
          </button>
        </UiModalFooter>
      </UiModal>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  )
}
