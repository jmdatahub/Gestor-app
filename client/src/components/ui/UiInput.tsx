import { forwardRef, useId } from 'react';

export interface UiInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  wrapperClassName?: string;
}

export const UiInput = forwardRef<HTMLInputElement, UiInputProps>(
  ({ className = '', label, error, hint, icon, rightIcon, wrapperClassName = '', id, required, ...props }, ref) => {

    // Stable ID for A11y — useId is stable across renders
    const generatedId = useId();
    const inputId = id || generatedId;

    return (
      <div className={`ui-field ${wrapperClassName}`}>
        {label && (
          <label htmlFor={inputId} className="ui-label">
            {label}
            {required && <span className="ui-required" aria-hidden="true"> *</span>}
          </label>
        )}

        <div className="ui-input-container">
          {icon && (
            <div className="ui-input-container-icon">
              {icon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            required={required}
            aria-required={required}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            className={`ui-input ${error ? 'is-error' : ''} ${className}`}
            {...props}
          />

          {rightIcon && (
            <div className="ui-input-container-icon" style={{ paddingLeft: 0, paddingRight: '1rem' }}>
              {rightIcon}
            </div>
          )}
        </div>

        {error && (
          <p id={`${inputId}-error`} className="ui-error text-xs text-danger mt-1" role="alert" aria-live="polite">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${inputId}-hint`} className="ui-hint text-xs text-secondary mt-1">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

UiInput.displayName = 'UiInput';
