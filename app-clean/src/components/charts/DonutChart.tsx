import { useMemo, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { PieChart as PieIcon, Disc, Circle, Activity, Grid } from 'lucide-react'

type ChartStyle = 'donut' | 'pie' | 'thin' | 'half' | 'spaced'

interface DonutChartProps {
  data: { name: string; value: number; color?: string }[]
  height?: number
  currency?: string
  locale?: string
  centerLabel?: string
  centerValue?: string
  thickness?: 'thin' | 'medium' | 'thick'
  showStyleSelector?: boolean
}

const PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f43f5e', '#0ea5e9', '#a855f7', '#84cc16']

const STORAGE_KEY = 'pref-chart-style'

const VALID_STYLES: ChartStyle[] = ['donut', 'pie', 'thin', 'half', 'spaced']

const getStoredStyle = (): ChartStyle => {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v && VALID_STYLES.includes(v as ChartStyle)) return v as ChartStyle
  } catch { /* ignore */ }
  return 'donut'
}

const STYLE_OPTIONS: { id: ChartStyle; Icon: React.ElementType; label: string }[] = [
  { id: 'donut',  Icon: Disc,    label: 'Donut' },
  { id: 'pie',    Icon: PieIcon, label: 'Tarta' },
  { id: 'thin',   Icon: Circle,  label: 'Anillo' },
  { id: 'half',   Icon: Activity, label: 'Semi' },
  { id: 'spaced', Icon: Grid,    label: 'Separado' },
]

const STYLE_CONFIG: Record<ChartStyle, {
  inner: string; outer: string; padding: number; start: number; end: number; cy: string
}> = {
  donut:  { inner: '65%', outer: '90%', padding: 3, start: 90,  end: -270, cy: '50%' },
  pie:    { inner: '0%',  outer: '90%', padding: 0, start: 90,  end: -270, cy: '50%' },
  thin:   { inner: '80%', outer: '90%', padding: 2, start: 90,  end: -270, cy: '50%' },
  half:   { inner: '65%', outer: '90%', padding: 3, start: 180, end: 0,    cy: '75%' },
  spaced: { inner: '65%', outer: '90%', padding: 8, start: 90,  end: -270, cy: '50%' },
}

const fmt = (n: number, currency = 'EUR', locale = 'es-ES') =>
  new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)

export function DonutChart({
  data,
  height = 260,
  currency = 'EUR',
  locale = 'es-ES',
  centerLabel,
  centerValue,
  showStyleSelector = true,
}: DonutChartProps) {
  const [chartStyle, setChartStyle] = useState<ChartStyle>(getStoredStyle)

  const total = useMemo(() => data.reduce((s, d) => s + Math.abs(d.value), 0), [data])

  const cfg = STYLE_CONFIG[chartStyle]
  const showCenter = chartStyle !== 'pie' && (centerLabel || centerValue || total > 0)

  const handleStyleChange = (style: ChartStyle) => {
    setChartStyle(style)
    try { localStorage.setItem(STORAGE_KEY, style) } catch { /* ignore */ }
  }

  const chartData = data.length ? data : [{ name: 'Sin datos', value: 1 }]
  const cellData = data.length ? data : [{ name: 'Sin datos', value: 1, color: 'var(--gray-200)' }]

  return (
    <div style={{ position: 'relative' }}>
      {showStyleSelector && (
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 2,
          marginBottom: 6,
        }}>
          {STYLE_OPTIONS.map(({ id, Icon, label }) => {
            const active = chartStyle === id
            return (
              <button
                key={id}
                onClick={() => handleStyleChange(id)}
                title={label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  border: active ? '1.5px solid var(--primary)' : '1.5px solid transparent',
                  background: active ? 'var(--primary-alpha, color-mix(in srgb, var(--primary) 15%, transparent))' : 'transparent',
                  color: active ? 'var(--primary)' : 'var(--text-muted, #94a3b8)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  padding: 0,
                }}
              >
                <Icon size={14} strokeWidth={active ? 2.5 : 2} />
              </button>
            )
          })}
        </div>
      )}

      <div className="chart-frame" style={{ height, position: 'relative' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              innerRadius={cfg.inner}
              outerRadius={cfg.outer}
              paddingAngle={data.length > 1 ? cfg.padding : 0}
              dataKey="value"
              startAngle={cfg.start}
              endAngle={cfg.end}
              cx="50%"
              cy={cfg.cy}
              stroke="none"
              isAnimationActive={true}
              animationDuration={400}
            >
              {cellData.map((entry, i) => (
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

        {showCenter && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: chartStyle === 'half' ? 'flex-end' : 'center',
            paddingBottom: chartStyle === 'half' ? '30%' : 0,
            pointerEvents: 'none',
            textAlign: 'center',
          }}>
            {centerLabel && (
              <span className="muted-sm" style={{ textTransform: 'uppercase', letterSpacing: 0.6, fontSize: 10 }}>
                {centerLabel}
              </span>
            )}
            {centerValue && (
              <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                {centerValue}
              </span>
            )}
            {!centerValue && total > 0 && (
              <span className="muted-sm" style={{ marginTop: 2 }}>{fmt(total, currency, locale)}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
