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
  // Map banner type to CSS semantic color variable
  const colorVarMap: Record<string, string> = {
    info:    '--info',
    warning: '--warning',
    danger:  '--danger',
    success: '--success',
  }
  const colorVar    = colorVarMap[type] ?? '--info'
  const colorRef    = `var(${colorVar})`
  const softRef     = `var(${colorVar}-soft)`
  const borderRef   = `var(${colorVar}-border, ${colorRef})`

  return (
    <div
      className={`ui-banner ${className}`}
      style={{
        background: softRef,
        border: `1px solid ${borderRef}`,
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
            background: softRef,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            {React.isValidElement(icon)
              ? React.cloneElement(icon as React.ReactElement<any>, { style: { ...(icon.props.style || {}), color: colorRef } })
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
