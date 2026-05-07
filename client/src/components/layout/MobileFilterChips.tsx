import type { ReactNode } from 'react'
import { X } from 'lucide-react'

export interface ChipDef {
  key: string
  label: string
  active: boolean
  onToggle: () => void
  count?: number
}

interface MobileFilterChipsProps {
  chips: ChipDef[]
  onClear?: () => void
  trailing?: ReactNode
}

/**
 * Horizontal chip strip — used on mobile to expose filters in a way that
 * fits the thumb. Falls back to nothing on desktop (CSS hides the wrapper).
 */
export function MobileFilterChips({ chips, onClear, trailing }: MobileFilterChipsProps) {
  const anyActive = chips.some((c) => c.active)
  return (
    <div className="mobile-filter-chips" role="toolbar" aria-label="Filtros rápidos">
      <div className="mobile-filter-chips-scroll">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            className={`mobile-filter-chip ${c.active ? 'is-active' : ''}`}
            onClick={c.onToggle}
            aria-pressed={c.active}
          >
            <span>{c.label}</span>
            {c.count != null && c.count > 0 && (
              <span className="mobile-filter-chip-count">{c.count}</span>
            )}
          </button>
        ))}
        {trailing}
        {anyActive && onClear && (
          <button
            type="button"
            className="mobile-filter-chip mobile-filter-chip-clear"
            onClick={onClear}
            aria-label="Limpiar filtros"
          >
            <X size={14} />
            Limpiar
          </button>
        )}
      </div>
    </div>
  )
}
