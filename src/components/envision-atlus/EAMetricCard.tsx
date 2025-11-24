/**
 * EAMetricCard - Envision Atlus Metric Display
 *
 * Large number displays for clinical dashboards.
 * Optimized for quick scanning during triage.
 */

import React from 'react';
import { cn } from '../../lib/utils';
import { getRiskStyles, RiskLevel } from '../../styles/envision-atlus-theme';

interface EAMetricCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'stable';
  };
  riskLevel?: RiskLevel;
  icon?: React.ReactNode;
  className?: string;
}

export const EAMetricCard: React.FC<EAMetricCardProps> = ({
  label,
  value,
  sublabel,
  trend,
  riskLevel,
  icon,
  className,
}) => {
  const riskStyles = riskLevel ? getRiskStyles(riskLevel) : null;

  return (
    <div
      className={cn(
        'bg-slate-800 border rounded-lg p-4',
        riskStyles ? riskStyles.border : 'border-slate-700',
        className
      )}
    >
      {/* Label row */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
          {label}
        </span>
        {icon && <span className="text-slate-500">{icon}</span>}
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-2">
        <span
          className={cn(
            'text-3xl font-bold tabular-nums',
            riskStyles ? riskStyles.text : 'text-white'
          )}
        >
          {value}
        </span>

        {/* Trend indicator */}
        {trend && (
          <span
            className={cn(
              'text-sm font-medium flex items-center gap-0.5',
              trend.direction === 'up' && 'text-red-400',
              trend.direction === 'down' && 'text-green-400',
              trend.direction === 'stable' && 'text-slate-400'
            )}
          >
            {trend.direction === 'up' && (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17l5-5 5 5" />
              </svg>
            )}
            {trend.direction === 'down' && (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 7l-5 5-5-5" />
              </svg>
            )}
            {trend.direction === 'stable' && '—'}
            {trend.value !== 0 && `${Math.abs(trend.value)}%`}
          </span>
        )}
      </div>

      {/* Sublabel */}
      {sublabel && (
        <p className="text-xs text-slate-500 mt-1">{sublabel}</p>
      )}

      {/* Risk indicator bar */}
      {riskLevel && (
        <div className="mt-3 pt-3 border-t border-slate-700">
          <div className="flex items-center gap-2">
            <div className={cn('w-2 h-2 rounded-full', riskStyles?.bg)} />
            <span className={cn('text-xs font-medium capitalize', riskStyles?.text)}>
              {riskLevel} Risk
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default EAMetricCard;
