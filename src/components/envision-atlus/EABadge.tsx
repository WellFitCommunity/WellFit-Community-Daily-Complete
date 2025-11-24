/**
 * EABadge - Envision Atlus Badge Component
 *
 * Status indicators following medical color standards.
 */

import React from 'react';
import { cn } from '../../lib/utils';

interface EABadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'critical' | 'high' | 'elevated' | 'normal' | 'info' | 'neutral';
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
}

export const EABadge = React.forwardRef<HTMLSpanElement, EABadgeProps>(
  ({ className, variant = 'neutral', size = 'md', pulse, children, ...props }, ref) => {
    const variants = {
      critical: 'bg-red-500/20 text-red-400 border-red-500/30',
      high: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      elevated: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      normal: 'bg-green-500/20 text-green-400 border-green-500/30',
      info: 'bg-[#00857a]/20 text-[#33bfb7] border-[#00857a]/30',
      neutral: 'bg-slate-600/50 text-slate-300 border-slate-500/30',
    };

    const sizes = {
      sm: 'px-1.5 py-0.5 text-xs',
      md: 'px-2 py-1 text-xs',
      lg: 'px-3 py-1.5 text-sm',
    };

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1.5 font-medium rounded border',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {pulse && (
          <span className="relative flex h-2 w-2">
            <span
              className={cn(
                'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
                variant === 'critical' && 'bg-red-400',
                variant === 'high' && 'bg-amber-400',
                variant === 'elevated' && 'bg-yellow-400',
                variant === 'normal' && 'bg-green-400',
                variant === 'info' && 'bg-[#00857a]',
                variant === 'neutral' && 'bg-slate-400'
              )}
            />
            <span
              className={cn(
                'relative inline-flex rounded-full h-2 w-2',
                variant === 'critical' && 'bg-red-500',
                variant === 'high' && 'bg-amber-500',
                variant === 'elevated' && 'bg-yellow-500',
                variant === 'normal' && 'bg-green-500',
                variant === 'info' && 'bg-[#00857a]',
                variant === 'neutral' && 'bg-slate-500'
              )}
            />
          </span>
        )}
        {children}
      </span>
    );
  }
);
EABadge.displayName = 'EABadge';

export default EABadge;
