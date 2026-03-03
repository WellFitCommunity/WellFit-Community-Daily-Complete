/**
 * PriorAuthBadges — Status and Urgency badge components
 *
 * Reusable badge components for displaying prior auth status and urgency levels.
 * Used by: PriorAuthList, PriorAuthDashboard
 */

import React from 'react';
import type { PriorAuthStatus, PriorAuthUrgency } from '../../../services/fhir/prior-auth';
import { STATUS_CONFIG } from './types';

export const StatusBadge: React.FC<{ status: PriorAuthStatus }> = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  );
};

export const UrgencyBadge: React.FC<{ urgency: PriorAuthUrgency }> = ({ urgency }) => {
  const map: Record<PriorAuthUrgency, { label: string; cls: string }> = {
    stat: { label: 'STAT', cls: 'bg-red-600 text-white' },
    urgent: { label: 'Urgent', cls: 'bg-orange-500 text-white' },
    routine: { label: 'Routine', cls: 'bg-gray-200 text-gray-700' },
  };
  const cfg = map[urgency];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
};
