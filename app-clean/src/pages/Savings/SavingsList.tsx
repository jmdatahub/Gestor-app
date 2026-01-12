import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useWorkspace } from '../../context/WorkspaceContext'
import { 
  getGoalsByUser, 
  createGoal, 
  deleteGoal,
  addContribution,
  type SavingsGoal 
} from '../../services/savingsService'
import { Plus, Target, CheckCircle2, PiggyBank, AlertTriangle, Pencil, Trash2 } from 'lucide-react'
import { UiInput } from '../../components/ui/UiInput'
import { UiNumber } from '../../components/ui/UiNumber'
import { useI18n } from '../../hooks/useI18n'
import { UiDatePicker } from '../../components/ui/UiDatePicker'
import { formatISODateString } from '../../utils/date'
import { UiModal, UiModalHeader, UiModalBody, UiModalFooter } from '../../components/ui/UiModal'
import { UiField } from '../../components/ui/UiField'
import { UiTextarea } from '../../components/ui/UiTextarea'
import { useToast } from '../../components/Toast'

export default function SavingsList() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const { currentWorkspace } = useWorkspace()  // Add workspace context
  const toast = useToast()
  const [goals, setGoals] = useState<SavingsGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [showContribModal, setShowContribModal] = useState(false)
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null)

  // Goal form state
  const [goalName, setGoalName] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Contribution form state
  const [contribAmount, setContribAmount] = useState('')
  const [contribDate, setContribDate] = useState(new Date().toISOString().split('T')[0])
  const [contribNote, setContribNote] = useState('')

  // Reload when workspace changes
  useEffect(() => {
    loadGoals()
  }, [currentWorkspace])

  const loadGoals = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      // Pass organization_id from workspace context
      const orgId = currentWorkspace?.id || null
      const data = await getGoalsByUser(user.id, orgId)
      setGoals(data)
    } catch (error) {
      console.error('Error loading goals:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setFormError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setFormError('No se pudo obtener el usuario')
      setSubmitting(false)
      return
    }

    try {
      await createGoal({
        user_id: user.id,
        organization_id: currentWorkspace?.id || null,  // Include workspace
        name: goalName,
        target_amount: parseFloat(targetAmount),
        target_date: targetDate || null,
        description: description || null
      })
      setShowGoalModal(false)
      resetGoalForm()
      loadGoals()
    } catch (error: any) {
      console.error('Error creating goal:', error)
      // Show detailed error to user
      const errorMsg = error?.message || error?.details || 'Error desconocido al crear el objetivo'
      setFormError(errorMsg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddContribution = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedGoalId) return
    setSubmitting(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      await addContribution({
        goal_id: selectedGoalId,
        amount: parseFloat(contribAmount),
        date: contribDate,
        note: contribNote || null
      })
      setShowContribModal(false)
      resetContribForm()
      loadGoals()
    } catch (error) {
      console.error('Error adding contribution:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const openContribModal = (goalId: string) => {
    setSelectedGoalId(goalId)
    setShowContribModal(true)
  }

  const resetGoalForm = () => {
    setGoalName('')
    setTargetAmount('')
    setTargetDate('')
    setDescription('')  // Reset descripción
    setFormError(null)
  }

  const resetContribForm = () => {
    setContribAmount('')
    setContribDate(new Date().toISOString().split('T')[0])
    setContribNote('')
    setSelectedGoalId(null)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const getProgress = (goal: SavingsGoal) => {
    return Math.min(100, (goal.current_amount / goal.target_amount) * 100)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '200px' }}>
        <div className="animate-spin" style={{ 
          width: '40px', 
          height: '40px', 
          border: '3px solid var(--gray-200)', 
          borderTopColor: 'var(--primary)', 
          borderRadius: '50%' 
        }}></div>
      </div>
    )
  }

  const activeGoals = goals.filter(g => g.status === 'active')
  const completedGoals = goals.filter(g => g.status === 'completed')

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('savings.title')}</h1>
          <p className="page-subtitle">{t('savings.subtitle')}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowGoalModal(true)}>
          <Plus size={20} />
          {t('savings.new')}
        </button>
      </div>

      {/* Goals List */}
      {goals.length === 0 ? (
        <div className="section-card flex flex-col items-center justify-center p-12 text-center">
          <PiggyBank size={48} className="text-gray-300 mb-4" />
          <p className="text-gray-500 mb-4">{t('savings.empty')}</p>
          <button className="btn btn-primary" onClick={() => setShowGoalModal(true)}>
            {t('savings.createFirst')}
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Active Goals */}
          {activeGoals.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {activeGoals.map((goal) => (
                <div key={goal.id} className="card p-6 hover:shadow-lg transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{goal.name}</h3>
                      {goal.target_date && (
                        <span className="text-sm text-gray-500">
                          {t('savings.targetDate', { date: formatDate(goal.target_date) })}
                        </span>
                      )}
                    </div>
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Target size={24} className="text-primary" />
                    </div>
                  </div>

                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-2xl font-bold text-primary">
                      {formatCurrency(goal.current_amount)}
                    </span>
                    <span className="text-sm text-gray-500">
                      {t('savings.of')} {formatCurrency(goal.target_amount)}
                    </span>
                  </div>

                  {/* Progress Bar - Enhanced */}
                  <div className="mb-4">
                    <div 
                      style={{ 
                        height: 10, 
                        background: 'rgba(0,0,0,0.08)', 
                        borderRadius: 8, 
                        overflow: 'hidden',
                        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)'
                      }}
                    >
                      <div 
                        style={{ 
                          height: '100%', 
                          width: `${getProgress(goal)}%`,
                          background: getProgress(goal) >= 90 
                            ? 'linear-gradient(90deg, #10b981, #34d399, #6ee7b7)' 
                            : getProgress(goal) >= 50 
                              ? 'linear-gradient(90deg, #3b82f6, #60a5fa, #93c5fd)'
                              : 'linear-gradient(90deg, #8b5cf6, #a78bfa, #c4b5fd)',
                          borderRadius: 8,
                          transition: 'all 0.5s ease',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>
                        {getProgress(goal) >= 90 ? '🎉 ¡Casi lo logras!' : getProgress(goal) >= 50 ? '💪 ¡Vas bien!' : '🚀 ¡Sigue así!'}
                      </span>
                      <span style={{ 
                        fontSize: 13, 
                        fontWeight: 700, 
                        color: getProgress(goal) >= 90 ? '#10b981' : getProgress(goal) >= 50 ? '#3b82f6' : '#8b5cf6'
                      }}>
                        {getProgress(goal).toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  {/* Mostrar descripción si existe */}
                  {goal.description && (
                    <p className="text-sm text-gray-500 mt-3 line-clamp-2">
                      {goal.description}
                    </p>
                  )}

                  <div className="flex gap-2 mt-6">
                    <button 
                      className="btn btn-primary flex-1 justify-center" 
                      onClick={() => openContribModal(goal.id)}
                    >
                      {t('savings.contribute')}
                    </button>
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => navigate(`/app/savings/${goal.id}`)}
                    >
                      {t('savings.details')}
                    </button>
                  </div>
                  <div className="flex gap-1 mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <button 
                      className="btn btn-icon btn-ghost btn-sm hover:text-primary" 
                      onClick={() => navigate(`/app/savings/${goal.id}`)}
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                    <button 
                      className="btn btn-icon btn-ghost btn-sm text-danger/70 hover:text-danger" 
                      onClick={async () => {
                        if (confirm('¿Eliminar este objetivo de ahorro?')) {
                          await deleteGoal(goal.id)
                          loadGoals()
                        }
                      }}
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Completed Goals */}
          {completedGoals.length > 0 && (
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white mb-4">
                <CheckCircle2 size={20} className="text-success" />
                {t('savings.completedTitle')}
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {completedGoals.map((goal) => (
                  <div key={goal.id} className="card p-6 bg-gray-50/50 dark:bg-slate-800/50 border border-success/20">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{goal.name}</h3>
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-success/10 text-success">
                            {t('savings.status.completed')}
                        </span>
                      </div>
                      <div className="p-2 bg-success/10 rounded-lg">
                        <CheckCircle2 size={24} className="text-success" />
                      </div>
                    </div>
                    
                    {/* Amount section - show achieved amount */}
                    <div className="flex items-baseline gap-2 mb-3">
                      <span className="text-2xl font-bold text-success">
                        {formatCurrency(goal.current_amount)}
                      </span>
                      <span className="text-sm text-gray-500">
                        ¡Objetivo alcanzado!
                      </span>
                    </div>

                    {goal.description && (
                      <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                        {goal.description}
                      </p>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2 mt-4">
                      <button 
                        className="btn btn-secondary flex-1" 
                        onClick={() => navigate(`/app/savings/${goal.id}`)}
                      >
                        {t('savings.details')}
                      </button>
                      <div className="flex gap-1">
                          <button 
                            className="btn btn-icon btn-ghost btn-sm" 
                            onClick={() => navigate(`/app/savings/${goal.id}`)}
                            title="Editar"
                          >
                            <Pencil size={14} />
                          </button>
                          <button 
                            className="btn btn-icon btn-ghost btn-sm text-danger/70 hover:text-danger" 
                            onClick={async () => {
                              if (confirm('¿Eliminar este objetivo de ahorro completado?')) {
                                await deleteGoal(goal.id)
                                loadGoals()
                              }
                            }}
                            title="Eliminar"
                          >
                            <Trash2 size={14} />
                          </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Goal Modal */}
      <UiModal 
        isOpen={showGoalModal} 
        onClose={() => { setShowGoalModal(false); resetGoalForm(); }}
        width="500px"
      >
        <form onSubmit={handleCreateGoal}>
          <UiModalHeader>{t('savings.modal.newTitle')}</UiModalHeader>
          <UiModalBody>
            {/* Error Banner */}
            {formError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <div>
                  <strong>Error:</strong> {formError}
                </div>
              </div>
            )}
            <div className="mb-4">
              <UiInput
                label={t('savings.modal.name')}
                value={goalName}
                onChange={(e) => setGoalName(e.target.value)}
                placeholder="Ej: Viaje a Japón"
                required
              />
            </div>
            <div className="mb-4">
              <UiNumber
                label={`${t('savings.modal.targetAmount')} (€)`}
                value={targetAmount}
                onChange={(val: string) => setTargetAmount(val)}
                placeholder="0.00"
                step="0.01"
                min={0.01}
                required
              />
            </div>
            <div className="mb-4">
              <UiField label={t('savings.modal.targetDate')}>
                <UiDatePicker
                    value={targetDate}
                    onChange={(d) => setTargetDate(d ? formatISODateString(d) : '')}
                />
              </UiField>
            </div>
            <div className="mb-4">
              <UiTextarea
                label={t('savings.modal.description')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Añade detalles sobre tu objetivo... (opcional)"
                rows={3}
              />
            </div>
          </UiModalBody>
          <UiModalFooter>
             <button type="button" className="btn btn-secondary" onClick={() => setShowGoalModal(false)}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? t('savings.modal.creating') : t('savings.modal.create')}
            </button>
          </UiModalFooter>
        </form>
      </UiModal>

      {/* Add Contribution Modal */}
      <UiModal 
        isOpen={showContribModal} 
        onClose={() => setShowContribModal(false)}
        width="400px"
      >
        <form onSubmit={handleAddContribution}>
          <UiModalHeader>{t('savings.contrib.newTitle')}</UiModalHeader>
          <UiModalBody>
            <div className="mb-4">
              <UiNumber
                label={`${t('common.amount')} (€)`}
                value={contribAmount}
                onChange={(val: string) => setContribAmount(val)}
                placeholder="0.00"
                step="0.01"
                min={0.01}
                required
              />
            </div>
            <div className="mb-4">
              <UiField label={t('common.date')}>
                <UiDatePicker
                  value={contribDate}
                  onChange={(d) => setContribDate(d ? formatISODateString(d) : '')}
                  required
                />
              </UiField>
            </div>
            <div className="mb-4">
              <UiInput
                label={t('savings.contrib.note')}
                value={contribNote}
                onChange={(e) => setContribNote(e.target.value)}
                placeholder="Añade una nota..."
              />
            </div>
          </UiModalBody>
          <UiModalFooter>
             <button type="button" className="btn btn-secondary" onClick={() => setShowContribModal(false)}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? t('savings.contrib.saving') : t('savings.contrib.add')}
            </button>
          </UiModalFooter>
        </form>
      </UiModal>
    </div>
  )
}
