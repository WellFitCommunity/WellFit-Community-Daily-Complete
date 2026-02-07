/**
 * ReadmissionOverviewTab - Overview tab content for the readmission dashboard.
 *
 * Shows risk distribution bars, quick action buttons, and three circular
 * engagement gauges (engagement, check-in completion, medication adherence).
 */

import React from 'react';
import {
  AlertTriangle,
  Users,
  Phone,
  Stethoscope,
} from 'lucide-react';
import {
  EACard,
  EACardHeader,
  EACardContent,
} from '../../envision-atlus';
import type {
  DashboardMetrics,
  CommunityMember,
  RiskBarProps,
  ActionButtonProps,
} from './CommunityReadmission.types';

// ============================================================================
// RiskBar - Individual risk tier progress bar
// ============================================================================

const RiskBar: React.FC<RiskBarProps> = ({ label, count, total, color }) => {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-300">{label}</span>
        <span className="text-white font-medium">{count} members</span>
      </div>
      <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

// ============================================================================
// ActionButton - Quick action button with badge count
// ============================================================================

const ActionButton: React.FC<ActionButtonProps> = ({ icon, label, count, onClick, urgent }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
      urgent
        ? 'bg-red-500/20 hover:bg-red-500/30 border border-red-500/30'
        : 'bg-slate-700/50 hover:bg-slate-700'
    }`}
  >
    <div className="flex items-center gap-3">
      <span className={urgent ? 'text-red-400' : 'text-slate-400'}>{icon}</span>
      <span className="text-white">{label}</span>
    </div>
    {count > 0 && (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
        urgent ? 'bg-red-500 text-white' : 'bg-slate-600 text-white'
      }`}>
        {count}
      </span>
    )}
  </button>
);

// ============================================================================
// EngagementGauge - Circular SVG progress gauge
// ============================================================================

interface EngagementGaugeProps {
  label: string;
  value: number;
  color: string;
  bgColor: string;
}

const EngagementGauge: React.FC<EngagementGaugeProps> = ({ label, value, color, bgColor }) => {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="text-center">
      <div className="relative inline-block">
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={radius} fill="none" stroke={bgColor} strokeWidth="8" />
          <circle
            cx="60" cy="60" r={radius} fill="none"
            stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 60 60)"
          />
          <text x="60" y="60" textAnchor="middle" dominantBaseline="central"
            className="fill-white text-2xl font-bold">
            {value}%
          </text>
        </svg>
      </div>
      <p className="text-sm text-slate-400 mt-2">{label}</p>
    </div>
  );
};

// ============================================================================
// ReadmissionOverviewTab - Main export
// ============================================================================

interface ReadmissionOverviewTabProps {
  metrics: DashboardMetrics;
  members: CommunityMember[];
  onTabChange: (tab: string) => void;
}

export const ReadmissionOverviewTab: React.FC<ReadmissionOverviewTabProps> = ({
  metrics, members, onTabChange,
}) => {
  const totalMembers = members.length;
  const criticalCount = members.filter(m => m.risk_category === 'critical').length;
  const highCount = members.filter(m => m.risk_category === 'high').length;
  const moderateCount = members.filter(m => m.risk_category === 'moderate').length;
  const missedCheckIns = members.filter(m => m.missed_check_ins_7d > 2).length;
  const noCarePlan = members.filter(m => !m.has_active_care_plan).length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Risk Distribution */}
      <EACard>
        <EACardHeader icon={<AlertTriangle className="text-red-400" />}>
          <h3 className="font-semibold text-white">Risk Distribution</h3>
          <p className="text-sm text-slate-400">{totalMembers} members tracked</p>
        </EACardHeader>
        <EACardContent>
          <div className="space-y-4">
            <RiskBar label="Critical (80+)" count={criticalCount} total={totalMembers} color="bg-red-500" />
            <RiskBar label="High (60-79)" count={highCount} total={totalMembers} color="bg-orange-500" />
            <RiskBar label="Moderate (40-59)" count={moderateCount} total={totalMembers} color="bg-yellow-500" />
          </div>
        </EACardContent>
      </EACard>

      {/* Quick Actions */}
      <EACard>
        <EACardHeader icon={<Stethoscope className="text-[#00857a]" />}>
          <h3 className="font-semibold text-white">Quick Actions</h3>
          <p className="text-sm text-slate-400">Priority interventions</p>
        </EACardHeader>
        <EACardContent>
          <div className="space-y-3">
            <ActionButton
              icon={<AlertTriangle size={18} />}
              label="Critical Risk Members"
              count={criticalCount}
              onClick={() => onTabChange('members')}
              urgent
            />
            <ActionButton
              icon={<Phone size={18} />}
              label="Missed Check-ins"
              count={missedCheckIns}
              onClick={() => onTabChange('engagement')}
              urgent={missedCheckIns > 3}
            />
            <ActionButton
              icon={<Users size={18} />}
              label="No Care Plan"
              count={noCarePlan}
              onClick={() => onTabChange('members')}
            />
          </div>
        </EACardContent>
      </EACard>

      {/* Engagement Gauges */}
      <EACard>
        <EACardHeader icon={<Users className="text-blue-400" />}>
          <h3 className="font-semibold text-white">Engagement Metrics</h3>
          <p className="text-sm text-slate-400">Community health indicators</p>
        </EACardHeader>
        <EACardContent>
          <div className="flex justify-around py-4">
            <EngagementGauge
              label="Engagement"
              value={metrics.avg_engagement_score}
              color="#00857a"
              bgColor="#1e293b"
            />
            <EngagementGauge
              label="Check-ins"
              value={metrics.check_in_completion_rate}
              color="#3b82f6"
              bgColor="#1e293b"
            />
            <EngagementGauge
              label="Med Adherence"
              value={metrics.medication_adherence_rate}
              color="#8b5cf6"
              bgColor="#1e293b"
            />
          </div>
        </EACardContent>
      </EACard>
    </div>
  );
};

export default ReadmissionOverviewTab;
