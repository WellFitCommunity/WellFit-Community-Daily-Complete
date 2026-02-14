/**
 * SAFER Guides Assessment — helper functions
 *
 * Extracted from SaferGuidesAssessment.tsx to stay under 600-line limit.
 */

import React from 'react';

export function getStatusIcon(
  status: string,
  CheckCircle: React.FC<{ className?: string }>,
  Circle: React.FC<{ className?: string }>
): React.ReactElement {
  switch (status) {
    case 'complete':
      return React.createElement(CheckCircle, { className: 'w-5 h-5 text-green-500' });
    case 'in_progress':
      return React.createElement(Circle, { className: 'w-5 h-5 text-yellow-500 fill-yellow-100' });
    default:
      return React.createElement(Circle, { className: 'w-5 h-5 text-slate-300' });
  }
}

export function getCategoryColor(category: string): string {
  switch (category) {
    case 'Foundation':
      return 'bg-purple-100 text-purple-800';
    case 'Governance':
      return 'bg-blue-100 text-blue-800';
    case 'Operations':
      return 'bg-orange-100 text-orange-800';
    case 'Technical':
      return 'bg-cyan-100 text-cyan-800';
    case 'Clinical':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-slate-100 text-slate-800';
  }
}

export function getScoreColor(score: number | null): string {
  if (score === null) return 'text-slate-400';
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  return 'text-red-600';
}
