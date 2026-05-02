import { useId } from 'react';

export interface UiFieldProps {
  label?: string | React.ReactNode
  error?: string
  hint?: string
  children: React.ReactNode
  className?: string
  id?: string
  required?: boolean
}

export function UiField({ label, error, hint, children, className = '', id, required }: UiFieldProps) {
  const generatedId = useId();
  const fieldId = id || generatedId;

  return (
    <div className={`ui-field ${className}`}>
      {label && (
        <label htmlFor={fieldId} className={`ui-label ${error ? 'text-danger' : ''}`}>
          {label}
          {required && <span className="ui-required" aria-hidden="true"> *</span>}
        </label>
      )}

      {children}

      {hint && !error && (
        <p id={`${fieldId}-hint`} className="ui-hint">{hint}</p>
      )}

      {error && (
        <p id={`${fieldId}-error`} className="ui-error" role="alert" aria-live="polite">
          <span>•</span> {error}
        </p>
      )}
    </div>
  )
}
