import React from 'react'

export interface UiFieldProps {
  label?: string | React.ReactNode
  error?: string
  hint?: string
  children: React.ReactNode
  className?: string
  id?: string
}

export function UiField({ label, error, hint, children, className = '', id }: UiFieldProps) {
  return (
    <div className={`ui-field ${className}`}>
      {label && (
        <label htmlFor={id} className={`ui-label ${error ? 'text-danger' : ''}`}>
          {label}
        </label>
      )}
      
      {children}
      
      {hint && !error && (
        <p className="ui-hint">{hint}</p>
      )}
      
      {error && (
         <p className="ui-error">
            <span>•</span> {error}
         </p>
      )}
    </div>
  )
}
