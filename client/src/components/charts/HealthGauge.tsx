interface HealthGaugeProps {
  score: number
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

// CX=100, CY=100, semicircle from left (180°) to right (0°) through top
const CX = 100, CY = 100, RO = 82, RI = 56

function buildArcPath(pct: number): string {
  if (pct <= 0) return ''
  // Full semicircle split into two 90° arcs to avoid ambiguity
  if (pct >= 100) {
    return [
      `M ${CX - RO} ${CY}`,
      `A ${RO} ${RO} 0 0 1 ${CX} ${CY - RO}`,
      `A ${RO} ${RO} 0 0 1 ${CX + RO} ${CY}`,
      `L ${CX + RI} ${CY}`,
      `A ${RI} ${RI} 0 0 0 ${CX} ${CY - RI}`,
      `A ${RI} ${RI} 0 0 0 ${CX - RI} ${CY}`,
      'Z',
    ].join(' ')
  }
  // Angle in radians: 180° at pct=0, 0° at pct=100
  const θ = ((180 - pct * 1.8) * Math.PI) / 180
  const ox2 = CX + RO * Math.cos(θ)
  const oy2 = CY - RO * Math.sin(θ)
  const ix2 = CX + RI * Math.cos(θ)
  const iy2 = CY - RI * Math.sin(θ)
  return [
    `M ${CX - RO} ${CY}`,
    `A ${RO} ${RO} 0 0 1 ${ox2} ${oy2}`,  // CW from left to endpoint
    `L ${ix2} ${iy2}`,
    `A ${RI} ${RI} 0 0 0 ${CX - RI} ${CY}`, // CCW back to inner left
    'Z',
  ].join(' ')
}

const BG_PATH = [
  `M ${CX - RO} ${CY}`,
  `A ${RO} ${RO} 0 0 1 ${CX} ${CY - RO}`,
  `A ${RO} ${RO} 0 0 1 ${CX + RO} ${CY}`,
  `L ${CX + RI} ${CY}`,
  `A ${RI} ${RI} 0 0 0 ${CX} ${CY - RI}`,
  `A ${RI} ${RI} 0 0 0 ${CX - RI} ${CY}`,
  'Z',
].join(' ')

export function HealthGauge({ score, label, description, size = 180 }: HealthGaugeProps) {
  const clamped = Math.max(0, Math.min(100, score))
  const tone = scoreTone(clamped)

  return (
    <div className="health-gauge">
      <svg viewBox="0 0 200 106" width={size} style={{ display: 'block' }}>
        <path d={BG_PATH} fill="rgba(255,255,255,0.06)" />
        <path d={buildArcPath(clamped)} fill={tone.color} />
      </svg>
      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <div className="health-gauge__score">{Math.round(clamped)}</div>
        <div className="health-gauge__label" style={{ color: tone.color }}>{label ?? tone.label}</div>
      </div>
      {description && <div className="health-gauge__description">{description}</div>}
    </div>
  )
}
