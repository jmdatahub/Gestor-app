import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Pencil, Trash2, Receipt, Wallet, PiggyBank, TrendingUp, Coins, Building2,
  Power, PowerOff, Loader2, ArrowUpRight, ExternalLink,
} from 'lucide-react'
import { UiModal, UiModalHeader, UiModalBody } from '../../components/ui/UiModal'
import { useI18n } from '../../hooks/useI18n'
import { Stat } from './AccountDetailStat'
import { TaxReserveBreakdown } from './TaxReserveBreakdown'
import { MovementHistory } from './MovementHistory'
import type { AccountWithBalance } from '../../services/accountService'

const TYPE_ICONS: Record<string, any> = {
  general:    Wallet,
  cash:       Coins,
  checking:   Building2,
  bank:       Building2,
  savings:    PiggyBank,
  broker:     TrendingUp,
  investment: TrendingUp,
}

interface Props {
  account: AccountWithBalance
  organizationId?: string | null
  isOpen: boolean
  onClose: () => void
  onEdit: () => void
  onDelete?: () => Promise<void>
  onToggleActive?: () => Promise<void>
}

export function AccountDetailModal({
  account, organizationId, isOpen, onClose, onEdit, onDelete, onToggleActive,
}: Props) {
  const navigate = useNavigate()
  const { language } = useI18n()
  const [confirmDel, setConfirmDel] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [togglingActive, setTogglingActive] = useState(false)

  useEffect(() => { if (!isOpen) setConfirmDel(false) }, [isOpen])

  const Icon = TYPE_ICONS[account.type] || Wallet
  const isTaxReserve = !!account.is_tax_reserve
  const balance = Number(account.balance) || 0
  const accent = isTaxReserve ? '#6366f1' : (account.color || '#6366f1')

  const fmt = (v: number) =>
    new Intl.NumberFormat(language === 'es' ? 'es-ES' : 'en-US', {
      style: 'currency', currency: 'EUR',
    }).format(v || 0)

  const doDelete = async () => {
    if (!onDelete) return
    if (!confirmDel) { setConfirmDel(true); return }
    setDeleting(true)
    try { await onDelete(); onClose() }
    finally { setDeleting(false) }
  }
  const doToggleActive = async () => {
    if (!onToggleActive) return
    setTogglingActive(true)
    try { await onToggleActive() } finally { setTogglingActive(false) }
  }

  const goToFullPage = () => { onClose(); navigate(`/app/accounts/${account.id}`) }
  const goToInvestments = () => { onClose(); navigate('/app/investments') }

  const accountType: string = account.type
  const isInvestmentType = accountType === 'broker' || accountType === 'investment'

  return (
    <UiModal isOpen={isOpen} onClose={onClose} width="4xl">
      <UiModalHeader>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
              background: `${accent}14`, border: `1px solid ${accent}33`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent,
            }}>
              {isTaxReserve ? <Receipt size={18} /> : <Icon size={18} />}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: '15px', fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                {account.name}
                {!account.is_active && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: '2px 6px',
                    background: 'rgba(239,68,68,0.15)', color: '#ef4444',
                    borderRadius: 4, textTransform: 'uppercase',
                  }}>Inactiva</span>
                )}
                {isTaxReserve && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: '2px 6px',
                    background: 'rgba(99,102,241,0.15)', color: '#4f46e5',
                    borderRadius: 4, textTransform: 'uppercase',
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}><Receipt size={10} /> Reserva</span>
                )}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted, #6b7280)', marginTop: '1px' }}>
                {account.type}
                {account.currency && account.currency !== 'EUR' ? ` · ${account.currency}` : ''}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {onToggleActive && (
              <button onClick={doToggleActive} disabled={togglingActive} className="btn btn-secondary btn-sm" style={btnStyle}>
                {togglingActive
                  ? <Loader2 className="animate-spin" size={13} />
                  : (account.is_active ? <PowerOff size={13} /> : <Power size={13} />)}
                {account.is_active ? 'Desactivar' : 'Activar'}
              </button>
            )}
            <button onClick={onEdit} className="btn btn-secondary btn-sm" style={btnStyle}>
              <Pencil size={13} /> Editar
            </button>
            {onDelete && (
              <button onClick={doDelete} disabled={deleting} className="btn btn-secondary btn-sm" style={{
                ...btnStyle,
                background: confirmDel ? 'rgba(239,68,68,0.15)' : undefined,
                borderColor: confirmDel ? 'rgba(239,68,68,0.5)' : undefined,
                color: '#ef4444',
              }}>
                {deleting ? <Loader2 className="animate-spin" size={13} /> : <Trash2 size={13} />}
                {confirmDel ? '¿Seguro?' : 'Eliminar'}
              </button>
            )}
            <button onClick={goToFullPage} className="btn btn-secondary btn-sm" style={btnStyle} title="Ver página completa">
              <ExternalLink size={13} />
            </button>
          </div>
        </div>
      </UiModalHeader>
      <UiModalBody>
        {isTaxReserve ? (
          <TaxReserveBreakdown accountId={account.id} accountBalance={balance} />
        ) : (
          <>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '18px',
            }}>
              <Stat label="Saldo actual" value={fmt(balance)} accent={accent} />
              <Stat label="Tipo" value={account.type} hint={account.currency || 'EUR'} />
              <Stat label="Estado" value={account.is_active ? 'Activa' : 'Inactiva'}
                accent={account.is_active ? '#10b981' : '#ef4444'} />
              <Stat label="Sub-cuentas" value={account.is_parent ? `${account.pending_movements_count ?? 0} pdtes.` : '—'}
                hint={account.is_parent ? 'Movimientos por reasignar' : 'No es cuenta padre'} />
            </div>
            {isInvestmentType && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                padding: '10px 14px', borderRadius: '8px', marginBottom: '14px',
                background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.18)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted, #6b7280)' }}>
                  <TrendingUp size={14} style={{ color: '#6366f1' }} />
                  Esta cuenta es de inversión — ve a la sección dedicada para gestionar posiciones.
                </div>
                <button className="btn btn-primary btn-sm" onClick={goToInvestments} style={btnStyle}>
                  Ir a Inversiones <ArrowUpRight size={13} />
                </button>
              </div>
            )}
            <MovementHistory accountId={account.id} organizationId={organizationId} onClose={onClose} />
          </>
        )}
      </UiModalBody>
    </UiModal>
  )
}

const btnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '6px',
}
