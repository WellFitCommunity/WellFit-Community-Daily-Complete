/**
 * ReadmissionMetricCards - KPI metric cards for the readmission dashboard header.
 *
 * Renders the 5-card summary row: high-risk members, readmissions, CMS penalty,
 * prevented readmissions, and cost savings.
 */

import React from 'react';
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Activity,
  Shield,
  Heart,
  DollarSign,
} from 'lucide-react';
import type { DashboardMetrics, MetricCardProps } from './CommunityReadmission.types';

// ============================================================================
// MetricCard - Individual KPI card
// ============================================================================

export const MetricCard: React.FC<MetricCardProps> = ({
  title, value, icon, change, changeLabel, subtitle, alert, bgColor
}) => (
  <div className={`rounded-xl p-4 border ${alert ? 'border-red-500/50' : 'border-slate-700'} ${bgColor || 'bg-slate-800'}`}>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-slate-400">{title}</p>
        <p className="text-3xl font-bold text-white mt-1">{value}</p>
        {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        {change !== undefined && (
          <div className={`flex items-center gap-1 mt-2 text-xs ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {change >= 0 ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
            <span>{Math.abs(change)}% {changeLabel}</span>
          </div>
        )}
      </div>
      <div className="p-2 rounded-lg bg-slate-700/50">{icon}</div>
    </div>
  </div>
);

// ============================================================================
// ReadmissionMetricCards - The 5-card KPI row
// ============================================================================

interface ReadmissionMetricCardsProps {
  metrics: DashboardMetrics;
}

export const ReadmissionMetricCards: React.FC<ReadmissionMetricCardsProps> = ({ metrics }) => (
  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
    <MetricCard
      title="High-Risk Members"
      value={metrics.total_high_risk_members}
      icon={<AlertTriangle className="text-red-400" size={24} />}
      subtitle="Risk score >= 60"
      alert={metrics.total_high_risk_members > 0}
      bgColor="bg-red-500/10"
    />
    <MetricCard
      title="30-Day Readmissions"
      value={metrics.total_readmissions_30d}
      icon={<Activity className="text-orange-400" size={24} />}
      subtitle="Unplanned readmissions"
      alert={metrics.total_readmissions_30d > 0}
    />
    <MetricCard
      title="CMS Penalty Risk"
      value={metrics.cms_penalty_risk_count}
      icon={<Shield className="text-yellow-400" size={24} />}
      subtitle="Patients flagged"
      alert={metrics.cms_penalty_risk_count > 0}
    />
    <MetricCard
      title="Prevented Readmissions"
      value={metrics.prevented_readmissions}
      icon={<Heart className="text-green-400" size={24} />}
      subtitle="Via care coordination"
      bgColor="bg-green-500/10"
    />
    <MetricCard
      title="Cost Savings"
      value={`$${(metrics.cost_savings_estimate / 1000).toFixed(0)}K`}
      icon={<DollarSign className="text-emerald-400" size={24} />}
      subtitle="Estimated 90-day savings"
      bgColor="bg-emerald-500/10"
    />
  </div>
);

export default ReadmissionMetricCards;
