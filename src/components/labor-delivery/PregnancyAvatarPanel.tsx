/**
 * PregnancyAvatarPanel - Pregnancy avatar visualization for L&D dashboard
 *
 * Shows pregnant body at correct trimester, GA label, risk border,
 * OB badges, and quick-info (G/P, EDD, blood type).
 * Click to expand to full marker management.
 */

import React, { useState } from 'react';
import type { LDPregnancy } from '../../types/laborDelivery';
import { calculateGestationalAge } from '../../types/laborDelivery';
import type { BodyView } from '../../types/patientAvatar';
import { PregnancyAvatarBody } from '../patient-avatar/PregnancyAvatarBody';

interface PregnancyAvatarPanelProps {
  pregnancy: LDPregnancy;
  patientName?: string;
  /** Compact mode for sidebar embedding */
  compact?: boolean;
  className?: string;
}

const RISK_BORDER_COLORS: Record<string, string> = {
  low: 'border-green-400',
  moderate: 'border-yellow-400',
  high: 'border-orange-400',
  critical: 'border-red-400',
};

const RISK_BG_COLORS: Record<string, string> = {
  low: 'bg-green-50',
  moderate: 'bg-yellow-50',
  high: 'bg-orange-50',
  critical: 'bg-red-50',
};

const RISK_TEXT_COLORS: Record<string, string> = {
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

export const PregnancyAvatarPanel: React.FC<PregnancyAvatarPanelProps> = ({
  pregnancy,
  patientName,
  compact = false,
  className,
}) => {
  const [view, setView] = useState<BodyView>('front');

  const ga = calculateGestationalAge(pregnancy.edd);
  const trimester = deriveTrimester(ga.weeks);
  const riskBorder = RISK_BORDER_COLORS[pregnancy.risk_level] || 'border-gray-300';
  const riskBg = RISK_BG_COLORS[pregnancy.risk_level] || 'bg-gray-50';
  const riskText = RISK_TEXT_COLORS[pregnancy.risk_level] || 'text-gray-700';

  return (
    <div className={`rounded-lg border-2 ${riskBorder} ${className || ''}`}>
      {/* Header with GA */}
      <div className={`px-3 py-2 border-b ${riskBorder} ${riskBg}`}>
        <div className="flex items-center justify-between">
          <div>
            {patientName && (
              <p className="text-xs text-gray-500 truncate max-w-[140px]">{patientName}</p>
            )}
            <p className="text-lg font-bold text-gray-900">
              {ga.weeks}w {ga.days}d
            </p>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${riskBg} ${riskText}`}>
            {pregnancy.risk_level.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Avatar */}
      <div className="flex justify-center py-3 px-2">
        <PregnancyAvatarBody
          skinTone="medium"
          trimester={trimester}
          view={view}
          size={compact ? 'thumbnail' : 'full'}
        />
      </div>

      {/* View toggle */}
      <div className="flex justify-center gap-2 pb-2">
        <button
          onClick={() => setView('front')}
          className={`px-2 py-0.5 text-xs rounded ${
            view === 'front'
              ? 'bg-pink-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Front
        </button>
        <button
          onClick={() => setView('back')}
          className={`px-2 py-0.5 text-xs rounded ${
            view === 'back'
              ? 'bg-pink-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Back
        </button>
      </div>

      {/* Quick info */}
      <div className="px-3 pb-3 space-y-1">
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

        {/* OB Status Badges */}
        {!compact && (
          <div className="flex flex-wrap gap-1 pt-1">
            {pregnancy.risk_level !== 'low' && (
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${riskBg} ${riskText}`}>
                OB Risk: {pregnancy.risk_level}
              </span>
            )}
            {pregnancy.gbs_status === 'positive' && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-700">
                GBS+
              </span>
            )}
          </div>
        )}

        {/* Risk factors (non-compact) */}
        {!compact && pregnancy.risk_factors.length > 0 && (
          <div className="pt-1">
            <p className="text-[10px] text-gray-400 mb-0.5">Risk Factors</p>
            <div className="flex flex-wrap gap-0.5">
              {pregnancy.risk_factors.map((rf) => (
                <span key={rf} className="px-1 py-0.5 bg-red-50 text-red-600 rounded text-[9px]">
                  {rf}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PregnancyAvatarPanel;
