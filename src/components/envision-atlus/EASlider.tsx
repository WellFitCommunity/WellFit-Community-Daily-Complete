/**
 * EASlider - Envision Atlus Slider Component
 *
 * Range input styled for clinical dashboards.
 */

import React from 'react';
import { cn } from '../../lib/utils';

interface EASliderProps {
  value: number[];
  onValueChange: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  showValue?: boolean;
  disabled?: boolean;
  className?: string;
}

export const EASlider: React.FC<EASliderProps> = ({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  showValue = true,
  disabled = false,
  className,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onValueChange([Number(e.target.value)]);
  };

  const percentage = ((value[0] - min) / (max - min)) * 100;

  return (
    <div className={cn('space-y-2', className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between">
          {label && (
            <span className="text-sm text-slate-400">{label}</span>
          )}
          {showValue && (
            <span className="text-sm font-medium text-white tabular-nums">
              {value[0]}
            </span>
          )}
        </div>
      )}
      <div className="relative">
        <input
          type="range"
          value={value[0] ?? min}
          onChange={handleChange}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          className={cn(
            'w-full h-2 rounded-lg appearance-none cursor-pointer',
            'bg-slate-600',
            // Webkit (Chrome, Safari)
            '[&::-webkit-slider-thumb]:appearance-none',
            '[&::-webkit-slider-thumb]:w-4',
            '[&::-webkit-slider-thumb]:h-4',
            '[&::-webkit-slider-thumb]:rounded-full',
            '[&::-webkit-slider-thumb]:bg-[#00857a]',
            '[&::-webkit-slider-thumb]:cursor-pointer',
            '[&::-webkit-slider-thumb]:border-2',
            '[&::-webkit-slider-thumb]:border-[#33bfb7]',
            '[&::-webkit-slider-thumb]:shadow-lg',
            '[&::-webkit-slider-thumb]:transition-transform',
            '[&::-webkit-slider-thumb]:hover:scale-110',
            // Firefox
            '[&::-moz-range-thumb]:w-4',
            '[&::-moz-range-thumb]:h-4',
            '[&::-moz-range-thumb]:rounded-full',
            '[&::-moz-range-thumb]:bg-[#00857a]',
            '[&::-moz-range-thumb]:cursor-pointer',
            '[&::-moz-range-thumb]:border-2',
            '[&::-moz-range-thumb]:border-[#33bfb7]',
            // Track styling
            '[&::-webkit-slider-runnable-track]:rounded-lg',
            '[&::-moz-range-track]:rounded-lg',
            disabled && 'opacity-50 cursor-not-allowed',
            disabled && '[&::-webkit-slider-thumb]:cursor-not-allowed',
            disabled && '[&::-moz-range-thumb]:cursor-not-allowed'
          )}
          style={{
            background: `linear-gradient(to right, #00857a ${percentage}%, #475569 ${percentage}%)`,
          }}
        />
      </div>
    </div>
  );
};

export default EASlider;
