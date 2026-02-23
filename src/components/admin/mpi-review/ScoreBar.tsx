/**
 * ScoreBar — Match score visualization bar
 *
 * @module mpi-review/ScoreBar
 * Copyright © 2025-2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React from 'react';

interface ScoreBarProps {
  score: number;
  label?: string;
  showPercentage?: boolean;
}

const ScoreBar: React.FC<ScoreBarProps> = ({ score, label, showPercentage = true }) => {
  const getScoreColor = (s: number) => {
    if (s >= 95) return 'bg-red-500';
    if (s >= 85) return 'bg-orange-500';
    if (s >= 75) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  return (
    <div className="w-full">
      {label && <div className="text-xs text-gray-500 mb-1">{label}</div>}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${getScoreColor(score)} transition-all duration-300`}
            style={{ width: `${Math.min(score, 100)}%` }}
          />
        </div>
        {showPercentage && (
          <span className="text-sm font-medium text-gray-700 w-12 text-right">
            {score.toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  );
};

export default ScoreBar;
