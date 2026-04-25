import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface ComparisonPoint {
  period: string
  current: number
  previous: number
}

interface ComparisonBarsProps {
  data: ComparisonPoint[]
  currentLabel?: string
  previousLabel?: string
  currency?: string
  locale?: string
  height?: number
  tone?: 'positive' | 'negative' | 'neutral'
}

const fmt = (n: number, currency = 'EUR', locale = 'es-ES') =>
  new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)

const compact = (n: number, locale = 'es-ES') =>
  new Intl.NumberFormat(locale, { notation: 'compact', compactDisplay: 'short', maximumFractionDigits: 1 }).format(n)

const TONE_MAP = {
  positive: { current: '#10b981', previous: '#a7f3d0' },
  negative: { current: '#ef4444', previous: '#fecaca' },
  neutral: { current: '#6366f1', previous: '#c7d2fe' },
}

function Tip(props: { active?: boolean; payload?: any[]; label?: string; currency?: string; locale?: string }) {
  const { active, payload, label, currency = 'EUR', locale = 'es-ES' } = props
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip__label">{label}</div>
      {payload.map((p: any) => (
        <div key={String(p.dataKey)} className="chart-tooltip__row">
          <span className="chart-tooltip__row-label">
            <span className="chart-legend__dot" style={{ background: p.color }} />
            {String(p.name)}
          </span>
          <span className="chart-tooltip__row-value">{fmt(Number(p.value ?? 0), currency, locale)}</span>
        </div>
      ))}
    </div>
  )
}

export function ComparisonBars({
  data,
  currentLabel = 'Actual',
  previousLabel = 'Anterior',
  currency = 'EUR',
  locale = 'es-ES',
  height = 260,
  tone = 'neutral',
}: ComparisonBarsProps) {
  const colors = TONE_MAP[tone]
  return (
    <div className="chart-frame" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
          <XAxis dataKey="period" tickLine={false} axisLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} dy={6} />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
            tickFormatter={(v) => compact(Number(v), locale)}
            width={54}
          />
          <Tooltip cursor={{ fill: 'var(--gray-100)', opacity: 0.35 }} content={<Tip currency={currency} locale={locale} />} />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} iconType="circle" iconSize={8} />
          <Bar dataKey="previous" name={previousLabel} fill={colors.previous} radius={[6, 6, 0, 0]} />
          <Bar dataKey="current" name={currentLabel} fill={colors.current} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
