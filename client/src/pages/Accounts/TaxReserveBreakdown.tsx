import { useEffect, useMemo, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { fetchTaxBreakdown, type TaxReserveBreakdown as TaxReserveBreakdownData, type TaxReserveBreakdownItem } from '../../services/accountService'
import { useI18n } from '../../hooks/useI18n'
import { Stat } from './AccountDetailStat'

const PALETTE = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6',
  '#f43f5e', '#0ea5e9', '#a855f7', '#84cc16', '#06b6d4', '#f97316',
]

interface SliceItem extends TaxReserveBreakdownItem {
  color: string
  [key: string]: any
}

interface Props {
  accountId: string
  accountBalance: number
}

export function TaxReserveBreakdown({ accountId, accountBalance }: Props) {
  const { language } = useI18n()
  const [data, setData] = useState<TaxReserveBreakdownData | null>(null)
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [err, setErr] = useState<string | null>(null)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    fetchTaxBreakdown(accountId)
      .then(d => { if (!cancelled) { setData(d); setStatus('ok') } })
      .catch(e => { if (!cancelled) { setErr((e as Error).message); setStatus('error') } })
    return () => { cancelled = true }
  }, [accountId])

  const fmt = (v: number) =>
    new Intl.NumberFormat(language === 'es' ? 'es-ES' : 'en-US', {
      style: 'currency', currency: 'EUR',
    }).format(v || 0)

  const { sliceData, listItems } = useMemo(() => {
    if (!data) return { sliceData: [] as SliceItem[], listItems: [] as SliceItem[] }
    const projectColors: Record<string, string> = {}
    let pIdx = 0
    const list: SliceItem[] = data.items.map((it, idx) => {
      const key = it.project?.id || `mov_${it.transaction_id || idx}`
      if (!(key in projectColors)) {
        projectColors[key] = PALETTE[pIdx % PALETTE.length]; pIdx++
      }
      return { ...it, color: projectColors[key] }
    })
    const big = list.filter(i => i.pct >= 2)
    const small = list.filter(i => i.pct < 2)
    const slice = [...big]
    if (small.length > 0) {
      const otherTotal = small.reduce((s, i) => s + i.irpf_contribution, 0)
      const otherPct = small.reduce((s, i) => s + i.pct, 0)
      slice.push({
        transaction_id: '__other__', date: '', amount: 0,
        description: `${small.length} movimientos pequeños`,
        irpf_contribution: Math.round(otherTotal * 100) / 100,
        pct: Math.round(otherPct * 10) / 10,
        project: null, color: '#64748b',
      })
    }
    return { sliceData: slice, listItems: list }
  }, [data])

  const totalReserved = data?.total_reserved ?? 0
  const balance = data?.account_balance ?? accountBalance
  const delta = data?.delta ?? balance - totalReserved
  const deltaAbs = Math.abs(delta)
  const isExcess = delta > 0.01
  const isShort = delta < -0.01

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '18px' }}>
        <Stat label="Saldo real en cuenta" value={fmt(balance)} hint="Calculado de los movimientos" />
        <Stat label="Reservado (movimientos)" value={fmt(totalReserved)} hint="Suma de ingresos a esta cuenta" accent="#6366f1" />
        <Stat
          label={isExcess ? 'Excedente sin imputar' : isShort ? 'Falta por reservar' : 'Reconciliado'}
          value={fmt(deltaAbs)}
          hint={isExcess ? 'Saldo > ingresos contabilizados' : isShort ? 'Ingresos > saldo' : 'Cuadra perfectamente'}
          icon={isExcess
            ? <CheckCircle2 size={13} style={{ color: '#10b981' }} />
            : isShort
            ? <AlertTriangle size={13} style={{ color: '#f59e0b' }} />
            : <CheckCircle2 size={13} style={{ color: '#10b981' }} />}
        />
      </div>

      {status === 'loading' && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '40px', gap: '10px', color: 'var(--text-muted, #6b7280)',
        }}>
          <Loader2 className="animate-spin" size={18} /> Calculando desglose…
        </div>
      )}
      {status === 'error' && (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--danger, #ef4444)', fontSize: '13px' }}>Error: {err}</div>
      )}
      {status === 'ok' && data && data.items.length === 0 && (
        <div style={{
          padding: '40px 32px', textAlign: 'center',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-muted, #6b7280)',
        }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary, #111827)' }}>
            Aún no hay movimientos en esta cuenta
          </div>
          <div style={{ fontSize: '12px', marginTop: '6px', maxWidth: '420px', lineHeight: 1.5 }}>
            Cuando hagas una transferencia o registres un ingreso, aparecerá aquí su porción del pie.
          </div>
        </div>
      )}
      {status === 'ok' && data && data.items.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px' }}>
          <div style={{ position: 'relative', height: '280px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sliceData}
                  dataKey="irpf_contribution" nameKey="transaction_id"
                  cx="50%" cy="50%" innerRadius={70} outerRadius={120} paddingAngle={2}
                  stroke="rgba(0,0,0,0.2)" strokeWidth={1}
                  onMouseEnter={(_, idx) => setHoverIdx(idx)}
                  onMouseLeave={() => setHoverIdx(null)}
                >
                  {sliceData.map((s, idx) => (
                    <Cell key={s.transaction_id} fill={s.color}
                      opacity={hoverIdx === null || hoverIdx === idx ? 1 : 0.4} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip fmt={fmt} />} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none',
            }}>
              <div style={{
                fontSize: '10px', textTransform: 'uppercase', fontWeight: 600,
                letterSpacing: '0.6px', color: 'var(--text-muted, #6b7280)',
              }}>Total</div>
              <div style={{ fontSize: '18px', fontWeight: 800, marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
                {fmt(totalReserved)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted, #6b7280)', marginTop: '2px' }}>
                {data.items.length} {data.items.length === 1 ? 'movimiento' : 'movimientos'}
              </div>
            </div>
          </div>
          <div style={{ maxHeight: '320px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {listItems.map(it => (
              <Row key={it.transaction_id} item={it} fmt={fmt}
                highlighted={hoverIdx !== null && sliceData[hoverIdx]?.transaction_id === it.transaction_id}
                onHover={() => { const idx = sliceData.findIndex(s => s.transaction_id === it.transaction_id); if (idx >= 0) setHoverIdx(idx) }}
                onLeave={() => setHoverIdx(null)} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function PieTooltip({ active, payload, fmt }: any) {
  if (!active || !payload?.[0]) return null
  const p = payload[0].payload as SliceItem
  return (
    <div style={{
      background: 'rgba(15,15,30,0.95)', border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: '8px', padding: '10px 12px', fontSize: '12px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)', minWidth: '200px', color: '#fff',
    }}>
      <div style={{ fontWeight: 700, marginBottom: '4px' }}>
        {p.project ? p.project.name : (p.description || 'Movimiento')}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
        <span style={{ opacity: 0.6 }}>Importe</span>
        <span style={{ fontWeight: 700, color: '#6366f1' }}>{fmt(p.irpf_contribution)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
        <span style={{ opacity: 0.6 }}>% del total</span>
        <span style={{ fontWeight: 600 }}>{p.pct.toFixed(1)}%</span>
      </div>
    </div>
  )
}

function Row({ item, fmt, highlighted, onHover, onLeave }: {
  item: SliceItem; fmt: (n: number) => string; highlighted: boolean
  onHover: () => void; onLeave: () => void
}) {
  const dateStr = item.date ? new Date(item.date).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
  }) : ''
  return (
    <div onMouseEnter={onHover} onMouseLeave={onLeave} style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '10px 12px', borderRadius: '8px',
      background: highlighted ? 'rgba(99,102,241,0.08)' : 'transparent',
      border: `1px solid ${highlighted ? 'rgba(99,102,241,0.3)' : 'var(--border, rgba(0,0,0,0.06))'}`,
      transition: 'background 0.15s, border-color 0.15s',
    }}>
      <span style={{
        width: '8px', height: '8px', borderRadius: '50%',
        background: item.color, flexShrink: 0,
        boxShadow: highlighted ? `0 0 10px ${item.color}` : 'none',
      }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          fontSize: '13px', fontWeight: 600,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {item.project ? item.project.name : (item.description || 'Movimiento')}
        </div>
        <div style={{
          fontSize: '11px', color: 'var(--text-muted, #6b7280)', marginTop: '1px',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {dateStr}{item.project?.display_id ? ` · ${item.project.display_id}` : ''}
        </div>
      </div>
      <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: '#6366f1' }}>{fmt(item.irpf_contribution)}</div>
        <div style={{ fontSize: '10px', color: 'var(--text-muted, #6b7280)', marginTop: '1px' }}>{item.pct.toFixed(1)}%</div>
      </div>
    </div>
  )
}
