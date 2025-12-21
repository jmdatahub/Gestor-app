import React from 'react'
// import { motion } from 'framer-motion' // Removed dependency

export interface UiSegmentedOption {
  value: string
  label: string
  icon?: React.ReactNode
}

export interface UiSegmentedProps {
  value: string
  onChange: (value: string) => void
  options: UiSegmentedOption[]
  className?: string
  size?: 'sm' | 'md'
  style?: React.CSSProperties
  block?: boolean
}

export function UiSegmented({ value, onChange, options, className = '', size = 'md', style, block }: UiSegmentedProps) {
  const handleToggle = (val: string) => {
    console.log(`[UiSegmented] Toggle clicked: ${val}, current value: ${value}`)
    if (val !== value) {
      onChange(val)
    }
  }

  return (
    <div 
        className={`segmented-control ${className}`}
        style={{
            display: block ? 'flex' : 'inline-flex',
            width: block ? '100%' : 'auto',
            alignItems: 'center',
            padding: '4px',
            borderRadius: '12px',
            background: 'var(--primary-soft)',
            gap: '4px',
            position: 'relative',
            border: '1px solid var(--border-color)',
            ...style
        }}
    >
      {options.map((opt) => {
        const isActive = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => handleToggle(opt.value)}
            style={{
                position: 'relative',
                zIndex: 1,
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                border: 'none',
                background: isActive ? 'var(--primary)' : 'transparent',
                cursor: 'pointer',
                padding: size === 'sm' ? '0.25rem 0.5rem' : '0.625rem 1rem',
                fontSize: size === 'sm' ? '0.75rem' : '0.875rem',
                fontWeight: 600,
                color: isActive ? 'white' : 'var(--primary)',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                outline: 'none',
                borderRadius: '8px',
                boxShadow: isActive ? '0 4px 12px rgba(79, 70, 229, 0.25)' : 'none',
            }}
          >
            {opt.icon && <span style={{ opacity: isActive ? 1 : 0.8 }}>{opt.icon}</span>}
            <span>{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}
