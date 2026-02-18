/**
 * LaborAvatarPanel - Composite panel: pregnancy avatar + labor progress overlay + legend
 *
 * Purpose: Wraps PregnancyAvatarBody with live labor data visualization.
 *   Shows trimester-appropriate body with dilation ring, station marker,
 *   contraction overlay, and a text legend below.
 * Used by: LaborTab
 */

import React, { useState } from 'react';
import type { LDDashboardSummary } from '../../types/laborDelivery';
import { calculateGestationalAge } from '../../types/laborDelivery';
import type { BodyView } from '../../types/patientAvatar';
import { PregnancyAvatarBody } from '../patient-avatar/PregnancyAvatarBody';
import LaborProgressOverlay from './LaborProgressOverlay';
import LaborProgressLegend from './LaborProgressLegend';

interface LaborAvatarPanelProps {
  summary: LDDashboardSummary;
  compact?: boolean;
}

const RISK_BORDER: Record<string, string> = {
  low: 'border-green-400',
  moderate: 'border-yellow-400',
  high: 'border-orange-400',
  critical: 'border-red-400',
};

const RISK_BG: Record<string, string> = {
  low: 'bg-green-50',
  moderate: 'bg-yellow-50',
  high: 'bg-orange-50',
  critical: 'bg-red-50',
};

const RISK_TEXT: Record<string, string> = {
  low: 'text-green-700',
  moderate: 'text-yellow-700',
  high: 'text-orange-700',
  critical: 'text-red-700',
};

function deriveTrimester(weeks: number): 1 | 2 | 3 {
  if (weeks < 14) return 1;
  if (weeks < 28) return 2;
  return 3;
}

export const LaborAvatarPanel: React.FC<LaborAvatarPanelProps> = ({
  summary,
  compact = false,
}) => {
  const [view, setView] = useState<BodyView>('front');
  const { pregnancy, labor_events } = summary;

  if (!pregnancy) return null;

  const ga = calculateGestationalAge(pregnancy.edd);
  const trimester = deriveTrimester(ga.weeks);
  const borderColor = RISK_BORDER[pregnancy.risk_level] || 'border-gray-300';
  const bgColor = RISK_BG[pregnancy.risk_level] || 'bg-gray-50';
  const textColor = RISK_TEXT[pregnancy.risk_level] || 'text-gray-700';

  return (
    <div
      className={`rounded-lg border-2 ${borderColor} bg-white`}
      data-testid="labor-avatar-panel"
    >
      {/* Header */}
      <div className={`px-3 py-2 border-b ${borderColor} ${bgColor}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-700">Labor Progress Avatar</p>
            <p className="text-lg font-bold text-gray-900">
              {ga.weeks}w {ga.days}d
            </p>
          </div>
          <div className="text-right">
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${bgColor} ${textColor}`}>
              {pregnancy.risk_level.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Avatar with overlay */}
      <div className="flex justify-center py-3 px-2">
        <PregnancyAvatarBody
          skinTone="medium"
          trimester={trimester}
          view={view}
          size={compact ? 'thumbnail' : 'full'}
        >
          {view === 'front' && labor_events.length > 0 && (
            <LaborProgressOverlay laborEvents={labor_events} />
          )}
        </PregnancyAvatarBody>
      </div>

      {/* View toggle */}
      <div className="flex justify-center gap-2 pb-2">
        <button
          onClick={() => setView('front')}
          className={`px-2 py-0.5 text-xs rounded min-h-[44px] min-w-[44px] ${
            view === 'front'
              ? 'bg-pink-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Front
        </button>
        <button
          onClick={() => setView('back')}
          className={`px-2 py-0.5 text-xs rounded min-h-[44px] min-w-[44px] ${
            view === 'back'
              ? 'bg-pink-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Back
        </button>
      </div>

      {/* OB Quick Info */}
      <div className="px-3 pb-2">
        <div className="grid grid-cols-2 gap-1 text-xs">
          <div>
            <span className="text-gray-500">G/P: </span>
            <span className="font-medium">G{pregnancy.gravida}P{pregnancy.para}</span>
          </div>
          <div>
            <span className="text-gray-500">EDD: </span>
            <span className="font-medium">
              {new Date(pregnancy.edd).toLocaleDateString()}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Blood: </span>
            <span className="font-medium">{pregnancy.blood_type} {pregnancy.rh_factor}</span>
          </div>
          <div>
            <span className="text-gray-500">GBS: </span>
            <span className={`font-medium ${pregnancy.gbs_status === 'positive' ? 'text-red-600' : ''}`}>
              {pregnancy.gbs_status}
            </span>
          </div>
        </div>
      </div>

      {/* Labor Progress Legend */}
      <LaborProgressLegend laborEvents={labor_events} />
    </div>
  );
};

LaborAvatarPanel.displayName = 'LaborAvatarPanel';

export default LaborAvatarPanel;
