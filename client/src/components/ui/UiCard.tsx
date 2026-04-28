

export interface UiCardProps {
  children: React.ReactNode
  className?: string
  noPadding?: boolean
  style?: React.CSSProperties
  overflowHidden?: boolean
}

export function UiCard({ children, className = '', noPadding = false, style, overflowHidden = false }: UiCardProps) {
  return (
    <div 
      className={`card ${className} ${noPadding ? 'p-0' : ''}`} 
      style={{
          overflow: overflowHidden ? 'hidden' : 'visible', // Default to visible to prevent clipping
          ...style
      }}
    >
      {children}
    </div>
  )
}

export interface UiCardHeaderProps {
  title?: React.ReactNode
  subtitle?: React.ReactNode
  action?: React.ReactNode
  children?: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export function UiCardHeader({ title, subtitle, action, children, className = '', style }: UiCardHeaderProps) {
  return (
    <div className={`card-header ${className}`} style={style}>
      <div className="d-flex items-center justify-between">
         <div className="d-flex flex-col">
            {title && <h3 className="card-title text-lg font-bold">{title}</h3>}
            {subtitle && <p className="card-subtitle text-sm text-muted">{subtitle}</p>}
         </div>
         {action && <div style={{ flexShrink: 0 }}>{action}</div>}
      </div>
      {children}
    </div>
  )
}

export interface UiCardBodyProps {
  children: React.ReactNode
  className?: string
  scrollable?: boolean
  noPadding?: boolean
  style?: React.CSSProperties
}

export function UiCardBody({ children, className = '', scrollable = false, noPadding = false, style }: UiCardBodyProps) {
  return (
    <div 
        className={`card-body ${className}`}
        style={{
            padding: noPadding ? '0' : undefined,
            overflow: scrollable ? 'auto' : undefined, // Only apply auto if strictly requested
            ...style
        }}
    >
      {children}
    </div>
  )
}
