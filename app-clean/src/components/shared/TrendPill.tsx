import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'

interface TrendPillProps {
  value: number
  label?: string
  invert?: boolean
  showSign?: boolean
}

export function TrendPill({ value, label, invert = false, showSign = true }: TrendPillProps) {
  const isFlat = !Number.isFinite(value) || Math.abs(value) < 0.5
  const isUp = !isFlat && value > 0
  const isDown = !isFlat && value < 0

  let tone: 'up' | 'down' | 'flat' = 'flat'
  if (isUp) tone = invert ? 'down' : 'up'
  else if (isDown) tone = invert ? 'up' : 'down'

  const Icon = isUp ? ArrowUpRight : isDown ? ArrowDownRight : Minus

  const formatted = Number.isFinite(value)
    ? `${showSign && value > 0 ? '+' : ''}${value.toFixed(1)}%`
    : '—'

  return (
    <span className={`trend-pill trend-pill--${tone}`}>
      <Icon size={12} />
      {formatted}
      {label ? <span style={{ opacity: 0.7, marginLeft: 2, fontWeight: 500 }}>{label}</span> : null}
    </span>
  )
}
