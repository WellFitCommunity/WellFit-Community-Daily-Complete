/**
 * CommunityReadmission.types.ts - Shared types and utilities for the readmission dashboard.
 *
 * All interfaces align with the database views:
 *   - v_readmission_dashboard_metrics → DashboardMetrics
 *   - v_readmission_high_risk_members → CommunityMember
 *   - v_readmission_active_alerts → CommunityAlert
 */

import React from 'react';

// ============================================================================
// VIEW-ALIGNED INTERFACES
// ============================================================================

/** Maps to v_readmission_high_risk_members view columns */
export interface CommunityMember {
  id: string;
  first_name: string;
  last_name: string;
  phone?: string;
  discharge_facility?: string;
  primary_diagnosis?: string;
  risk_score: number;
  risk_category: 'low' | 'moderate' | 'high' | 'critical';
  total_visits_30d: number;
  er_visits_30d: number;
  readmissions_30d: number;
  last_check_in?: string;
  check_in_streak: number;
  missed_check_ins_7d: number;
  has_active_care_plan: boolean;
  sdoh_risk_factors: string[];
  engagement_score: number;
  medication_adherence: number;
  cms_penalty_risk: boolean;
  predicted_readmission_date?: string;
  days_since_discharge?: number;
  wellfit_member_since?: string;
  estimated_savings?: number;
}

/** Maps to v_readmission_dashboard_metrics view columns */
export interface DashboardMetrics {
  total_high_risk_members: number;
  total_readmissions_30d: number;
  cms_penalty_risk_count: number;
  prevented_readmissions: number;
  active_care_plans: number;
  avg_engagement_score: number;
  check_in_completion_rate: number;
  medication_adherence_rate: number;
  cost_savings_estimate: number;
  critical_alerts: number;
}

/** Maps to v_readmission_active_alerts view columns */
export interface CommunityAlert {
  alert_id: string;
  member_id: string;
  member_name: string;
  alert_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  created_at: string;
  status: 'active' | 'acknowledged' | 'resolved';
  recommended_action?: string;
}

/** Client-side aggregation of SDOH factors from member data */
export interface SDOHSummary {
  category: string;
  count: number;
  risk_impact: 'low' | 'moderate' | 'high';
  icon: React.ReactNode;
}

// ============================================================================
// SUB-COMPONENT PROP INTERFACES
// ============================================================================

export interface MetricCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  change?: number;
  changeLabel?: string;
  subtitle?: string;
  alert?: boolean;
  bgColor?: string;
}

export interface RiskBarProps {
  label: string;
  count: number;
  total: number;
  color: string;
}

export interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  count: number;
  onClick: () => void;
  urgent?: boolean;
}

export interface MemberRowProps {
  member: CommunityMember;
  onSelect: () => void;
}

export interface AlertCardProps {
  alert: CommunityAlert;
}

export interface ImpactRowProps {
  label: string;
  reduction: number;
}

export interface MemberDetailModalProps {
  member: CommunityMember;
  onClose: () => void;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export const getRiskColor = (category: string): string => {
  switch (category) {
    case 'critical': return 'text-red-400 bg-red-500/20 border-red-500/50';
    case 'high': return 'text-orange-400 bg-orange-500/20 border-orange-500/50';
    case 'moderate': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/50';
    default: return 'text-green-400 bg-green-500/20 border-green-500/50';
  }
};

export const getRiskBgColor = (score: number): string => {
  if (score >= 80) return 'bg-linear-to-r from-red-600 to-red-500';
  if (score >= 60) return 'bg-linear-to-r from-orange-600 to-orange-500';
  if (score >= 40) return 'bg-linear-to-r from-yellow-600 to-yellow-500';
  return 'bg-linear-to-r from-green-600 to-green-500';
};

/** Aggregate SDOH risk factors from members into summary counts */
export function aggregateSdohFactors(
  members: CommunityMember[],
  iconMap: Record<string, React.ReactNode>
): SDOHSummary[] {
  const counts = new Map<string, number>();
  for (const m of members) {
    for (const factor of m.sdoh_risk_factors) {
      counts.set(factor, (counts.get(factor) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([category, count]) => ({
      category,
      count,
      risk_impact: count >= 10 ? 'high' as const : count >= 5 ? 'moderate' as const : 'low' as const,
      icon: iconMap[category] || iconMap['default'],
    }));
}

/** Parse sdoh_risk_factors from view (may be JSON string or already array) */
export function parseSdohFactors(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed as string[] : [];
    } catch {
      return [];
    }
  }
  return [];
}
