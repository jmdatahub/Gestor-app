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
  ({ onChange, ...props }, ref) => {
    
    // Prevent mouse wheel change
    const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
      e.currentTarget.blur();
    };

    return (
      <UiInput
        {...props}
        type="number"
        ref={ref}
        onChange={(e) => onChange && onChange(e.target.value)}
        onWheel={handleWheel}
      />
    );
  }
);

UiNumber.displayName = 'UiNumber';
