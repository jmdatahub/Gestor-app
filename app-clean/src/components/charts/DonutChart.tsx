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
  thickness?: 'thin' | 'medium' | 'thick' // kept for API compat
  showStyleSelector?: boolean
}

const PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f43f5e', '#0ea5e9', '#a855f7', '#84cc16']
const STORAGE_KEY = 'pref-chart-style'
const VALID_STYLES: ChartStyle[] = ['donut', 'pie', 'thin', 'half', 'spaced']

function getStoredStyle(): ChartStyle {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v && VALID_STYLES.includes(v as ChartStyle)) return v as ChartStyle
  } catch { /* ignore */ }
  return 'donut'
}

// cy = geometric center as % of chart height
// For 'half': cy=65% → arc occupies top 65%, leaving 35% below for the label
const CONFIGS: Record<ChartStyle, {
  inner: string; outer: string; padding: number; start: number; end: number; cy: string
}> = {
  donut:  { inner: '60%', outer: '86%', padding: 3, start: 90,  end: -270, cy: '50%' },
  pie:    { inner: '0%',  outer: '86%', padding: 0, start: 90,  end: -270, cy: '50%' },
  thin:   { inner: '76%', outer: '86%', padding: 2, start: 90,  end: -270, cy: '50%' },
  half:   { inner: '60%', outer: '86%', padding: 3, start: 180, end: 0,    cy: '65%' },
  spaced: { inner: '60%', outer: '86%', padding: 7, start: 90,  end: -270, cy: '50%' },
}

const STYLE_OPTIONS: { id: ChartStyle; Icon: React.ElementType; label: string }[] = [
  { id: 'donut',  Icon: Disc,     label: 'Donut' },
  { id: 'pie',    Icon: PieIcon,  label: 'Tarta' },
  { id: 'thin',   Icon: Circle,   label: 'Anillo' },
  { id: 'half',   Icon: Activity, label: 'Semicírculo' },
  { id: 'spaced', Icon: Grid,     label: 'Separado' },
]

const fmt = (n: number, currency = 'EUR', locale = 'es-ES') =>
  new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)

// Shared label renderer
function CenterLabel({ label, value }: { label?: string; value?: string }) {
  return (
    <>
      {label && (
        <span style={{
          display: 'block',
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: '#94a3b8',
          lineHeight: 1,
        }}>
          {label}
        </span>
      )}
      {value && (
        <span style={{
          display: 'block',
          fontSize: 20,
          fontWeight: 700,
          color: 'var(--text-primary, #f1f5f9)',
          marginTop: label ? 5 : 0,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}>
          {value}
        </span>
      )}
    </>
  )
}

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
  const [fade, setFade] = useState(false)

  const total = useMemo(() => data.reduce((s, d) => s + Math.abs(d.value), 0), [data])

  const cfg = CONFIGS[chartStyle]
  const isHalf = chartStyle === 'half'
  const isPie  = chartStyle === 'pie'

  const displayLabel = centerLabel
  const displayValue = centerValue ?? (total > 0 ? fmt(total, currency, locale) : undefined)

  const handleStyleChange = (style: ChartStyle) => {
    if (style === chartStyle) return
    setFade(true)
    setTimeout(() => {
      setChartStyle(style)
      try { localStorage.setItem(STORAGE_KEY, style) } catch { /* ignore */ }
      setTimeout(() => setFade(false), 30)
    }, 160)
  }

  const chartData = data.length ? data : [{ name: 'Sin datos', value: 1 }]
  const cellData  = data.length ? data : [{ name: 'Sin datos', value: 1, color: 'var(--gray-200)' }]

  return (
    <div>
      {/* ── Selector ── */}
      {showStyleSelector && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 3, marginBottom: 8 }}>
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
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  border: `1.5px solid ${active ? 'var(--primary, #6366f1)' : 'transparent'}`,
                  background: active ? 'rgba(99,102,241,0.15)' : 'transparent',
                  color: active ? 'var(--primary, #6366f1)' : '#64748b',
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                  padding: 0,
                  outline: 'none',
                }}
              >
                <Icon size={14} strokeWidth={active ? 2.5 : 2} />
              </button>
            )
          })}
        </div>
      )}

      {/* ── Chart + label container ── */}
      <div
        style={{
          position: 'relative',
          opacity: fade ? 0 : 1,
          transition: 'opacity 0.16s ease',
        }}
      >
        {/* Chart frame */}
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
                animationDuration={500}
                animationEasing="ease-out"
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
                    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    padding: '8px 12px',
                  }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                />
              )}
            </PieChart>
          </ResponsiveContainer>

          {/* Center label: donut / thin / spaced — centered in hole */}
          {!isPie && !isHalf && (displayLabel || displayValue) && (
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
              <CenterLabel label={displayLabel} value={displayValue} />
            </div>
          )}

          {/* Center label: half — positioned below arc baseline (cy=65%, label at ~72%) */}
          {isHalf && (displayLabel || displayValue) && (
            <div style={{
              position: 'absolute',
              left: '50%',
              top: '68%',
              transform: 'translateX(-50%)',
              textAlign: 'center',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}>
              <CenterLabel label={displayLabel} value={displayValue} />
            </div>
          )}
        </div>

        {/* Label below chart: pie mode */}
        {isPie && (displayLabel || displayValue) && (
          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <CenterLabel label={displayLabel} value={displayValue} />
          </div>
        )}
      </div>
    </div>
  )
}
