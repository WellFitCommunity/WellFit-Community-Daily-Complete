/**
 * EACard - Envision Atlus Card Component
 *
 * Professional card component for clinical dashboards.
 */

import React from 'react';
import { cn } from '../../lib/utils';

interface EACardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'highlight';
  ref?: React.Ref<HTMLDivElement>;
}

export function EACard({ className, variant = 'default', ref, ...props }: EACardProps) {
  const variants = {
    default: 'bg-slate-800 border-slate-700',
    elevated: 'bg-slate-800 border-slate-600 shadow-lg shadow-black/20',
    highlight: 'bg-linear-to-br from-[var(--ea-primary,#00857a)]/10 to-slate-800 border-[var(--ea-primary,#00857a)]/30',
  };

  return (
    <div
      ref={ref}
      className={cn(
        'rounded-lg border',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

interface EACardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  action?: React.ReactNode;
  ref?: React.Ref<HTMLDivElement>;
}

export function EACardHeader({ className, icon, action, children, ref, ...props }: EACardHeaderProps) {
  return (
    <div
      ref={ref}
      className={cn('flex items-center justify-between px-6 py-4 border-b border-slate-700', className)}
      {...props}
    >
      <div className="flex items-center gap-3">
        {icon && <span className="text-[var(--ea-primary,#00857a)]">{icon}</span>}
        <div>{children}</div>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

interface EACardSubProps extends React.HTMLAttributes<HTMLDivElement> {
  ref?: React.Ref<HTMLDivElement>;
}

export function EACardContent({ className, ref, ...props }: EACardSubProps) {
  return (
    <div ref={ref} className={cn('p-6', className)} {...props} />
  );
}

export function EACardFooter({ className, ref, ...props }: EACardSubProps) {
  return (
    <div
      ref={ref}
      className={cn('flex items-center px-6 py-4 border-t border-slate-700 bg-slate-900/50', className)}
      {...props}
    />
  );
}

export default EACard;
