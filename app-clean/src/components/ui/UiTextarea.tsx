import { forwardRef } from 'react';

export interface UiTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  wrapperClassName?: string;
}

export const UiTextarea = forwardRef<HTMLTextAreaElement, UiTextareaProps>(
  ({ className = '', label, error, hint, wrapperClassName = '', id, ...props }, ref) => {
    
    const inputId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div className={`ui-field ${wrapperClassName}`}>
        {label && (
          <label htmlFor={inputId} className="ui-label">
            {label}
          </label>
        )}
        
        <textarea
          ref={ref}
          id={inputId}
          className={`
            ui-textarea w-full min-h-[100px] transition-all duration-200
            bg-card border border-border rounded-md
            text-sm placeholder:text-muted
            focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
            disabled:opacity-50 disabled:cursor-not-allowed
            p-3
            ${error ? 'border-danger focus:border-danger focus:ring-danger/20' : ''}
            ${className}
          `}
          {...props}
        />

        {error && <p className="ui-error text-xs text-danger mt-1">{error}</p>}
        {hint && !error && <p className="ui-hint text-xs text-secondary mt-1">{hint}</p>}
      </div>
    );
  }
);

UiTextarea.displayName = 'UiTextarea';
