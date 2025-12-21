import React from 'react'

export interface UiSwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
  className?: string
  id?: string
}

export function UiSwitch({
  checked,
  onChange,
  label,
  disabled = false,
  className = '',
  id
}: UiSwitchProps) {
  const computedId = id || `ui-switch-${Math.random().toString(36).substr(2, 9)}`

  return (
    <label htmlFor={computedId} className={`ui-switch-container ${disabled ? 'is-disabled' : ''} ${className}`}>
      <div className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          id={computedId}
          className="sr-only peer"
          checked={checked}
          onChange={(e) => !disabled && onChange(e.target.checked)}
          disabled={disabled}
        />
        <div className="ui-switch-track"></div>
        <div className="ui-switch-thumb"></div>
      </div>
      {label && <span className="ui-switch-label">{label}</span>}
    </label>
  )
}
