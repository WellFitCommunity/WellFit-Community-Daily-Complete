/**
 * VitalCard — Vital sign status indicator card
 *
 * Displays a single vital metric with color-coded status (normal/warning/critical)
 * and optional trend indicator.
 *
 * @module DoctorsView/VitalCard
 * Copyright 2025-2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

import TrendingUp from 'lucide-react/dist/esm/icons/trending-up';
import TrendingDown from 'lucide-react/dist/esm/icons/trending-down';
import type { VitalMetric } from './types';

const statusColors = {
  normal: 'bg-green-50 border-green-200',
  warning: 'bg-yellow-50 border-yellow-200',
  critical: 'bg-red-50 border-red-200',
};

const statusTextColors = {
  normal: 'text-green-700',
  warning: 'text-yellow-700',
  critical: 'text-red-700',
};

const statusBadgeColors = {
  normal: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  critical: 'bg-red-100 text-red-800',
};

export const VitalCard: React.FC<{ metric: VitalMetric }> = ({ metric }) => {
  const Icon = metric.icon;

  return (
    <div className={`p-4 rounded-lg border-2 ${statusColors[metric.status]} transition-all hover:shadow-md`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center space-x-2">
          <Icon className={`w-5 h-5 ${statusTextColors[metric.status]}`} />
          <span className="text-sm font-medium text-gray-700">{metric.label}</span>
        </div>
        {metric.trend && (
          <div className="flex items-center">
            {metric.trend === 'up' && <TrendingUp className="w-4 h-4 text-red-500" />}
            {metric.trend === 'down' && <TrendingDown className="w-4 h-4 text-blue-500" />}
            {metric.trend === 'stable' && <div className="w-4 h-0.5 bg-gray-400"></div>}
          </div>
        )}
      </div>
      <div className="flex items-baseline justify-between">
        <div>
          <span className={`text-2xl font-bold ${statusTextColors[metric.status]}`}>
            {metric.value}
          </span>
          <span className="text-sm text-gray-500 ml-1">{metric.unit}</span>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full ${statusBadgeColors[metric.status]}`}>
          {metric.status.toUpperCase()}
        </span>
      </div>
    </div>
  );
};
