import { NavLink } from 'react-router-dom'
import { LayoutDashboard, ArrowUpDown, Wallet, BarChart3, Menu } from 'lucide-react'
import { useI18n } from '../../hooks/useI18n'

interface BottomNavProps {
  onMenuToggle: () => void
  isMenuOpen: boolean
  pendingInvitations?: number
  pendingDebts?: number
}

const ICON_SIZE = 22
const ICON_STROKE = 1.75

export function BottomNav({ onMenuToggle, isMenuOpen, pendingInvitations = 0, pendingDebts = 0 }: BottomNavProps) {
  const { t } = useI18n()

  const items = [
    { to: '/app/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard, badge: pendingInvitations },
    { to: '/app/movimientos', label: t('nav.movements'), icon: ArrowUpDown, badge: 0 },
    { to: '/app/patrimonio', label: t('nav.patrimonio'), icon: Wallet, badge: pendingDebts },
    { to: '/app/analisis', label: t('nav.analisis'), icon: BarChart3, badge: 0 },
  ]

  return (
    <nav className="bottom-nav" role="navigation" aria-label="Navegación inferior">
      {items.map(({ to, label, icon: Icon, badge }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => `bottom-nav-item ${isActive ? 'is-active' : ''}`}
        >
          <span className="bottom-nav-icon-wrap">
            <Icon size={ICON_SIZE} strokeWidth={ICON_STROKE} />
            {badge > 0 && (
              <span className="bottom-nav-badge" aria-label={`${badge} pendientes`}>
                {badge > 9 ? '9+' : badge}
              </span>
            )}
          </span>
          <span className="bottom-nav-label">{label}</span>
        </NavLink>
      ))}
      <button
        type="button"
        className={`bottom-nav-item bottom-nav-menu ${isMenuOpen ? 'is-active' : ''}`}
        onClick={onMenuToggle}
        aria-label={isMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={isMenuOpen}
      >
        <span className="bottom-nav-icon-wrap">
          <Menu size={ICON_SIZE} strokeWidth={ICON_STROKE} />
        </span>
        <span className="bottom-nav-label">Más</span>
      </button>
    </nav>
  )
}
