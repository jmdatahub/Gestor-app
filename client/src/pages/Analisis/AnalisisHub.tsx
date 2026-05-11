import { NavLink, Outlet } from 'react-router-dom'
import { BarChart3, Lightbulb, Bell } from 'lucide-react'

const tabs = [
  { to: '.', end: true, label: 'Resumen', icon: BarChart3 },
  { to: 'insights', end: false, label: 'Insights', icon: Lightbulb },
  { to: 'alertas', end: false, label: 'Alertas', icon: Bell },
]

export default function AnalisisHub() {
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
