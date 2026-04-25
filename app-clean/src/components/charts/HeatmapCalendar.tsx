import { useMemo } from 'react'

interface HeatmapPoint {
  date: string // ISO yyyy-mm-dd
  value: number
}

interface HeatmapCalendarProps {
  data: HeatmapPoint[]
  weeks?: number
  currency?: string
  locale?: string
  title?: string
  tone?: 'danger' | 'success' | 'primary'
}

const TONE_STOPS: Record<string, string[]> = {
  danger: ['var(--gray-100)', '#fecaca', '#fca5a5', '#f87171', '#ef4444', '#b91c1c'],
  success: ['var(--gray-100)', '#bbf7d0', '#86efac', '#4ade80', '#22c55e', '#15803d'],
  primary: ['var(--gray-100)', '#c7d2fe', '#a5b4fc', '#818cf8', '#6366f1', '#4338ca'],
}

const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

const fmt = (n: number, currency = 'EUR', locale = 'es-ES') =>
  new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)

function getIsoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

export function HeatmapCalendar({ data, weeks = 18, currency = 'EUR', locale = 'es-ES', title, tone = 'danger' }: HeatmapCalendarProps) {
  const { grid, max, monthLabels } = useMemo(() => {
    const map = new Map<string, number>()
    data.forEach(d => map.set(d.date, (map.get(d.date) ?? 0) + d.value))

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    // Align end to last Sunday
    const end = new Date(today)
    const day = end.getDay() // 0 sun - 6 sat
    const daysToSunday = day === 0 ? 0 : 7 - day
    end.setDate(end.getDate() + daysToSunday)

    const totalDays = weeks * 7
    const start = new Date(end)
    start.setDate(end.getDate() - totalDays + 1)

    // Build columns (weeks) × rows (days: Mon-Sun)
    // We'll iterate day by day and slot into column index = floor(dayOffset / 7)
    const cols: Array<Array<{ date: string; value: number; d: Date } | null>> = []
    for (let w = 0; w < weeks; w++) cols.push([null, null, null, null, null, null, null])

    let max = 0
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      const isoDate = getIsoDate(d)
      const value = map.get(isoDate) ?? 0
      if (value > max) max = value
      const weekIdx = Math.floor(i / 7)
      const jsDay = d.getDay() // 0 sun - 6 sat
      const rowIdx = jsDay === 0 ? 6 : jsDay - 1 // Mon=0 ... Sun=6
      cols[weekIdx][rowIdx] = { date: isoDate, value, d }
    }

    // Month labels (per column based on first row day)
    const monthLabels: { col: number; label: string }[] = []
    let prevMonth = -1
    for (let c = 0; c < weeks; c++) {
      const firstCell = cols[c].find(Boolean)
      if (!firstCell) continue
      const m = firstCell.d.getMonth()
      if (m !== prevMonth) {
        monthLabels.push({ col: c, label: firstCell.d.toLocaleString(locale, { month: 'short' }) })
        prevMonth = m
      }
    }

    return { grid: cols, max, monthLabels }
  }, [data, weeks, locale])

  const stops = TONE_STOPS[tone] ?? TONE_STOPS.danger

  const colorFor = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return stops[0]
    if (max <= 0) return stops[0]
    const ratio = value / max
    if (ratio > 0.8) return stops[5]
    if (ratio > 0.55) return stops[4]
    if (ratio > 0.35) return stops[3]
    if (ratio > 0.15) return stops[2]
    return stops[1]
  }

  return (
    <div className="heatmap">
      {title && <div className="muted-sm">{title}</div>}
      {/* Month label row */}
      <div style={{ display: 'grid', gridTemplateColumns: `20px repeat(${weeks}, 1fr)`, gap: 3, fontSize: 10, color: 'var(--text-muted)' }}>
        <div />
        {Array.from({ length: weeks }).map((_, c) => {
          const label = monthLabels.find(m => m.col === c)?.label
          return <div key={c} style={{ textAlign: 'left' }}>{label ?? ''}</div>
        })}
      </div>
      {/* 7 rows: Mon..Sun */}
      {Array.from({ length: 7 }).map((_, rowIdx) => (
        <div key={rowIdx} style={{ display: 'grid', gridTemplateColumns: `20px repeat(${weeks}, 1fr)`, gap: 3, alignItems: 'center' }}>
          <div className="heatmap__day-label">{rowIdx % 2 === 0 ? DAY_LABELS[rowIdx] : ''}</div>
          {grid.map((col, cIdx) => {
            const cell = col[rowIdx]
            if (!cell) return <div key={cIdx} style={{ visibility: 'hidden' }} className="heatmap__cell" />
            return (
              <div
                key={cIdx}
                className="heatmap__cell"
                style={{ background: colorFor(cell.value) }}
                title={`${cell.date} — ${fmt(cell.value, currency, locale)}`}
              />
            )
          })}
        </div>
      ))}
      <div className="heatmap__legend">
        <span>Menos</span>
        {stops.map((c, i) => (
          <div key={i} className="heatmap__legend-cell" style={{ background: c }} />
        ))}
        <span>Más</span>
      </div>
    </div>
  )
}
