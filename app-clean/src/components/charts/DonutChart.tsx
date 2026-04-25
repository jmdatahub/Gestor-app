import { useMemo } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

interface DonutChartProps {
  data: { name: string; value: number; color?: string }[]
  height?: number
  currency?: string
  locale?: string
  centerLabel?: string
  centerValue?: string
  thickness?: 'thin' | 'medium' | 'thick'
}

const PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f43f5e', '#0ea5e9', '#a855f7', '#84cc16']

const fmt = (n: number, currency = 'EUR', locale = 'es-ES') =>
  new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)

export function DonutChart({ data, height = 260, currency = 'EUR', locale = 'es-ES', centerLabel, centerValue, thickness = 'medium' }: DonutChartProps) {
  const total = useMemo(() => data.reduce((s, d) => s + Math.abs(d.value), 0), [data])

  const inner = thickness === 'thin' ? 75 : thickness === 'thick' ? 55 : 65
  const outer = 90

  return (
    <div className="chart-frame" style={{ height, position: 'relative' }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data.length ? data : [{ name: 'Sin datos', value: 1 }]}
            innerRadius={`${inner}%`}
            outerRadius={`${outer}%`}
            paddingAngle={data.length > 1 ? 3 : 0}
            dataKey="value"
            stroke="none"
          >
            {(data.length ? data : [{ name: 'Sin datos', value: 1, color: 'var(--gray-200)' }]).map((entry, i) => (
              <Cell key={`cell-${i}`} fill={entry.color ?? PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          {data.length > 0 && (
            <Tooltip
              formatter={(value: any, name: any) => [fmt(Number(value) || 0, currency, locale), String(name)]}
              contentStyle={{
                borderRadius: 12,
                border: '1px solid var(--border-color)',
                boxShadow: 'var(--shadow-lg)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
              }}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
      {(centerLabel || centerValue) && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          textAlign: 'center',
        }}>
          {centerLabel && <span className="muted-sm" style={{ textTransform: 'uppercase', letterSpacing: 0.6, fontSize: 10 }}>{centerLabel}</span>}
          {centerValue && <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{centerValue}</span>}
          {!centerValue && total > 0 && <span className="muted-sm" style={{ marginTop: 2 }}>{fmt(total, currency, locale)}</span>}
        </div>
      )}
    </div>
  )
}
