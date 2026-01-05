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
        
        <div className="relative flex items-center">
          {icon && (
            <div className="absolute left-3 text-secondary pointer-events-none flex items-center justify-center">
              {icon}
            </div>
          )}
          
          <input
            ref={ref}
            id={inputId}
            className={`
              ui-input w-full transition-all duration-200
              bg-card border border-border rounded-md
              text-sm placeholder:text-muted
              focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
              disabled:opacity-50 disabled:cursor-not-allowed
              ${icon ? 'pl-9' : 'pl-3'}
              ${rightIcon ? 'pr-9' : 'pr-3'}
              ${error ? 'border-danger focus:border-danger focus:ring-danger/20' : ''}
              ${className}
            `}
            {...props}
          />

          {rightIcon && (
            <div className="absolute right-3 text-secondary flex items-center justify-center">
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
