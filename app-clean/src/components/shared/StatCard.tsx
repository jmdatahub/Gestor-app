import type { ReactNode } from 'react'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'
import { TrendPill } from './TrendPill'

export type StatCardTone = 'primary' | 'success' | 'danger' | 'warning' | 'neutral'

interface StatCardProps {
  label: string
  value: ReactNode
  icon?: ReactNode
  tone?: StatCardTone
  trend?: {
    value: number
    label?: string
    invert?: boolean
  }
  helper?: ReactNode
  sparkline?: number[]
  onClick?: () => void
}

const toneToSparkColor: Record<StatCardTone, string> = {
  primary: 'var(--chart-neutral)',
  success: 'var(--chart-positive)',
  danger: 'var(--chart-negative)',
  warning: 'var(--chart-accent)',
  neutral: 'var(--chart-neutral)',
}

export function StatCard({
  label,
  value,
  icon,
  tone = 'primary',
  trend,
  helper,
  sparkline,
  onClick,
}: StatCardProps) {
  const sparkData = sparkline?.map((v, i) => ({ i, v })) ?? []
  const strokeColor = toneToSparkColor[tone]
  const clickable = typeof onClick === 'function'

  return (
    <div
      className={`stat-card stat-card--${tone}${clickable ? ' stat-card--clickable' : ''}`}
      role={clickable ? 'button' : 'group'}
      aria-label={clickable ? label : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick!() } } : undefined}
      style={clickable ? { cursor: 'pointer' } : undefined}
    >
      <span className="stat-card__accent" aria-hidden="true" />
      <div className="stat-card__head">
        <span className="stat-card__label">{label}</span>
        {icon && <span className="stat-card__icon" aria-hidden="true">{icon}</span>}
      </div>
      <div className="stat-card__value">{value}</div>
      {(trend || helper) && (
        <div className="stat-card__meta">
          <span className="muted-sm">{helper}</span>
          {trend && <TrendPill value={trend.value} label={trend.label} invert={trend.invert} />}
        </div>
      )}
      {sparkData.length > 1 && (
        <div className="stat-card__sparkline" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
              <defs>
                <linearGradient id={`spark-${tone}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={strokeColor} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={strokeColor}
                strokeWidth={1.75}
                fill={`url(#spark-${tone})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
