import { Plus } from 'lucide-react'
import type { ReactNode, MouseEventHandler } from 'react'

interface FabProps {
  onClick: MouseEventHandler<HTMLButtonElement>
  ariaLabel: string
  icon?: ReactNode
  /** Show only on mobile (default true). When false, always visible. */
  mobileOnly?: boolean
}

/**
 * Floating Action Button — primary action accessible with the thumb.
 * Hidden on tablet/desktop by default (mobileOnly).
 * Sits above the bottom-nav on mobile.
 */
export function Fab({ onClick, ariaLabel, icon, mobileOnly = true }: FabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={ariaLabel}
      className={`app-fab ${mobileOnly ? 'app-fab--mobile-only' : ''}`}
    >
      {icon ?? <Plus size={26} strokeWidth={2.25} />}
    </button>
  )
}
