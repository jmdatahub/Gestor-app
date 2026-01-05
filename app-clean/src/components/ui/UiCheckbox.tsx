
import { Check } from 'lucide-react'

export interface UiCheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: React.ReactNode
  disabled?: boolean
  className?: string
  id?: string
}

export function UiCheckbox({
  checked,
  onChange,
  label,
  disabled = false,
  className = '',
  id
}: UiCheckboxProps) {
  const computedId = id || `ui-checkbox-${Math.random().toString(36).substr(2, 9)}`

  return (
    <label htmlFor={computedId} className={`ui-checkbox-container ${disabled ? 'is-disabled' : ''} ${className}`}>
      <div className={`ui-checkbox ${checked ? 'is-checked' : ''}`}>
        <input
          type="checkbox"
          id={computedId}
          className="sr-only"
          checked={checked}
          onChange={(e) => !disabled && onChange(e.target.checked)}
          disabled={disabled}
        />
        {checked && <Check size={12} strokeWidth={3} className="text-white" />}
      </div>
      {label && <span className="ui-checkbox-label">{label}</span>}
    </label>
  )
}
