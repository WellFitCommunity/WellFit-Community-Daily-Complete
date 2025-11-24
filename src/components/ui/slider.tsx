/**
 * Slider UI Component
 *
 * A simple range slider component for numeric input.
 * Uses native HTML range input with custom styling.
 */

import React from 'react';
import { cn } from '../../lib/utils';

interface SliderProps {
  value: number[];
  onValueChange: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  disabled?: boolean;
}

export const Slider: React.FC<SliderProps> = ({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  className,
  disabled = false,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onValueChange([Number(e.target.value)]);
  };

  return (
    <input
      type="range"
      value={value[0] ?? min}
      onChange={handleChange}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      className={cn(
        'w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer',
        'accent-cyan-500',
        '[&::-webkit-slider-thumb]:appearance-none',
        '[&::-webkit-slider-thumb]:w-4',
        '[&::-webkit-slider-thumb]:h-4',
        '[&::-webkit-slider-thumb]:rounded-full',
        '[&::-webkit-slider-thumb]:bg-cyan-500',
        '[&::-webkit-slider-thumb]:cursor-pointer',
        '[&::-moz-range-thumb]:w-4',
        '[&::-moz-range-thumb]:h-4',
        '[&::-moz-range-thumb]:rounded-full',
        '[&::-moz-range-thumb]:bg-cyan-500',
        '[&::-moz-range-thumb]:cursor-pointer',
        '[&::-moz-range-thumb]:border-0',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    />
  );
};

export default Slider;
