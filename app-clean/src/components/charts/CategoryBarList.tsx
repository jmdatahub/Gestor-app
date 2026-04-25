import { useMemo } from 'react'

interface CategoryBarListProps {
  data: { name: string; value: number; color?: string }[]
  max?: number
  currency?: string
  locale?: string
  emptyLabel?: string
}

const PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f43f5e', '#0ea5e9', '#a855f7', '#84cc16']

const fmt = (n: number, currency = 'EUR', locale = 'es-ES') =>
  new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)

export function CategoryBarList({ data, max = 7, currency = 'EUR', locale = 'es-ES', emptyLabel }: CategoryBarListProps) {
  const { rows, total } = useMemo(() => {
    const sorted = [...data].sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    const head = sorted.slice(0, max)
    const rest = sorted.slice(max)
    const restSum = rest.reduce((s, r) => s + r.value, 0)
    const all = restSum !== 0 ? [...head, { name: 'Otros', value: restSum }] : head
    const total = all.reduce((s, r) => s + Math.abs(r.value), 0) || 1
    return { rows: all, total }
  }, [data, max])

  if (rows.length === 0) {
    return <div className="muted" style={{ padding: '16px 0', textAlign: 'center' }}>{emptyLabel ?? 'Sin datos'}</div>
  }

  return (
    <div className="bar-group-list">
      {rows.map((row, idx) => {
        const pct = (Math.abs(row.value) / total) * 100
        const color = row.color ?? PALETTE[idx % PALETTE.length]
        return (
          <div className="bar-group" key={row.name + idx}>
            <span className="bar-group__label" title={row.name}>{row.name}</span>
            <div className="bar-group__track">
              <div
                className="bar-group__fill"
                style={{
                  width: `${Math.max(2, pct)}%`,
                  background: `linear-gradient(90deg, ${color}cc, ${color})`,
                }}
              />
            </div>
            <span className="bar-group__value">{fmt(row.value, currency, locale)}</span>
          </div>
        )
      })}
    </div>
  )
}
