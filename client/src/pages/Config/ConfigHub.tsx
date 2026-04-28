import { NavLink, Outlet, Navigate } from 'react-router-dom'
import { Tag, Download, Building, Shield } from 'lucide-react'

const tabs = [
  { to: 'categorias', label: 'Categorías', icon: Tag },
  { to: 'exportar', label: 'Exportar', icon: Download },
  { to: 'organizaciones', label: 'Organizaciones', icon: Building },
  { to: 'admin', label: 'Admin', icon: Shield },
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

export default function ConfigHub() {
  return (
    <div>
      <nav style={{
        display: 'flex',
        borderBottom: '1px solid var(--border-color)',
        marginBottom: 24,
        overflowX: 'auto',
      }}>
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} style={({ isActive }) => tabStyle(isActive)}>
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  )
}

export function ConfigIndexRedirect() {
  return <Navigate to="categorias" replace />
}
