import { NavLink, Outlet } from 'react-router-dom'
import { CreditCard, PiggyBank, TrendingUp, Wallet } from 'lucide-react'

const tabs = [
  { to: '.', end: true, label: 'Cuentas', icon: CreditCard },
  { to: 'ahorros', end: false, label: 'Ahorros', icon: PiggyBank },
  { to: 'inversiones', end: false, label: 'Inversiones', icon: TrendingUp },
  { to: 'deudas', end: false, label: 'Deudas', icon: Wallet },
]

export default function PatrimonioHub() {
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
