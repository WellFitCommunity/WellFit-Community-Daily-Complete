/**
 * ReferralCompletionDashboard - Specialist Confirmation Tracking
 *
 * Purpose: Shows referrals awaiting specialist completion confirmation,
 * flags overdue referrals (14+ days), and allows staff to record
 * specialist work completion with audit trail.
 *
 * Used by: sectionDefinitions.tsx (clinical category)
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardCheck,
  RefreshCw,
  Filter,
  AlertTriangle,
  CheckCircle,
  History,
  Clock,
} from 'lucide-react';
import {
  EACard,
  EACardContent,
  EACardHeader,
  EAButton,
  EAAlert,
  EABadge,
} from '../envision-atlus';
import { referralCompletionService } from '../../services/referralCompletionService';
import type {
  AwaitingReferral,
  CompletionStats,
} from '../../services/referralCompletionService';
import {
  RecordCompletionModal,
  CompletionHistoryModal,
} from './ReferralCompletionModals';

// =============================================================================
// TYPES
// =============================================================================

type CompletionFilter = 'all' | 'awaiting' | 'overdue' | 'confirmed';

// =============================================================================
// HELPERS
// =============================================================================

function maskPatientName(first: string | null, last: string | null): string {
  const initial = first ? `${first.charAt(0)}.` : '?';
  return `${initial} ${last || 'Unknown'}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getDaysColor(days: number): 'normal' | 'elevated' | 'high' | 'critical' {
  if (days >= 21) return 'critical';
  if (days >= 14) return 'high';
  if (days >= 7) return 'elevated';
  return 'normal';
}

function getCompletionStatusVariant(status: string): 'info' | 'elevated' | 'critical' {
  switch (status) {
    case 'confirmed': return 'info';
    case 'overdue': return 'critical';
    default: return 'elevated';
  }
}

function getCompletionStatusLabel(status: string, days: number): string {
  if (status === 'confirmed') return 'Confirmed';
  if (days >= 14) return 'Overdue';
  return 'Awaiting';
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function CompletionMetricCard({ label, value, color }: {
  label: string;
  value: string | number;
  color: 'blue' | 'red' | 'green' | 'amber';
}) {
  const colorMap = {
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    red: 'bg-red-50 border-red-200 text-red-900',
    green: 'bg-green-50 border-green-200 text-green-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
  };

  return (
    <div className={`rounded-lg border p-4 ${colorMap[color]}`}>
      <p className="text-sm font-medium opacity-75">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const ReferralCompletionDashboard: React.FC = () => {
  const [referrals, setReferrals] = useState<AwaitingReferral[]>([]);
  const [stats, setStats] = useState<CompletionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completionFilter, setCompletionFilter] = useState<CompletionFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [recordModalReferral, setRecordModalReferral] = useState<AwaitingReferral | null>(null);
  const [historyReferralId, setHistoryReferralId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [referralsRes, statsRes] = await Promise.all([
      referralCompletionService.getAwaitingConfirmation(),
      referralCompletionService.getCompletionStats(),
    ]);

    if (!referralsRes.success) {
      setError(referralsRes.error.message);
      setReferrals([]);
    } else {
      setReferrals(referralsRes.data);
    }

    if (statsRes.success) {
      setStats(statsRes.data);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Client-side filtering
  const filteredReferrals = referrals.filter(r => {
    if (completionFilter === 'awaiting') {
      if (r.specialist_completion_status === 'confirmed') return false;
      if (r.days_waiting >= 14) return false;
    }
    if (completionFilter === 'overdue') {
      if (r.specialist_completion_status === 'confirmed') return false;
      if (r.days_waiting < 14) return false;
    }
    if (completionFilter === 'confirmed' && r.specialist_completion_status !== 'confirmed') return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const orgName = (r.source_org_name || '').toLowerCase();
      const lastName = (r.patient_last_name || '').toLowerCase();
      if (!orgName.includes(q) && !lastName.includes(q)) return false;
    }
    return true;
  });

  const handleCompletionRecorded = async () => {
    setRecordModalReferral(null);
    await fetchData();
  };

  // --- Loading state ---
  if (loading) {
    return (
      <EACard>
        <EACardContent className="flex items-center justify-center p-12">
          <RefreshCw className="w-5 h-5 animate-spin text-teal-600 mr-3" />
          <span className="text-gray-600">Loading specialist confirmation data...</span>
        </EACardContent>
      </EACard>
    );
  }

  return (
    <div className="space-y-4">
      {/* Alert Banner for overdue referrals */}
      {(stats?.total_overdue ?? 0) > 0 && (
        <EAAlert variant="critical">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>
              {stats?.total_overdue} referral{(stats?.total_overdue ?? 0) !== 1 ? 's' : ''} overdue 14+ days without specialist confirmation.
            </span>
          </div>
        </EAAlert>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <CompletionMetricCard
          label="Awaiting Confirmation"
          value={stats?.total_awaiting ?? 0}
          color="blue"
        />
        <CompletionMetricCard
          label="Overdue 14+ Days"
          value={stats?.total_overdue ?? 0}
          color="red"
        />
        <CompletionMetricCard
          label="Confirmed This Month"
          value={stats?.confirmed_this_month ?? 0}
          color="green"
        />
        <CompletionMetricCard
          label="Avg Days to Confirm"
          value={stats?.avg_days_to_confirm != null
            ? `${stats.avg_days_to_confirm}d`
            : '\u2014'}
          color="amber"
        />
      </div>

      {/* Error */}
      {error && (
        <EAAlert variant="critical" dismissible onDismiss={() => setError(null)}>
          {error}
        </EAAlert>
      )}

      {/* Referral Table */}
      <EACard>
        <EACardHeader
          icon={<ClipboardCheck className="w-5 h-5" />}
          action={
            <EAButton variant="ghost" size="sm" onClick={fetchData}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </EAButton>
          }
        >
          Specialist Confirmation Tracking
        </EACardHeader>

        <EACardContent className="p-0">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b bg-gray-50">
            <Filter className="w-4 h-4 text-gray-400" />

            <select
              value={completionFilter}
              onChange={e => setCompletionFilter(e.target.value as CompletionFilter)}
              className="text-sm rounded-md border-gray-300 shadow-sm focus:ring-teal-500 focus:border-teal-500"
              aria-label="Filter by completion status"
            >
              <option value="all">All Statuses</option>
              <option value="awaiting">Awaiting</option>
              <option value="overdue">Overdue</option>
              <option value="confirmed">Confirmed</option>
            </select>

            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search org or patient..."
              className="text-sm rounded-md border-gray-300 shadow-sm focus:ring-teal-500 focus:border-teal-500 w-48"
              aria-label="Search referrals"
            />
          </div>

          {/* Table Header */}
          <div className="hidden sm:flex items-center gap-4 px-4 py-2 border-b text-xs font-medium text-gray-500 uppercase tracking-wider bg-white">
            <span className="w-36">Source Org</span>
            <span className="w-28">Patient</span>
            <span className="w-24">Referral Date</span>
            <span className="w-16 flex items-center gap-1"><Clock className="w-3 h-3" /> Days</span>
            <span className="w-24">Status</span>
            <span className="flex-1 text-right">Actions</span>
          </div>

          {/* Rows */}
          {filteredReferrals.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-300" />
              <p className="text-sm font-medium">No referrals pending specialist confirmation</p>
              <p className="text-xs mt-1">
                {referrals.length === 0
                  ? 'No active referrals require specialist confirmation.'
                  : 'No referrals match the current filters.'}
              </p>
            </div>
          ) : (
            filteredReferrals.map(referral => {
              const statusLabel = getCompletionStatusLabel(
                referral.specialist_completion_status,
                referral.days_waiting
              );

              return (
                <div
                  key={referral.referral_id}
                  className="flex flex-wrap sm:flex-nowrap items-center gap-4 px-4 py-3 border-b last:border-b-0 hover:bg-gray-50 transition-colors"
                >
                  <span
                    className="text-sm font-medium text-gray-900 w-36 truncate"
                    title={referral.source_org_name || ''}
                  >
                    {referral.source_org_name || 'Unknown'}
                  </span>

                  <span className="text-sm text-gray-600 w-28 truncate">
                    {maskPatientName(referral.patient_first_name, referral.patient_last_name)}
                  </span>

                  <span className="text-sm text-gray-500 w-24">
                    {formatDate(referral.created_at)}
                  </span>

                  <span className="w-16">
                    <EABadge
                      variant={getDaysColor(referral.days_waiting)}
                      size="sm"
                      pulse={referral.days_waiting >= 14 && referral.specialist_completion_status !== 'confirmed'}
                    >
                      {referral.days_waiting}d
                    </EABadge>
                  </span>

                  <span className="w-24">
                    <EABadge variant={getCompletionStatusVariant(statusLabel.toLowerCase())} size="sm">
                      {statusLabel}
                    </EABadge>
                  </span>

                  <span className="flex-1 flex gap-2 justify-end">
                    {referral.specialist_completion_status !== 'confirmed' && (
                      <EAButton
                        variant="primary"
                        size="sm"
                        onClick={() => setRecordModalReferral(referral)}
                      >
                        <ClipboardCheck className="w-3 h-3 mr-1" />
                        Record
                      </EAButton>
                    )}
                    <EAButton
                      variant="ghost"
                      size="sm"
                      onClick={() => setHistoryReferralId(referral.referral_id)}
                    >
                      <History className="w-3 h-3 mr-1" />
                      History
                    </EAButton>
                  </span>
                </div>
              );
            })
          )}
        </EACardContent>
      </EACard>

      {/* Record Completion Modal */}
      {recordModalReferral && (
        <RecordCompletionModal
          referral={recordModalReferral}
          onSubmit={handleCompletionRecorded}
          onClose={() => setRecordModalReferral(null)}
        />
      )}

      {/* History Modal */}
      {historyReferralId && (
        <CompletionHistoryModal
          referralId={historyReferralId}
          onClose={() => setHistoryReferralId(null)}
        />
      )}
    </div>
  );
};

export default ReferralCompletionDashboard;
