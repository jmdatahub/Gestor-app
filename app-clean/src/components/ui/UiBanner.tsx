import React, { ReactNode } from 'react'

export interface UiBannerProps {
  type?: 'info' | 'warning' | 'danger' | 'success'
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}

export function UiBanner({
  type = 'info',
  icon,
  title,
  description,
  action,
  className = ''
}: UiBannerProps) {
  // Configuración de estilos según el tipo
  const styles = {
    info: {
      bg: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(96, 165, 250, 0.1) 100%)',
      border: 'rgba(59, 130, 246, 0.3)',
      iconBg: 'rgba(59, 130, 246, 0.2)',
      iconColor: '#3b82f6' // text-blue-500
    },
    warning: {
      bg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(251, 191, 36, 0.1) 100%)',
      border: 'rgba(245, 158, 11, 0.3)',
      iconBg: 'rgba(245, 158, 11, 0.2)',
      iconColor: '#f59e0b' // text-amber-500
    },
    danger: {
      bg: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(248, 113, 113, 0.1) 100%)',
      border: 'rgba(239, 68, 68, 0.3)',
      iconBg: 'rgba(239, 68, 68, 0.2)',
      iconColor: '#ef4444' // text-red-500
    },
    success: {
      bg: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(74, 222, 128, 0.1) 100%)',
      border: 'rgba(34, 197, 94, 0.3)',
      iconBg: 'rgba(34, 197, 94, 0.2)',
      iconColor: '#22c55e' // text-green-500
    }
  }

  const currentStyle = styles[type]

  return (
    <div 
      className={`ui-banner ${className}`}
      style={{
        background: currentStyle.bg,
        border: `1px solid ${currentStyle.border}`,
        borderRadius: '12px',
        padding: '16px 20px',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
        {icon && (
          <div style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: currentStyle.iconBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            {React.isValidElement(icon) 
              ? React.cloneElement(icon as React.ReactElement<any>, { style: { ...(icon.props.style || {}), color: currentStyle.iconColor } }) 
              : icon}
          </div>
        )}
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            {title}
          </div>
          {description && (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {description}
            </div>
          )}
        </div>
      </div>
      {action && (
        <div style={{ flexShrink: 0 }}>
          {action}
        </div>
      )}
    </div>
  )
}
