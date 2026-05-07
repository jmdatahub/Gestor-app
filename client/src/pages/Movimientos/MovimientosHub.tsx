import { NavLink, Outlet } from 'react-router-dom'
import { ArrowUpDown, RefreshCw, Clock } from 'lucide-react'

const tabs = [
  { to: '.', end: true, label: 'Todos', icon: ArrowUpDown },
  { to: 'recurrentes', end: false, label: 'Recurrentes', icon: RefreshCw },
  { to: 'pendientes', end: false, label: 'Pendientes', icon: Clock },
]

export default function MovimientosHub() {
  return (
    <div>
      <nav className="hub-tabs">
        {tabs.map(({ to, end, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `hub-tab ${isActive ? 'is-active' : ''}`}
          >
            <Icon size={16} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  )
}
