import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, Tag } from 'lucide-react'
import { UiModal, UiModalHeader, UiModalBody } from '../ui/UiModal'
import { CategoryPicker } from './CategoryPicker'
import { fetchPendingClassificationMovements, updateMovement, type Movement } from '../../services/movementService'
import { useWorkspace } from '../../context/WorkspaceContext'
import { supabase } from '../../lib/supabaseClient'
import { useQueryClient } from '@tanstack/react-query'
import { movementKeys } from '../../hooks/queries/useDashboardMovements'
import { dashboardKeys } from '../../hooks/queries/useDashboardAccounts'
import { trendKeys } from '../../hooks/queries/useDashboardTrend'
import { useToast } from '../Toast'

interface Props {
  isOpen: boolean
  onClose: () => void
}

function formatAmount(amount: number, kind: string) {
  const sign = kind === 'income' ? '+' : kind === 'expense' ? '-' : ''
  return `${sign}${amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
}

function formatDateShort(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function ClassifyMovementsModal({ isOpen, onClose }: Props) {
  const { currentWorkspace } = useWorkspace()
  const queryClient = useQueryClient()
  const toast = useToast()

  const [userId, setUserId] = useState<string | null>(null)
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [allDone, setAllDone] = useState(false)

  const workspaceId = currentWorkspace?.id || null

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
  }, [])

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const data = await fetchPendingClassificationMovements(userId, workspaceId)
      setMovements(data)
      setAllDone(data.length === 0)
    } finally {
      setLoading(false)
    }
  }, [userId, workspaceId])

  useEffect(() => {
    if (isOpen && userId) load()
  }, [isOpen, userId, load])

  const handleCategoryChange = async (mov: Movement, categoryId: string) => {
    if (!categoryId || savingId) return
    setSavingId(mov.id)
    try {
      await updateMovement(mov.id, { category_id: categoryId })
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
      queryClient.invalidateQueries({ queryKey: movementKeys.all })
      queryClient.invalidateQueries({ queryKey: trendKeys.all })
      const remaining = movements.filter(m => m.id !== mov.id)
      setMovements(remaining)
      if (remaining.length === 0) setAllDone(true)
      toast.success('Categoría asignada', 'El movimiento ha sido clasificado.')
    } catch {
      toast.error('Error', 'No se pudo guardar la categoría.')
    } finally {
      setSavingId(null)
    }
  }

  const kindLabel: Record<string, string> = {
    income: 'Ingreso',
    expense: 'Gasto',
    investment: 'Inversión',
  }

  const kindClass: Record<string, string> = {
    income: 'pill pill--success',
    expense: 'pill pill--danger',
    investment: 'pill pill--primary',
  }

  return (
    <UiModal isOpen={isOpen} onClose={onClose} width="3xl" closeOnOutsideClick={false}>
      <UiModalHeader title={`Movimientos sin clasificar${movements.length > 0 ? ` (${movements.length})` : ''}`} onClose={onClose} />
      <UiModalBody>
        {loading && (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
            Cargando movimientos…
          </div>
        )}

        {!loading && allDone && (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            <CheckCircle size={48} color="var(--color-success)" />
            <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-text)' }}>¡Todo clasificado!</p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Todos los movimientos tienen una categoría asignada.</p>
          </div>
        )}

        {!loading && !allDone && movements.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '60vh', overflowY: 'auto', paddingRight: '0.25rem' }}>
            {movements.map(mov => (
              <div
                key={mov.id}
                style={{
                  background: 'var(--color-surface-alt, var(--color-surface))',
                  border: '1px solid var(--color-border)',
                  borderRadius: '0.75rem',
                  padding: '0.875rem 1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  opacity: savingId === mov.id ? 0.5 : 1,
                  transition: 'opacity 0.2s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span className={kindClass[mov.kind] || 'pill'}>{kindLabel[mov.kind] || mov.kind}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{formatDateShort(mov.date)}</span>
                    {mov.account && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>· {mov.account.name}</span>
                    )}
                  </div>
                  <span style={{
                    fontWeight: 700,
                    fontSize: '1rem',
                    color: mov.kind === 'income' ? 'var(--color-success)' : mov.kind === 'expense' ? 'var(--color-danger)' : 'var(--color-primary)',
                  }}>
                    {formatAmount(mov.amount, mov.kind)}
                  </span>
                </div>

                {mov.description && (
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-text)', margin: 0 }}>{mov.description}</p>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Tag size={14} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <CategoryPicker
                      value={mov.category_id}
                      onChange={(catId) => handleCategoryChange(mov, catId)}
                      type={mov.kind === 'income' ? 'income' : 'expense'}
                      label=""
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </UiModalBody>
    </UiModal>
  )
}
