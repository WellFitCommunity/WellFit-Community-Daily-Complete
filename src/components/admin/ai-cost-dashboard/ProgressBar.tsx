/**
 * ProgressBar - Horizontal progress bar with label
 *
 * Purpose: Visualize model distribution percentages
 * Used by: AICostDashboard (Model Usage section)
 */

import React from 'react';

interface ProgressBarProps {
  label: string;
  value: number;
  max: number;
  color?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ label, value, max, color = 'bg-teal-500' }) => {
  const percentage = max > 0 ? (value / max) * 100 : 0;

  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-300">{label}</span>
        <span className="text-slate-400">{percentage.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-300`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
};
