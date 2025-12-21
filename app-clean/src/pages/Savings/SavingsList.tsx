import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { 
  getGoalsByUser, 
  createGoal, 
  addContribution,
  type SavingsGoal 
} from '../../services/savingsService'
import { Plus, Target, CheckCircle2, X, PiggyBank } from 'lucide-react'
import { UiInput } from '../../components/ui/UiInput'
import { UiNumber } from '../../components/ui/UiNumber'
import { UiTextarea } from '../../components/ui/UiTextarea'
import { useI18n } from '../../hooks/useI18n'
import { UiDatePicker } from '../../components/ui/UiDatePicker'
import { formatISODateString } from '../../utils/date'
import { UiModal, UiModalHeader, UiModalBody, UiModalFooter } from '../../components/ui/UiModal'
import { UiField } from '../../components/ui/UiField'

export default function SavingsList() {
  const navigate = useNavigate()
  const { t, lang } = useI18n()
  const [goals, setGoals] = useState<SavingsGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [showContribModal, setShowContribModal] = useState(false)
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null)

  // Goal form state
  const [goalName, setGoalName] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Contribution form state
  const [contribAmount, setContribAmount] = useState('')
  const [contribDate, setContribDate] = useState(new Date().toISOString().split('T')[0])
  const [contribNote, setContribNote] = useState('')

  useEffect(() => {
    loadGoals()
  }, [])

  const loadGoals = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      const data = await getGoalsByUser(user.id)
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

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      await createGoal({
        user_id: user.id,
        name: goalName,
        target_amount: parseFloat(targetAmount),
        due_date: dueDate || null,
        description: description || null
      })
      setShowGoalModal(false)
      resetGoalForm()
      loadGoals()
    } catch (error) {
      console.error('Error creating goal:', error)
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
        user_id: user.id,
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
    setDueDate('')
    setDescription('')
  }

  const resetContribForm = () => {
    setContribAmount('')
    setContribDate(new Date().toISOString().split('T')[0])
    setContribNote('')
    setSelectedGoalId(null)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(lang === 'es' ? 'es-ES' : 'en-US', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', {
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

  const activeGoals = goals.filter(g => !g.is_completed)
  const completedGoals = goals.filter(g => g.is_completed)

  return (
    <div>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>{t('savings.title')}</h1>
          <p style={styles.subtitle}>{t('savings.subtitle')}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowGoalModal(true)}>
          <Plus size={20} />
          {t('savings.new')}
        </button>
      </div>

      {/* Goals List */}
      {goals.length === 0 ? (
        <div className="card text-center" style={{ padding: '3rem' }}>
          <PiggyBank size={48} style={{ color: 'var(--gray-300)', marginBottom: '1rem' }} />
          <p className="text-gray-500">{t('savings.empty')}</p>
          <button className="btn btn-primary mt-4" onClick={() => setShowGoalModal(true)}>
            {t('savings.createFirst')}
          </button>
        </div>
      ) : (
        <>
          {/* Active Goals */}
          {activeGoals.length > 0 && (
            <div style={styles.goalsGrid}>
              {activeGoals.map((goal) => (
                <div key={goal.id} className="card" style={styles.goalCard}>
                  <div style={styles.goalHeader}>
                    <div>
                      <h3 style={styles.goalName}>{goal.name}</h3>
                      {goal.due_date && (
                        <span className="text-sm text-gray-500">
                          {t('savings.targetDate', { date: formatDate(goal.due_date) })}
                        </span>
                      )}
                    </div>
                    <Target size={24} style={{ color: 'var(--primary)' }} />
                  </div>

                  <div style={styles.amountRow}>
                    <span style={styles.currentAmount}>
                      {formatCurrency(goal.current_amount)}
                    </span>
                    <span className="text-gray-500">
                      {t('savings.of')} {formatCurrency(goal.target_amount)}
                    </span>
                  </div>

                  <div style={styles.progressContainer}>
                    <div style={styles.progressBar}>
                      <div 
                        style={{ 
                          ...styles.progressFill, 
                          width: `${getProgress(goal)}%` 
                        }} 
                      />
                    </div>
                    <span style={styles.progressText}>
                      {getProgress(goal).toFixed(0)}%
                    </span>
                  </div>

                  {goal.description && (
                    <p className="text-sm text-gray-500" style={{ marginTop: '0.75rem' }}>
                      {goal.description}
                    </p>
                  )}

                  <div style={styles.goalActions}>
                    <button 
                      className="btn btn-primary" 
                      onClick={() => openContribModal(goal.id)}
                      style={{ flex: 1 }}
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
                </div>
              ))}
            </div>
          )}

          {/* Completed Goals */}
          {completedGoals.length > 0 && (
            <>
              <h2 style={{ ...styles.sectionTitle, marginTop: '2rem' }}>
                <CheckCircle2 size={20} style={{ color: 'var(--success)' }} />
                {t('savings.completedTitle')}
              </h2>
              <div style={styles.goalsGrid}>
                {completedGoals.map((goal) => (
                  <div key={goal.id} className="card" style={{ ...styles.goalCard, opacity: 0.8 }}>
                    <div style={styles.goalHeader}>
                      <div>
                        <h3 style={styles.goalName}>{goal.name}</h3>
                        <span className="badge badge-success">{t('savings.status.completed')}</span>
                      </div>
                      <CheckCircle2 size={24} style={{ color: 'var(--success)' }} />
                    </div>
                    <div style={styles.amountRow}>
                      <span style={{ ...styles.currentAmount, color: 'var(--success)' }}>
                        {formatCurrency(goal.current_amount)}
                      </span>
                    </div>
                    <button 
                      className="btn btn-secondary w-full mt-4" 
                      onClick={() => navigate(`/app/savings/${goal.id}`)}
                    >
                      {t('savings.details')}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Create Goal Modal */}
      <UiModal 
        isOpen={showGoalModal} 
        onClose={() => setShowGoalModal(false)}
        title={t('savings.modal.newTitle')}
        width="500px"
      >
        <form onSubmit={handleCreateGoal}>
          <UiModalBody>
            <div className="form-group">
              <UiInput
                label={t('savings.modal.name')}
                value={goalName}
                onChange={(e) => setGoalName(e.target.value)}
                placeholder="Ej: Viaje a Japón"
                required
              />
            </div>
            <div className="form-group">
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
            <div className="form-group">
              <UiField label={t('savings.modal.targetDate')}>
                <UiDatePicker
                    value={dueDate}
                    onChange={(d) => setDueDate(d ? formatISODateString(d) : '')}
                />
              </UiField>
            </div>
            <div className="form-group">
              <UiTextarea
                label={t('savings.modal.description')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Añade detalles sobre tu objetivo..."
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
        title={t('savings.contrib.newTitle')}
        width="400px"
      >
        <form onSubmit={handleAddContribution}>
          <UiModalBody>
            <div className="form-group">
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
            <div className="form-group">
              <UiField label={t('common.date')}>
                <UiDatePicker
                  value={contribDate}
                  onChange={(d) => setContribDate(d ? formatISODateString(d) : '')}
                  required
                />
              </UiField>
            </div>
            <div className="form-group">
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

const styles: { [key: string]: React.CSSProperties } = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '1.5rem',
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: 700,
    color: 'var(--gray-800)',
    marginBottom: '0.25rem',
  },
  subtitle: {
    color: 'var(--gray-500)',
    fontSize: '0.875rem',
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '1.125rem',
    fontWeight: 600,
    color: 'var(--gray-700)',
    marginBottom: '1rem',
  },
  goalsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '1rem',
  },
  goalCard: {
    padding: '1.25rem',
  },
  goalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '1rem',
  },
  goalName: {
    fontSize: '1.125rem',
    fontWeight: 600,
    color: 'var(--gray-800)',
    marginBottom: '0.25rem',
  },
  amountRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.5rem',
    marginBottom: '0.75rem',
  },
  currentAmount: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: 'var(--primary)',
  },
  progressContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  progressBar: {
    flex: 1,
    height: '8px',
    background: 'var(--gray-200)',
    borderRadius: '9999px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'var(--primary)',
    borderRadius: '9999px',
    transition: 'width 0.3s ease',
  },
  progressText: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'var(--gray-600)',
    minWidth: '40px',
    textAlign: 'right',
  },
  goalActions: {
    display: 'flex',
    gap: '0.5rem',
    marginTop: '1rem',
  },
}
