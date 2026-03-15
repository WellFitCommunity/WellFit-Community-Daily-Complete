/**
 * PriorAuthStatCards — Statistics card grid for the Prior Auth dashboard
 *
 * Displays key metrics: total submitted, approval rate, avg response, SLA compliance.
 * Used by: PriorAuthDashboard
 */

import React from 'react';
import type { PriorAuthStatistics } from '../../../services/fhir/prior-auth';
import { FileText, CheckCircle, Clock, TrendingUp } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color }) => (
  <div className={`rounded-xl border p-5 ${color}`}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <p className="mt-1 text-2xl font-bold">{value}</p>
      </div>
      <div className="p-3 rounded-lg bg-white/50">{icon}</div>
    </div>
  </div>
);

interface PriorAuthStatCardsProps {
  stats: PriorAuthStatistics;
}

export const PriorAuthStatCards: React.FC<PriorAuthStatCardsProps> = ({ stats }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    <StatCard
      label="Total Submitted"
      value={stats.total_submitted}
      icon={<FileText className="w-6 h-6 text-[var(--ea-primary)]" />}
      color="bg-blue-50 border-blue-200"
    />
    <StatCard
      label="Approval Rate"
      value={`${stats.approval_rate.toFixed(0)}%`}
      icon={<CheckCircle className="w-6 h-6 text-green-600" />}
      color="bg-green-50 border-green-200"
    />
    <StatCard
      label="Avg Response (hrs)"
      value={stats.avg_response_hours.toFixed(1)}
      icon={<Clock className="w-6 h-6 text-indigo-600" />}
      color="bg-indigo-50 border-indigo-200"
    />
    <StatCard
      label="SLA Compliance"
      value={`${stats.sla_compliance_rate.toFixed(0)}%`}
      icon={<TrendingUp className="w-6 h-6 text-emerald-600" />}
      color="bg-emerald-50 border-emerald-200"
    />
  </div>
);
