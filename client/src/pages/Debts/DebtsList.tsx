import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useWorkspace } from '../../context/WorkspaceContext'
import { fetchDebts, type Debt, type CreateDebtInput } from '../../services/debtService'
import { useCreateDebt } from '../../hooks/queries/useDebtMutations'
import {
  Plus, AlertCircle, CheckCircle2, Clock, ArrowRight,
  TrendingUp, TrendingDown, Wallet, Calendar,
} from 'lucide-react'
import { useI18n } from '../../hooks/useI18n'
import { UiDatePicker } from '../../components/ui/UiDatePicker'
import { formatISODateString } from '../../utils/date'
import { UiSelect } from '../../components/ui/UiSelect'
import { UiField } from '../../components/ui/UiField'
import { UiSegmented } from '../../components/ui/UiSegmented'
import { UiCard } from '../../components/ui/UiCard'
import { UiInput } from '../../components/ui/UiInput'
import { UiNumber } from '../../components/ui/UiNumber'
import { UiTextarea } from '../../components/ui/UiTextarea'
import { UiModal, UiModalBody, UiModalFooter } from '../../components/ui/UiModal'
import { useToast } from '../../components/Toast'
import { StatCard } from '../../components/shared/StatCard'
import { EmptyState } from '../../components/shared/EmptyState'

type FilterTab = 'all' | 'i_owe' | 'they_owe_me' | 'closed'

const DEBTS_GRADIENT = 'linear-gradient(135deg, #EF4444 0%, #F97316 100%)'
const DEBTS_GRADIENT_SOFT = 'linear-gradient(90deg, #EF4444 0%, #F97316 50%, #FB923C 100%)'
const OWED_GRADIENT = 'linear-gradient(135deg, #10B981 0%, #22C55E 100%)'
const OWED_GRADIENT_SOFT = 'linear-gradient(90deg, #10B981 0%, #22C55E 50%, #4ADE80 100%)'
const CLOSED_GRADIENT_SOFT = 'linear-gradient(90deg, #94A3B8 0%, #CBD5E1 100%)'

export default function DebtsList() {
  const { t, language } = useI18n()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { currentWorkspace } = useWorkspace()
  const toast = useToast()
  const createDebtMutation = useCreateDebt()
  const [debts, setDebts] = useState<Debt[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [showModal, setShowModal] = useState(false)

  const [direction, setDirection] = useState<'i_owe' | 'they_owe_me'>('i_owe')
  const [counterparty, setCounterparty] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    loadDebts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, currentWorkspace?.id])

  const loadDebts = async () => {
    if (!user) return
    try {
      const orgId = currentWorkspace?.id || null
      const data = await fetchDebts(user.id, orgId)
      setDebts(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error loading debts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!counterparty.trim()) {
      setFormError('El nombre de la contraparte es obligatorio')
      return
    }
    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      setFormError('El importe debe ser un número mayor a 0')
      return
    }

    setSubmitting(true)
    if (!user) {
      setFormError('No se pudo obtener el usuario. Inicia sesión nuevamente.')
      setSubmitting(false)
      return
    }

    const timeoutId = setTimeout(() => {
      setSubmitting(false)
      setFormError('La operación tardó demasiado. Verifica tu conexión.')
    }, 12000)

    try {
      const input: CreateDebtInput = {
        user_id: user.id,
        organization_id: currentWorkspace?.id || null,
        direction,
        counterparty_name: counterparty.trim(),
        total_amount: amountNum,
        due_date: dueDate || null,
        description: description.trim() || null
      }

      await createDebtMutation.mutateAsync(input)
      clearTimeout(timeoutId)
      toast.success(
        'Deuda creada',
        `"${counterparty.trim()}" se ha añadido correctamente`
      )
      setShowModal(false)
      resetForm()
      loadDebts()
    } catch (err: unknown) {
      clearTimeout(timeoutId)
      let errorMsg = 'Error al crear la deuda.'
      let technicalDetail = ''

      if (err && typeof err === 'object') {
        const supaError = err as { message?: string; details?: string; hint?: string; code?: string }
        technicalDetail = supaError.message || JSON.stringify(err)
        if (supaError.details) technicalDetail += ` | ${supaError.details}`
        if (supaError.hint) technicalDetail += ` | Hint: ${supaError.hint}`
        if (supaError.code) technicalDetail += ` | Code: ${supaError.code}`
      }

      if (technicalDetail) errorMsg += ` [${technicalDetail}]`
      setFormError(errorMsg)
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setCounterparty('')
    setAmount('')
    setDueDate('')
    setDescription('')
    setDirection('i_owe')
  }

  const isOverdue = (debt: Debt) => {
    if (!debt.due_date || debt.is_closed) return false
    return new Date(debt.due_date) < new Date()
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const formatCurrency = (amount: number | string | null | undefined) => {
    const n = Number(amount ?? 0)
    const safe = Number.isFinite(n) ? n : 0
    return new Intl.NumberFormat(language === 'es' ? 'es-ES' : 'en-US', {
      style: 'currency',
      currency: 'EUR'
    }).format(safe)
  }

  // ── Aggregations ────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const active = debts.filter(d => !d.is_closed)
    const totalIOwe = active
      .filter(d => d.direction === 'i_owe')
      .reduce((s, d) => s + (Number(d.remaining_amount) || 0), 0)
    const totalTheyOweMe = active
      .filter(d => d.direction === 'they_owe_me')
      .reduce((s, d) => s + (Number(d.remaining_amount) || 0), 0)

    const upcoming = active
      .filter(d => !!d.due_date && !isOverdue(d))
      .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())[0]

    const overdueCount = active.filter(d => isOverdue(d)).length

    return {
      totalIOwe,
      totalTheyOweMe,
      activeCount: active.length,
      overdueCount,
      upcoming,
    }
  }, [debts])

  const filteredDebts = useMemo(() => {
    switch (activeTab) {
      case 'i_owe':       return debts.filter(d => d.direction === 'i_owe' && !d.is_closed)
      case 'they_owe_me': return debts.filter(d => d.direction === 'they_owe_me' && !d.is_closed)
      case 'closed':      return debts.filter(d => d.is_closed)
      default:            return debts
    }
  }, [debts, activeTab])

  if (loading) {
    return (
      <div className="page-container">
        <div className="d-flex items-center justify-center" style={{ minHeight: '200px' }}>
          <div className="spinner"></div>
        </div>
      </div>
    )
  }

  const hasAnyDebt = debts.length > 0
  const lang = language

  return (
    <div className="page-container">
      {/* ── Modern Header with gradient icon ──────────────────────────────── */}
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '0.5rem' }}>
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '16px',
              background: DEBTS_GRADIENT,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 20px rgba(239, 68, 68, 0.35)',
              flexShrink: 0,
            }}>
              <Wallet size={26} color="white" />
            </div>
            <div>
              <h1 className="page-title" style={{ margin: 0 }}>{t('debts.title')}</h1>
              <p className="page-subtitle" style={{ margin: 0 }}>
                {lang === 'es'
                  ? 'Controla lo que debes y lo que te deben'
                  : 'Track what you owe and what you are owed'}
              </p>
            </div>
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowModal(true)}
          style={{
            background: DEBTS_GRADIENT,
            boxShadow: '0 4px 14px rgba(239, 68, 68, 0.35)',
            padding: '0.75rem 1.25rem',
            border: 'none',
          }}
        >
          <Plus size={20} />
          {t('debts.new')}
        </button>
      </div>

      {/* ── KPI cards ─────────────────────────────────────────────────────── */}
      {hasAnyDebt && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <StatCard
            label={lang === 'es' ? 'Total que debes' : 'Total you owe'}
            value={formatCurrency(stats.totalIOwe)}
            tone="danger"
            icon={<TrendingDown size={18} />}
            helper={lang === 'es' ? 'Pendiente de pagar' : 'Pending to pay'}
          />
          <StatCard
            label={lang === 'es' ? 'Total que te deben' : 'Total owed to you'}
            value={formatCurrency(stats.totalTheyOweMe)}
            tone="success"
            icon={<TrendingUp size={18} />}
            helper={lang === 'es' ? 'Pendiente de cobrar' : 'Pending to collect'}
          />
          <StatCard
            label={lang === 'es' ? 'Próximo pago' : 'Next due'}
            value={
              stats.upcoming
                ? formatDate(stats.upcoming.due_date!)
                : (lang === 'es' ? 'Sin fechas' : 'No dates')
            }
            tone="warning"
            icon={<Calendar size={18} />}
            helper={
              stats.upcoming
                ? `${stats.upcoming.counterparty_name} · ${formatCurrency(stats.upcoming.remaining_amount)}`
                : (lang === 'es' ? 'No hay deudas con vencimiento' : 'No deadlines set')
            }
          />
          <StatCard
            label={lang === 'es' ? 'Deudas activas' : 'Active debts'}
            value={stats.activeCount}
            tone={stats.overdueCount > 0 ? 'danger' : 'primary'}
            icon={<AlertCircle size={18} />}
            helper={
              stats.overdueCount > 0
                ? (lang === 'es' ? `${stats.overdueCount} vencida${stats.overdueCount === 1 ? '' : 's'}` : `${stats.overdueCount} overdue`)
                : (lang === 'es' ? 'Todo al día' : 'All on track')
            }
          />
        </div>
      )}

      {/* ── Filter tabs ───────────────────────────────────────────────────── */}
      {hasAnyDebt && (
        <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <UiSegmented
            value={activeTab}
            onChange={(val) => setActiveTab(val as FilterTab)}
            options={[
              { value: 'all',         label: lang === 'es' ? 'Todas' : 'All' },
              { value: 'i_owe',       label: t('debts.iOwe') },
              { value: 'they_owe_me', label: t('debts.theyOweMe') },
              { value: 'closed',      label: lang === 'es' ? 'Pagadas' : 'Paid' },
            ]}
          />
        </div>
      )}

      {/* ── List / Empty state ────────────────────────────────────────────── */}
      {!hasAnyDebt ? (
        <UiCard className="p-12">
          <EmptyState
            icon={
              <div style={{
                width: '88px',
                height: '88px',
                borderRadius: '22px',
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.18) 0%, rgba(249, 115, 22, 0.12) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
              }}>
                <Wallet size={44} style={{ color: '#EF4444' }} />
              </div>
            }
            title={lang === 'es' ? 'Aún no tienes deudas registradas' : 'No debts registered yet'}
            description={
              lang === 'es'
                ? 'Empieza añadiendo una deuda para llevar el control de tus pagos pendientes y de lo que te deben.'
                : 'Start by adding a debt to track your pending payments and what is owed to you.'
            }
            action={
              <button
                className="btn btn-primary"
                onClick={() => setShowModal(true)}
                style={{
                  background: DEBTS_GRADIENT,
                  boxShadow: '0 4px 14px rgba(239, 68, 68, 0.35)',
                  border: 'none',
                  marginTop: '1rem',
                }}
              >
                <Plus size={18} />
                {t('debts.createFirst')}
              </button>
            }
          />
        </UiCard>
      ) : filteredDebts.length === 0 ? (
        <UiCard className="p-12">
          <EmptyState
            icon={<CheckCircle2 size={40} style={{ color: 'var(--text-muted)' }} />}
            title={lang === 'es' ? 'No hay deudas en esta vista' : 'No debts in this view'}
            description={lang === 'es' ? 'Prueba con otro filtro.' : 'Try a different filter.'}
          />
        </UiCard>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          {filteredDebts.map((debt) => {
            const totalAmt = Number(debt.total_amount ?? 0) || 0
            const remainingAmt = Number(debt.remaining_amount ?? 0) || 0
            const paidAmt = Math.max(0, totalAmt - remainingAmt)
            const paidPct = totalAmt > 0 ? Math.min(100, Math.max(0, (paidAmt / totalAmt) * 100)) : 0
            const overdue = isOverdue(debt)
            const iOwe = debt.direction === 'i_owe'

            // Decorative top line gradient based on state
            const lineGradient = debt.is_closed
              ? CLOSED_GRADIENT_SOFT
              : iOwe
                ? DEBTS_GRADIENT_SOFT
                : OWED_GRADIENT_SOFT

            // Avatar / icon background gradient
            const avatarGradient = debt.is_closed
              ? 'linear-gradient(135deg, #94A3B8 0%, #CBD5E1 100%)'
              : iOwe ? DEBTS_GRADIENT : OWED_GRADIENT

            const amountColor = debt.is_closed
              ? 'var(--text-muted)'
              : iOwe ? '#EF4444' : '#10B981'

            return (
              <div
                key={debt.id}
                onClick={() => navigate(`/app/debts/${debt.id}`)}
                style={{
                  background: 'var(--bg-card)',
                  borderRadius: '16px',
                  border: '1px solid var(--border-color)',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                  position: 'relative',
                  opacity: debt.is_closed ? 0.85 : 1,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 12px 28px rgba(0, 0, 0, 0.10)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.04)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                {/* Decorative top gradient line */}
                <div style={{ height: '4px', background: lineGradient }} />

                <div style={{ padding: '1.25rem 1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {/* Avatar with directional icon */}
                    <div style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '14px',
                      background: avatarGradient,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: debt.is_closed
                        ? 'none'
                        : iOwe
                          ? '0 4px 12px rgba(239, 68, 68, 0.30)'
                          : '0 4px 12px rgba(16, 185, 129, 0.30)',
                      flexShrink: 0,
                    }}>
                      {iOwe ? (
                        <TrendingDown size={26} color="white" />
                      ) : (
                        <TrendingUp size={26} color="white" />
                      )}
                    </div>

                    {/* Main content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                        <h3 style={{
                          fontSize: '1.1rem',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          margin: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '320px',
                        }}>
                          {debt.counterparty_name}
                        </h3>

                        {/* Direction badge */}
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.18rem 0.55rem',
                          borderRadius: '12px',
                          background: iOwe ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                          color: iOwe ? '#DC2626' : '#059669',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          border: `1px solid ${iOwe ? 'rgba(239, 68, 68, 0.22)' : 'rgba(16, 185, 129, 0.22)'}`,
                        }}>
                          {iOwe ? t('debts.iOwe') : t('debts.theyOweMe')}
                        </span>

                        {/* Status badge */}
                        {debt.is_closed ? (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                            padding: '0.18rem 0.55rem', borderRadius: '12px',
                            background: 'rgba(34, 197, 94, 0.12)', color: '#15803D',
                            fontSize: '0.7rem', fontWeight: 600,
                            border: '1px solid rgba(34, 197, 94, 0.22)',
                          }}>
                            <CheckCircle2 size={12} />
                            {lang === 'es' ? 'Pagada' : 'Paid'}
                          </span>
                        ) : overdue ? (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                            padding: '0.18rem 0.55rem', borderRadius: '12px',
                            background: 'rgba(239, 68, 68, 0.12)', color: '#B91C1C',
                            fontSize: '0.7rem', fontWeight: 700,
                            border: '1px solid rgba(239, 68, 68, 0.28)',
                          }}>
                            <AlertCircle size={12} />
                            {lang === 'es' ? 'Vencida' : 'Overdue'}
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                            padding: '0.18rem 0.55rem', borderRadius: '12px',
                            background: 'rgba(245, 158, 11, 0.12)', color: '#B45309',
                            fontSize: '0.7rem', fontWeight: 600,
                            border: '1px solid rgba(245, 158, 11, 0.22)',
                          }}>
                            <Clock size={12} />
                            {lang === 'es' ? 'Activa' : 'Active'}
                          </span>
                        )}
                      </div>

                      {/* Description / due date row */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.875rem',
                        color: 'var(--text-secondary)',
                        fontSize: '0.85rem',
                        flexWrap: 'wrap',
                      }}>
                        {debt.due_date && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            color: overdue ? '#DC2626' : 'var(--text-secondary)',
                            fontWeight: overdue ? 600 : 500,
                          }}>
                            <Calendar size={13} />
                            {overdue
                              ? (lang === 'es' ? 'Venció: ' : 'Due: ')
                              : (lang === 'es' ? 'Vence: ' : 'Due: ')}
                            {formatDate(debt.due_date)}
                          </span>
                        )}
                        {debt.description && (
                          <span style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '380px',
                          }}>
                            {debt.description}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Amount block */}
                    <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      <div>
                        <div style={{
                          fontSize: '1.5rem',
                          fontWeight: 800,
                          color: amountColor,
                          lineHeight: 1.1,
                        }}>
                          {formatCurrency(debt.is_closed ? totalAmt : remainingAmt)}
                        </div>
                        {!debt.is_closed && totalAmt > 0 && remainingAmt !== totalAmt && (
                          <div style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                            marginTop: '0.18rem',
                          }}>
                            {lang === 'es' ? 'de ' : 'of '}{formatCurrency(totalAmt)}
                          </div>
                        )}
                      </div>
                      <ArrowRight size={18} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
                    </div>
                  </div>

                  {/* Progress bar */}
                  {!debt.is_closed && totalAmt > 0 && paidAmt > 0 && (
                    <div style={{ marginTop: '1rem' }}>
                      <div style={{
                        height: '6px',
                        background: 'var(--border-color)',
                        borderRadius: '999px',
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${paidPct}%`,
                          background: iOwe ? DEBTS_GRADIENT : OWED_GRADIENT,
                          borderRadius: '999px',
                          transition: 'width 0.5s ease',
                        }} />
                      </div>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '0.72rem',
                        color: 'var(--text-muted)',
                        marginTop: '0.375rem',
                      }}>
                        <span style={{ fontWeight: 600 }}>
                          {paidPct.toFixed(0)}% {lang === 'es' ? 'pagado' : 'paid'}
                        </span>
                        <span>
                          {lang === 'es' ? 'Pagado: ' : 'Paid: '}{formatCurrency(paidAmt)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Create modal ──────────────────────────────────────────────────── */}
      <UiModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setFormError(null) }}
        width="500px"
      >
        <form onSubmit={handleCreate}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: DEBTS_GRADIENT,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Wallet size={20} color="white" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>{t('debts.new')}</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                {lang === 'es' ? 'Registra una nueva deuda' : 'Register a new debt'}
              </p>
            </div>
          </div>

          {formError && (
            <div style={{
              margin: '1rem 1.5rem 0',
              padding: '0.75rem 0.875rem',
              borderRadius: '10px',
              background: 'rgba(239, 68, 68, 0.10)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#B91C1C',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem',
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>{formError}</span>
            </div>
          )}

          <UiModalBody>
            <div className="form-group">
              <UiField label={t('debts.modal.type')}>
                <UiSelect
                  value={direction}
                  onChange={(val) => setDirection(val as 'i_owe' | 'they_owe_me')}
                  options={[
                    { value: 'i_owe', label: t('debts.iOwe') },
                    { value: 'they_owe_me', label: t('debts.theyOweMe') },
                  ]}
                />
              </UiField>
            </div>

            <div className="form-group">
              <UiInput
                label={direction === 'i_owe' ? t('debts.modal.whoYouOwe') : t('debts.modal.whoOwesYou')}
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                placeholder={lang === 'es' ? 'Nombre' : 'Name'}
                required
              />
            </div>

            <div className="form-group">
              <UiNumber
                label={`${t('debts.amount')} (€)`}
                value={amount}
                onChange={(val: string) => setAmount(val)}
                placeholder="0.00"
                step="0.01"
                min={0}
                required
              />
            </div>

            <div className="form-group">
              <UiField label={t('debts.modal.dueDate')}>
                <UiDatePicker
                  value={dueDate}
                  onChange={(d) => setDueDate(d ? formatISODateString(d) : '')}
                />
              </UiField>
            </div>

            <div className="form-group">
              <UiTextarea
                label={t('debts.description')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('common.noDescription')}
                rows={3}
              />
            </div>
          </UiModalBody>
          <UiModalFooter>
            <button type="button" className="btn btn-secondary" onClick={() => { setShowModal(false); setFormError(null) }}>
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{
                background: DEBTS_GRADIENT,
                boxShadow: '0 4px 14px rgba(239, 68, 68, 0.35)',
                border: 'none',
              }}
            >
              {submitting ? t('common.loading') : t('debts.modal.create')}
            </button>
          </UiModalFooter>
        </form>
      </UiModal>
    </div>
  )
}
