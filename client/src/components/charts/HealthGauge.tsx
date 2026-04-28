import { useMemo } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'

interface HealthGaugeProps {
  score: number // 0..100
  label?: string
  description?: string
  size?: number
}

function scoreTone(score: number) {
  if (score >= 75) return { color: 'var(--success)', label: 'Excelente' }
  if (score >= 55) return { color: '#22c55e', label: 'Saludable' }
  if (score >= 35) return { color: 'var(--warning)', label: 'Atención' }
  return { color: 'var(--danger)', label: 'Crítico' }
}

export function HealthGauge({ score, label, description, size = 180 }: HealthGaugeProps) {
  const clamped = Math.max(0, Math.min(100, score))
  const tone = scoreTone(clamped)
  const data = useMemo(() => [
    { name: 'score', value: clamped, color: tone.color },
    { name: 'rest', value: 100 - clamped, color: 'var(--gray-100)' },
  ], [clamped, tone.color])

  return (
    <div className="health-gauge">
      <div style={{ position: 'relative', width: size, height: size / 1.8 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              startAngle={180}
              endAngle={0}
              cx="50%"
              cy="100%"
              innerRadius="75%"
              outerRadius="100%"
              dataKey="value"
              stroke="none"
              isAnimationActive
            >
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingBottom: 4,
          pointerEvents: 'none',
        }}>
          <div className="health-gauge__score">{Math.round(clamped)}</div>
          <div className="health-gauge__label" style={{ color: tone.color }}>{label ?? tone.label}</div>
        </div>
      </div>
      {description && <div className="health-gauge__description">{description}</div>}
    </div>
  )
}
