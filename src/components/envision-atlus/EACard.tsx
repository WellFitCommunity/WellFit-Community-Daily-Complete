/**
 * EACard - Envision Atlus Card Component
 *
 * Professional card component for clinical dashboards.
 */

import React from 'react';
import { cn } from '../../lib/utils';

interface EACardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'highlight';
}

export const EACard = React.forwardRef<HTMLDivElement, EACardProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variants = {
      default: 'bg-slate-800 border-slate-700',
      elevated: 'bg-slate-800 border-slate-600 shadow-lg shadow-black/20',
      highlight: 'bg-linear-to-br from-[#00857a]/10 to-slate-800 border-[#00857a]/30',
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
);
EACard.displayName = 'EACard';

interface EACardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export const EACardHeader = React.forwardRef<HTMLDivElement, EACardHeaderProps>(
  ({ className, icon, action, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center justify-between px-6 py-4 border-b border-slate-700', className)}
      {...props}
    >
      <div className="flex items-center gap-3">
        {icon && <span className="text-[#00857a]">{icon}</span>}
        <div>{children}</div>
      </div>
      {action && <div>{action}</div>}
    </div>
  )
);
EACardHeader.displayName = 'EACardHeader';

export const EACardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6', className)} {...props} />
));
EACardContent.displayName = 'EACardContent';

export const EACardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center px-6 py-4 border-t border-slate-700 bg-slate-900/50', className)}
    {...props}
  />
));
EACardFooter.displayName = 'EACardFooter';

export default EACard;
