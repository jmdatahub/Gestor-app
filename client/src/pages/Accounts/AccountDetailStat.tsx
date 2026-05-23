import type { ReactNode } from 'react'

interface Props {
  label: string
  value: string
  hint?: string
  accent?: string
  icon?: ReactNode
}

export function Stat({ label, value, hint, accent, icon }: Props) {
  return (
    <div>
      <div style={{
        fontSize: '10px', textTransform: 'uppercase', fontWeight: 600,
        letterSpacing: '0.6px', color: 'var(--text-muted, #6b7280)',
        display: 'flex', alignItems: 'center', gap: '6px',
      }}>{icon}{label}</div>
      <div style={{
        fontSize: '20px', fontWeight: 800, fontVariantNumeric: 'tabular-nums',
        marginTop: '4px', color: accent || 'var(--text-primary, #111827)',
      }}>{value}</div>
      {hint && (
        <div style={{ fontSize: '11px', color: 'var(--text-muted, #6b7280)', marginTop: '2px' }}>{hint}</div>
      )}
    </div>
  )
}
