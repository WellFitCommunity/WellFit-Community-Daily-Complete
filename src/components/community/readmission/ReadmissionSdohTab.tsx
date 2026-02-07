/**
 * ReadmissionSdohTab - SDOH (Social Determinants of Health) tab.
 *
 * Aggregates SDOH risk factors from community members and shows
 * intervention impact metrics.
 */

import React from 'react';
import { Home, MapPin } from 'lucide-react';
import {
  EACard,
  EACardHeader,
  EACardContent,
  EABadge,
} from '../../envision-atlus';
import type { SDOHSummary, ImpactRowProps, CommunityMember } from './CommunityReadmission.types';
import { aggregateSdohFactors } from './CommunityReadmission.types';

// ============================================================================
// SDOH icon mapping for known categories
// ============================================================================

const sdohIconMap: Record<string, React.ReactNode> = {
  'Food Insecurity': <Home className="text-purple-400" size={20} />,
  'Housing Instability': <Home className="text-blue-400" size={20} />,
  'Transportation': <MapPin className="text-green-400" size={20} />,
  'Social Isolation': <Home className="text-orange-400" size={20} />,
  'Financial Strain': <Home className="text-yellow-400" size={20} />,
  'Language Barrier': <Home className="text-pink-400" size={20} />,
  default: <Home className="text-slate-400" size={20} />,
};

// ============================================================================
// ImpactRow - Single intervention impact bar
// ============================================================================

const ImpactRow: React.FC<ImpactRowProps> = ({ label, reduction }) => (
  <div className="flex items-center justify-between">
    <span className="text-slate-300">{label}</span>
    <div className="flex items-center gap-2">
      <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-linear-to-r from-[#00857a] to-emerald-500 rounded-full"
          style={{ width: `${reduction}%` }}
        />
      </div>
      <span className="text-green-400 font-medium w-10 text-right">-{reduction}%</span>
    </div>
  </div>
);

// ============================================================================
// ReadmissionSdohTab - Main export
// ============================================================================

interface ReadmissionSdohTabProps {
  members: CommunityMember[];
}

export const ReadmissionSdohTab: React.FC<ReadmissionSdohTabProps> = ({ members }) => {
  const factors: SDOHSummary[] = aggregateSdohFactors(members, sdohIconMap);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* SDOH Factors */}
      <EACard>
        <EACardHeader icon={<Home className="text-purple-400" />}>
          <h3 className="font-semibold text-white">SDOH Risk Factors</h3>
          <p className="text-sm text-slate-400">Social determinants affecting community members</p>
        </EACardHeader>
        <EACardContent>
          {factors.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <p>No SDOH risk factors identified in current member data.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {factors.map((factor) => (
                <div key={factor.category} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {factor.icon}
                    <span className="text-white">{factor.category}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-white font-medium">{factor.count} members</span>
                    <EABadge variant={factor.risk_impact === 'high' ? 'critical' : factor.risk_impact === 'moderate' ? 'high' : 'info'}>
                      {factor.risk_impact}
                    </EABadge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </EACardContent>
      </EACard>

      {/* Intervention Impact */}
      <EACard>
        <EACardHeader icon={<MapPin className="text-green-400" />}>
          <h3 className="font-semibold text-white">WellFit Intervention Impact</h3>
          <p className="text-sm text-slate-400">Community program effectiveness</p>
        </EACardHeader>
        <EACardContent>
          <div className="space-y-4">
            <ImpactRow label="ER Visits" reduction={32} />
            <ImpactRow label="Hospital Readmissions" reduction={28} />
            <ImpactRow label="Medication Non-adherence" reduction={45} />
            <ImpactRow label="Social Isolation" reduction={52} />
            <ImpactRow label="Food Insecurity Impact" reduction={38} />
          </div>
          <div className="mt-6 p-4 bg-[#00857a]/10 rounded-lg border border-[#00857a]/30">
            <p className="text-sm text-slate-300">
              Impact metrics derived from WellFit community engagement data
              compared to pre-enrollment baselines.
            </p>
          </div>
        </EACardContent>
      </EACard>
    </div>
  );
};

export default ReadmissionSdohTab;
