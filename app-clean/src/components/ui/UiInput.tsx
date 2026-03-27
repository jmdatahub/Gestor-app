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
        
        <div className="relative flex items-center w-full">
          {/* Wrapper for the input to ensure background and border contain the icon */}
          <div className="relative flex items-center w-full bg-card border border-border rounded-md transition-all duration-200 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary">
            {icon && (
              <div className="flex items-center justify-center pl-4 text-secondary opacity-70 pointer-events-none">
                {icon}
              </div>
            )}
            
            <input
              ref={ref}
              id={inputId}
              className={`
                ui-input w-full bg-transparent border-none text-sm placeholder:text-muted
                focus:outline-none focus:ring-0
                disabled:opacity-50 disabled:cursor-not-allowed
                ${icon ? 'pl-3' : 'pl-4'}
                ${rightIcon ? 'pr-10' : 'pr-4'}
                py-3
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
        </div>

        {error && <p className="ui-error text-xs text-danger mt-1">{error}</p>}
        {hint && !error && <p className="ui-hint text-xs text-secondary mt-1">{hint}</p>}
      </div>
    );
  }
);

UiInput.displayName = 'UiInput';
