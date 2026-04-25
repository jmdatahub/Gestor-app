import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useI18n } from '../../hooks/useI18n'

interface AreaPoint {
  period: string
  income: number
  expense: number
  net?: number
}

interface AreaTrendChartProps {
  data: AreaPoint[]
  height?: number
  showNet?: boolean
  currency?: string
  locale?: string
}

const fmt = (n: number, currency = 'EUR', locale = 'es-ES') =>
  new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)

const compact = (n: number, locale = 'es-ES') =>
  new Intl.NumberFormat(locale, { notation: 'compact', compactDisplay: 'short', maximumFractionDigits: 1 }).format(n)

function CustomTooltip(props: { active?: boolean; payload?: any[]; label?: string; currency?: string; locale?: string }) {
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
          <span className="chart-tooltip__row-value" style={{ color: p.color }}>
            {fmt(Number(p.value ?? 0), currency, locale)}
          </span>
        </div>
      ))}
    </div>
  )
}

export function AreaTrendChart({ data, height = 280, showNet = false, currency = 'EUR', locale = 'es-ES' }: AreaTrendChartProps) {
  const { t } = useI18n()
  return (
    <div className="chart-frame" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="grad-income" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="grad-expense" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="grad-net" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
          <XAxis
            dataKey="period"
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
            dy={6}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
            tickFormatter={(v) => compact(Number(v), locale)}
            width={54}
          />
          <Tooltip content={<CustomTooltip currency={currency} locale={locale} />} />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} iconType="circle" iconSize={8} />
          <Area
            type="monotone"
            dataKey="income"
            name={t('dashboard.income')}
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#grad-income)"
          />
          <Area
            type="monotone"
            dataKey="expense"
            name={t('dashboard.expenses')}
            stroke="#ef4444"
            strokeWidth={2}
            fill="url(#grad-expense)"
          />
          {showNet && (
            <Area
              type="monotone"
              dataKey="net"
              name="Neto"
              stroke="#6366f1"
              strokeWidth={2}
              strokeDasharray="4 4"
              fill="url(#grad-net)"
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
