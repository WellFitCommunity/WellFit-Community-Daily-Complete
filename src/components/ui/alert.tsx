import React from 'react';
import { cn } from '../../lib/utils';

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive';
  ref?: React.Ref<HTMLDivElement>;
}

function Alert({ className, variant = 'default', ref, ...props }: AlertProps) {
  return (
    <div
      ref={ref}
      role="alert"
      className={cn(
        'relative w-full rounded-lg border p-4',
        {
          'border-gray-200 bg-white text-gray-950': variant === 'default',
          'border-red-200 bg-red-50 text-red-900': variant === 'destructive',
        },
        className
      )}
      {...props}
    />
  );
}

interface AlertDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  ref?: React.Ref<HTMLParagraphElement>;
}

function AlertDescription({ className, ref, ...props }: AlertDescriptionProps) {
  return (
    <div
      ref={ref}
      className={cn('text-sm [&_p]:leading-relaxed', className)}
      {...props}
    />
  );
}

export { Alert, AlertDescription };
