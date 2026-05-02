import { forwardRef } from 'react';
import { UiInput, UiInputProps } from './UiInput';

export interface UiNumberProps extends Omit<UiInputProps, 'type' | 'onChange'> {
  value?: number | string;
  onChange?: (value: string) => void;
  min?: number;
  max?: number;
  step?: number | string;
}

export const UiNumber = forwardRef<HTMLInputElement, UiNumberProps>(
  ({ onChange, onFocus, onWheel, ...props }, ref) => {

    // Select all text on focus so the user doesn't have to manually clear "0" or old values
    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      e.currentTarget.select();
      onFocus?.(e);
    };

    // Prevent accidental mouse-wheel changes
    const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
      e.currentTarget.blur();
      onWheel?.(e);
    };

    return (
      <UiInput
        {...props}
        type="number"
        inputMode="decimal"
        ref={ref}
        onChange={(e) => onChange?.(e.target.value)}
        onFocus={handleFocus}
        onWheel={handleWheel}
      />
    );
  }
);

UiNumber.displayName = 'UiNumber';
