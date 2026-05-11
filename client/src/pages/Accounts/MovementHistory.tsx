import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from 'recharts'
import { Loader2, ArrowUpRight, ArrowDownRight, ExternalLink } from 'lucide-react'
import { api } from '../../lib/apiClient'
import { useI18n } from '../../hooks/useI18n'

interface Mov {
  id: string
  date: string
  kind: string
  amount: string | number
  description: string | null
  category_name?: string | null
  account_id?: string
}

interface Props {
  accountId: string
  organizationId?: string | null
  onClose: () => void
}

interface MonthBucket {
  month: string
  label: string
  income: number
  expense: number
  net: number
  [key: string]: any
}

function monthLabel(d: Date) {
  const month = d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')
  const year = d.getFullYear().toString().slice(2)
  return `${month} ${year}`
}

function buildTrend(movs: Mov[]): MonthBucket[] {
  const now = new Date()
  const buckets = new Map<string, MonthBucket>()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    buckets.set(key, { month: key, label: monthLabel(d), income: 0, expense: 0, net: 0 })
  }
  for (const m of movs) {
    const d = new Date(m.date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const b = buckets.get(key)
    if (!b) continue
    const amt = Number(m.amount) || 0
    if (m.kind === 'income') b.income += amt
    else if (m.kind === 'expense') b.expense += amt
  }
  for (const b of buckets.values()) {
    b.income = Math.round(b.income * 100) / 100
    b.expense = Math.round(b.expense * 100) / 100
    b.net = Math.round((b.income - b.expense) * 100) / 100
  }
  return [...buckets.values()]
}

export function MovementHistory({ accountId, organizationId, onClose }: Props) {
  const navigate = useNavigate()
  const { language } = useI18n()
  const [movs, setMovs] = useState<Mov[] | null>(null)
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    const params: Record<string, string> = { account_id: accountId, limit: '500' }
    if (organizationId) params.org_id = organizationId
    api.get<{ data: Mov[] }>('/api/v1/movements', params)
      .then(d => { if (!cancelled) { setMovs(d.data || []); setStatus('ok') } })
      .catch(e => { if (!cancelled) { setErr((e as Error).message); setStatus('error') } })
    return () => { cancelled = true }
  }, [accountId, organizationId])

  const fmt = (v: number) =>
    new Intl.NumberFormat(language === 'es' ? 'es-ES' : 'en-US', {
      style: 'currency', currency: 'EUR',
    }).format(v || 0)

  const trend = useMemo(() => movs ? buildTrend(movs) : [], [movs])
  const recent = useMemo(() => (movs ?? []).slice(0, 10), [movs])
  const hasData = (movs?.length ?? 0) > 0

  const goToMovements = () => {
    onClose()
    navigate('/app/movements')
  }

  if (status === 'loading') {
    return (
      <div style={{
        padding: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: '10px', color: 'var(--text-muted, #6b7280)',
      }}>
        <Loader2 className="animate-spin" size={18} /> Cargando movimientos…
      </div>
    )
  }
  if (status === 'error') {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--danger, #ef4444)', fontSize: '13px' }}>
        Error: {err}
      </div>
    )
  }
  if (!hasData) {
    return (
      <div style={{
        padding: '40px 32px', textAlign: 'center', color: 'var(--text-muted, #6b7280)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
      }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary, #111827)' }}>
          Aún no hay movimientos en esta cuenta
        </div>
        <div style={{ fontSize: '12px', maxWidth: '420px', lineHeight: 1.5 }}>
          Registra un ingreso o gasto desde la pestaña Movimientos y aparecerá aquí su histórico.
        </div>
        <button className="btn btn-primary btn-sm" style={{ marginTop: '10px' }} onClick={goToMovements}>
          Ir a Movimientos
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
      <div>
        <div style={{
          fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #6b7280)',
          textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px',
        }}>Últimos 12 meses</div>
        <div style={{ width: '100%', height: '260px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="incGradG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="expGradG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted, #6b7280)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted, #6b7280)' }} width={50}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
              <Tooltip content={<TrendTooltip fmt={fmt} />} />
              <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={1.5}
                fill="url(#incGradG)" name="Ingresos" />
              <Area type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={1.5}
                fill="url(#expGradG)" name="Gastos" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px',
        }}>
          <div style={{
            fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #6b7280)',
            textTransform: 'uppercase', letterSpacing: '0.6px',
          }}>Últimos {recent.length} movimientos</div>
          <button onClick={goToMovements} style={{
            background: 'transparent', border: 'none', color: 'var(--primary, #6366f1)',
            cursor: 'pointer', fontSize: '11px', fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', gap: '4px',
          }}>
            Ver todos <ExternalLink size={11} />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {recent.map(m => <MovRow key={m.id} m={m} fmt={fmt} />)}
        </div>
      </div>
    </div>
  )
}

function TrendTooltip({ active, payload, label, fmt }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div style={{
      background: 'rgba(15,15,30,0.95)', border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: '8px', padding: '8px 10px', fontSize: '11px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)', color: '#fff',
    }}>
      <div style={{ fontWeight: 700, marginBottom: '4px' }}>{label}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
        <span style={{ color: '#10b981' }}>Ingresos</span><span style={{ fontWeight: 600 }}>{fmt(p.income)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
        <span style={{ color: '#ef4444' }}>Gastos</span><span style={{ fontWeight: 600 }}>{fmt(p.expense)}</span>
      </div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', gap: '10px',
        marginTop: '4px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.1)',
      }}>
        <span style={{ opacity: 0.6 }}>Neto</span>
        <span style={{ fontWeight: 700, color: p.net >= 0 ? '#10b981' : '#ef4444' }}>
          {p.net >= 0 ? '+' : ''}{fmt(p.net)}
        </span>
      </div>
    </div>
  )
}

function MovRow({ m, fmt }: { m: Mov; fmt: (n: number) => string }) {
  const isIncome = m.kind === 'income'
  const color = isIncome ? '#10b981' : m.kind === 'expense' ? '#ef4444' : '#6366f1'
  const Icon = isIncome ? ArrowUpRight : ArrowDownRight
  const dateStr = new Date(m.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '8px 10px', borderRadius: '8px',
      background: 'rgba(0,0,0,0.02)', border: '1px solid var(--border, rgba(0,0,0,0.06))',
    }}>
      <div style={{
        width: '26px', height: '26px', borderRadius: '6px', flexShrink: 0,
        background: `${color}14`, border: `1px solid ${color}33`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', color,
      }}>
        <Icon size={13} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          fontSize: '13px', fontWeight: 600,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {m.description || m.category_name || (isIncome ? 'Ingreso' : 'Gasto')}
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-muted, #6b7280)', marginTop: '1px' }}>
          {dateStr}{m.category_name ? ` · ${m.category_name}` : ''}
        </div>
      </div>
      <div style={{
        fontSize: '14px', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
        color, whiteSpace: 'nowrap',
      }}>
        {isIncome ? '+' : '−'}{fmt(Math.abs(Number(m.amount) || 0))}
      </div>
    </div>
  )
}
