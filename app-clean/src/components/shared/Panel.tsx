import type { ReactNode, CSSProperties } from 'react'

interface PanelProps {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  icon?: ReactNode
  children: ReactNode
  className?: string
  style?: CSSProperties
  padding?: 'normal' | 'tight' | 'none'
}

export function Panel({ title, subtitle, actions, icon, children, className = '', style, padding = 'normal' }: PanelProps) {
  const padStyle: CSSProperties =
    padding === 'none' ? { padding: 0 } :
    padding === 'tight' ? { padding: 14 } : {}

  return (
    <section className={`panel ${className}`} style={{ ...padStyle, ...style }}>
      {(title || actions) && (
        <header className="panel__head">
          <div className="panel__title-wrap">
            {title && (
              <h2 className="panel__title">
                {icon}
                {title}
              </h2>
            )}
            {subtitle && <p className="panel__subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="panel__actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  )
}
