/**
 * SOC2 Compliance Dashboard - Shared Helper Components
 *
 * Reusable UI components for metrics, badges, and formatting
 * used across all SOC2 dashboard tabs.
 */

import React from 'react';
import { EABadge } from '../../envision-atlus';

// ============================================================================
// Metric Card
// ============================================================================

interface MetricCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  color?: 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'indigo';
  highlight?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subValue,
  color = 'blue',
  highlight = false,
}) => {
  const colorClasses = {
    red: 'text-red-400',
    orange: 'text-orange-400',
    yellow: 'text-yellow-400',
    green: 'text-green-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    indigo: 'text-indigo-400',
  };

  return (
    <div className={`bg-slate-800 rounded-lg p-4 border ${highlight ? 'border-red-500 border-2' : 'border-slate-700'}`}>
      <div className="text-sm text-slate-400 mb-1">{label}</div>
      <div className={`text-3xl font-bold ${colorClasses[color]}`}>{value}</div>
      {subValue && <div className="text-sm text-slate-500 mt-1">{subValue}</div>}
    </div>
  );
};

// ============================================================================
// Badge Components
// ============================================================================

export const SeverityBadge: React.FC<{ severity: string }> = ({ severity }) => {
  const variants: Record<string, 'critical' | 'elevated' | 'info' | 'normal' | 'neutral'> = {
    CRITICAL: 'critical',
    HIGH: 'elevated',
    MEDIUM: 'info',
    LOW: 'normal',
  };
  return <EABadge variant={variants[severity] || 'neutral'}>{severity}</EABadge>;
};

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const variants: Record<string, 'normal' | 'critical' | 'elevated'> = {
    COMPLIANT: 'normal',
    NON_COMPLIANT: 'critical',
    NEEDS_REVIEW: 'elevated',
    PASS: 'normal',
    FAIL: 'critical',
  };
  return <EABadge variant={variants[status] || 'neutral'}>{status}</EABadge>;
};

export const SLABadge: React.FC<{ slaStatus: string }> = ({ slaStatus }) => {
  const variants: Record<string, 'critical' | 'normal' | 'info'> = {
    SLA_BREACH: 'critical',
    WITHIN_SLA: 'normal',
    RESOLVED: 'info',
  };
  return <EABadge variant={variants[slaStatus] || 'neutral'}>{slaStatus.replace(/_/g, ' ')}</EABadge>;
};

// ============================================================================
// Format Helpers
// ============================================================================

export const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
};

export const formatTimeAgo = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return formatTimestamp(timestamp);
};

export const formatHoursSince = (hours: number): string => {
  if (hours < 1) return `${Math.round(hours * 60)}m ago`;
  if (hours < 24) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};
