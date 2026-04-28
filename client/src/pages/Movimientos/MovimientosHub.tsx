import { NavLink, Outlet } from 'react-router-dom'
import { ArrowUpDown, RefreshCw, Clock } from 'lucide-react'

const tabs = [
  { to: '.', end: true, label: 'Todos', icon: ArrowUpDown },
  { to: 'recurrentes', end: false, label: 'Recurrentes', icon: RefreshCw },
  { to: 'pendientes', end: false, label: 'Pendientes', icon: Clock },
]

const tabStyle = (isActive: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 20px',
  borderBottom: `2px solid ${isActive ? 'var(--primary)' : 'transparent'}`,
  color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
  fontWeight: isActive ? 600 : 400,
  fontSize: 14,
  textDecoration: 'none',
  transition: 'color 0.15s, border-color 0.15s',
  marginBottom: -1,
  whiteSpace: 'nowrap',
})

export default function MovimientosHub() {
  return (
    <div>
      <nav style={{
        display: 'flex',
        borderBottom: '1px solid var(--border-color)',
        marginBottom: 24,
        overflowX: 'auto',
      }}>
        {tabs.map(({ to, end, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={end} style={({ isActive }) => tabStyle(isActive)}>
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  )
}
