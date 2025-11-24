/**
 * EAButton - Envision Atlus Button Component
 *
 * Clinical-grade button with proper touch targets and visual feedback.
 */

import React from 'react';
import { cn } from '../../lib/utils';

interface EAButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const EAButton = React.forwardRef<HTMLButtonElement, EAButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, icon, children, disabled, ...props }, ref) => {
    const variants = {
      primary: 'bg-[#00857a] hover:bg-[#006d64] active:bg-[#00554e] text-white',
      secondary: 'bg-slate-700 hover:bg-slate-600 text-white border border-slate-600',
      ghost: 'hover:bg-slate-700/50 text-slate-300 hover:text-white',
      danger: 'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white',
      accent: 'bg-[#FF6B35] hover:bg-[#e55a2b] active:bg-[#cc4f24] text-white',
    };

    const sizes = {
      sm: 'h-8 px-3 text-xs gap-1.5',
      md: 'h-10 px-4 text-sm gap-2',
      lg: 'h-12 px-6 text-base gap-2.5',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center font-medium rounded-md',
          'transition-colors duration-150',
          'focus:outline-none focus:ring-2 focus:ring-[#00857a]/50 focus:ring-offset-2 focus:ring-offset-slate-900',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : icon ? (
          <span className="shrink-0">{icon}</span>
        ) : null}
        {children}
      </button>
    );
  }
);
EAButton.displayName = 'EAButton';

export default EAButton;
