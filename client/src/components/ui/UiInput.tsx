import { forwardRef } from 'react';

export interface UiInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  wrapperClassName?: string;
}

export const UiInput = forwardRef<HTMLInputElement, UiInputProps>(
  ({ className = '', label, error, hint, icon, rightIcon, wrapperClassName = '', id, ...props }, ref) => {
    
    // Generate random ID if not provided, for A11y
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div className={`ui-field ${wrapperClassName}`}>
        {label && (
          <label htmlFor={inputId} className="ui-label">
            {label}
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
            className={`ui-input ${className}`}
            {...props}
          />

          {rightIcon && (
            <div className="ui-input-container-icon" style={{ paddingLeft: 0, paddingRight: '1rem' }}>
              {rightIcon}
            </div>
          )}
        </div>

        {error && <p className="ui-error text-xs text-danger mt-1">{error}</p>}
        {hint && !error && <p className="ui-hint text-xs text-secondary mt-1">{hint}</p>}
      </div>
    );
  }
);

UiInput.displayName = 'UiInput';
