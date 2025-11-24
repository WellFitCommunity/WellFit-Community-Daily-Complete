/**
 * EARiskIndicator - Envision Atlus Risk Indicator
 *
 * Visual risk level display following medical severity standards.
 * Designed for quick triage scanning.
 */

import React from 'react';
import { cn } from '../../lib/utils';
import { getRiskStyles, RiskLevel } from '../../styles/envision-atlus-theme';
import { AlertTriangle, AlertCircle, CheckCircle, Info } from 'lucide-react';

interface EARiskIndicatorProps {
  level: RiskLevel | string;
  score?: number;
  label?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'badge' | 'bar' | 'circle';
  className?: string;
}

export const EARiskIndicator: React.FC<EARiskIndicatorProps> = ({
  level,
  score,
  label,
  showIcon = true,
  size = 'md',
  variant = 'badge',
  className,
}) => {
  const styles = getRiskStyles(level);
  const normalizedLevel = level.toLowerCase();

  const icons = {
    critical: AlertCircle,
    high: AlertTriangle,
    elevated: AlertTriangle,
    moderate: Info,
    normal: CheckCircle,
    low: CheckCircle,
  };

  const Icon = icons[normalizedLevel as keyof typeof icons] || Info;

  const sizes = {
    sm: {
      badge: 'px-2 py-0.5 text-xs gap-1',
      icon: 'h-3 w-3',
      bar: 'h-1',
      circle: 'h-8 w-8 text-xs',
    },
    md: {
      badge: 'px-2.5 py-1 text-sm gap-1.5',
      icon: 'h-4 w-4',
      bar: 'h-2',
      circle: 'h-12 w-12 text-sm',
    },
    lg: {
      badge: 'px-3 py-1.5 text-base gap-2',
      icon: 'h-5 w-5',
      bar: 'h-3',
      circle: 'h-16 w-16 text-lg',
    },
  };

  // Badge variant
  if (variant === 'badge') {
    return (
      <span
        className={cn(
          'inline-flex items-center font-medium rounded-md border',
          styles.badge,
          sizes[size].badge,
          className
        )}
      >
        {showIcon && <Icon className={sizes[size].icon} />}
        <span className="capitalize">{label || level}</span>
        {score !== undefined && (
          <span className="font-bold ml-1">{score}</span>
        )}
      </span>
    );
  }

  // Bar variant (horizontal progress-like)
  if (variant === 'bar') {
    const percentage = score !== undefined ? Math.min(score, 100) : 0;
    return (
      <div className={cn('w-full', className)}>
        {label && (
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400">{label}</span>
            {score !== undefined && (
              <span className={cn('text-xs font-medium', styles.text)}>{score}</span>
            )}
          </div>
        )}
        <div className={cn('w-full bg-slate-700 rounded-full overflow-hidden', sizes[size].bar)}>
          <div
            className={cn('h-full rounded-full transition-all duration-500', styles.bg)}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  }

  // Circle variant (donut-style)
  if (variant === 'circle') {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-full border-2',
          styles.border,
          styles.bgLight,
          sizes[size].circle,
          className
        )}
      >
        {score !== undefined ? (
          <span className={cn('font-bold', styles.text)}>{score}</span>
        ) : (
          <Icon className={cn(sizes[size].icon, styles.text)} />
        )}
      </div>
    );
  }

  return null;
};

export default EARiskIndicator;
