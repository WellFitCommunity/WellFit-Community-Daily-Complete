/**
 * EASwitch - Envision Atlus Switch Component
 *
 * Clinical-grade toggle switch with accessible design and proper touch targets.
 */

import React from 'react';
import { cn } from '../../lib/utils';

interface EASwitchProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  'aria-label'?: string;
}

export const EASwitch = React.forwardRef<HTMLButtonElement, EASwitchProps>(
  ({ checked = false, onCheckedChange, disabled = false, id, className, 'aria-label': ariaLabel }, ref) => {
    const handleClick = () => {
      if (!disabled && onCheckedChange) {
        onCheckedChange(!checked);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    };

    return (
      <button
        ref={ref}
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full',
          'transition-colors duration-200 ease-in-out',
          'focus:outline-hidden focus:ring-2 focus:ring-[#00857a]/50 focus:ring-offset-2 focus:ring-offset-slate-900',
          'disabled:cursor-not-allowed disabled:opacity-50',
          checked
            ? 'bg-[#00857a]'
            : 'bg-slate-600',
          className
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg',
            'transform transition-transform duration-200 ease-in-out',
            'ring-0',
            checked ? 'translate-x-5' : 'translate-x-0.5',
            'mt-0.5'
          )}
        />
      </button>
    );
  }
);

EASwitch.displayName = 'EASwitch';

export default EASwitch;
