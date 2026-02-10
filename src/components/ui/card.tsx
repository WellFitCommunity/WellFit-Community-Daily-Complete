import React from 'react';
import { cn } from '../../lib/utils';
import { useBranding } from '../../BrandingContext';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  ref?: React.Ref<HTMLDivElement>;
}

function Card({ className, ref, ...props }: CardProps) {
  const { branding } = useBranding();

  return (
    <div
      ref={ref}
      className={cn(
        'rounded-lg bg-white text-gray-950 shadow-lg border-2',
        className
      )}
      style={{
        borderColor: branding.primaryColor,
        boxShadow: `0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06), 0 0 0 1px ${branding.primaryColor}20`
      }}
      {...props}
    />
  );
}

interface CardSubProps extends React.HTMLAttributes<HTMLDivElement> {
  ref?: React.Ref<HTMLDivElement>;
}

function CardHeader({ className, ref, ...props }: CardSubProps) {
  return (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
  );
}

interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  ref?: React.Ref<HTMLParagraphElement>;
}

function CardTitle({ className, ref, ...props }: CardTitleProps) {
  return (
    <h3
      ref={ref}
      className={cn('text-lg font-semibold leading-none tracking-tight', className)}
      {...props}
    />
  );
}

interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  ref?: React.Ref<HTMLParagraphElement>;
}

function CardDescription({ className, ref, ...props }: CardDescriptionProps) {
  return (
    <p ref={ref} className={cn('text-sm text-gray-500', className)} {...props} />
  );
}

function CardContent({ className, ref, ...props }: CardSubProps) {
  return (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  );
}

function CardFooter({ className, ref, ...props }: CardSubProps) {
  return (
    <div ref={ref} className={cn('flex items-center p-6 pt-0', className)} {...props} />
  );
}

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
