import { Link } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'

export interface BreadcrumbItem {
  label: string
  path?: string
  icon?: React.ReactNode
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav className="breadcrumbs" aria-label="Navegación">
      {/* Home */}
      <div className="breadcrumb-item">
        <Link to="/app/dashboard" className="breadcrumb-link">
          <Home size={16} className="breadcrumb-icon" />
        </Link>
      </div>

      {items.map((item, index) => (
        <div key={index} className="breadcrumb-item">
          <ChevronRight size={14} className="breadcrumb-separator" />
          {item.path ? (
            <Link to={item.path} className="breadcrumb-link">
              {item.icon}
              {item.label}
            </Link>
          ) : (
            <span className="breadcrumb-current">
              {item.icon}
              {item.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  )
}
