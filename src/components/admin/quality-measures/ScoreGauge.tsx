/**
 * ScoreGauge — Semicircular gauge for MIPS category scores
 *
 * Displays a 0-100 score as a colored arc with label.
 */

import React from 'react';

interface ScoreGaugeProps {
  score: number;
  maxScore?: number;
  label: string;
  weight?: number;
  size?: 'sm' | 'md' | 'lg';
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-emerald-400';
  if (score >= 40) return 'text-yellow-400';
  if (score >= 20) return 'text-orange-400';
  return 'text-red-400';
}

function getStrokeColor(score: number): string {
  if (score >= 80) return '#4ade80';
  if (score >= 60) return '#34d399';
  if (score >= 40) return '#facc15';
  if (score >= 20) return '#fb923c';
  return '#f87171';
}

const SIZES = {
  sm: { width: 100, height: 60, strokeWidth: 8, fontSize: 'text-lg' },
  md: { width: 140, height: 80, strokeWidth: 10, fontSize: 'text-2xl' },
  lg: { width: 180, height: 100, strokeWidth: 12, fontSize: 'text-3xl' },
};

export const ScoreGauge: React.FC<ScoreGaugeProps> = ({
  score,
  maxScore = 100,
  label,
  weight,
  size = 'md',
}) => {
  const config = SIZES[size];
  const normalizedScore = Math.min(Math.max(score, 0), maxScore);
  const percentage = (normalizedScore / maxScore) * 100;

  // SVG arc calculation (semicircle)
  const cx = config.width / 2;
  const cy = config.height;
  const radius = cx - config.strokeWidth;
  const circumference = Math.PI * radius;
  const dashOffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <svg
        width={config.width}
        height={config.height + 10}
        viewBox={`0 0 ${config.width} ${config.height + 10}`}
        className="overflow-visible"
      >
        {/* Background arc */}
        <path
          d={`M ${config.strokeWidth} ${cy} A ${radius} ${radius} 0 0 1 ${config.width - config.strokeWidth} ${cy}`}
          fill="none"
          stroke="#334155"
          strokeWidth={config.strokeWidth}
          strokeLinecap="round"
        />
        {/* Score arc */}
        <path
          d={`M ${config.strokeWidth} ${cy} A ${radius} ${radius} 0 0 1 ${config.width - config.strokeWidth} ${cy}`}
          fill="none"
          stroke={getStrokeColor(percentage)}
          strokeWidth={config.strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="transition-all duration-700"
        />
      </svg>
      <p className={`${config.fontSize} font-bold ${getScoreColor(percentage)} -mt-6`}>
        {normalizedScore.toFixed(1)}
      </p>
      <p className="text-slate-300 text-sm font-medium mt-1">{label}</p>
      {weight !== undefined && (
        <p className="text-slate-500 text-xs">{(weight * 100).toFixed(0)}% weight</p>
      )}
    </div>
  );
};
