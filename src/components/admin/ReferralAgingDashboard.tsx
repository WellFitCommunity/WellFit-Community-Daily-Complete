/**
 * ReferralAgingDashboard - Referral Follow-Up Aging Analysis
 *
 * Purpose: Shows aging referrals by bucket (0-3d, 3-7d, 7-14d, 14+d)
 * with manual follow-up actions, history view, and filter controls.
 *
 * Used by: sectionDefinitions.tsx (clinical category)
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useDashboardTheme } from '../../hooks/useDashboardTheme';
import {
  Clock,
  RefreshCw,
  Filter,
  Send,
  History,
  AlertTriangle,
  X,
  CheckCircle,
} from 'lucide-react';
import {
  EACard,
  EACardContent,
  EACardHeader,
  EAButton,
  EAAlert,
  EABadge,
} from '../envision-atlus';
import {
  referralFollowUpService,
} from '../../services/referralFollowUpService';
import type {
  AgingReferral,
  ReferralAgingStats,
  FollowUpLogEntry,
} from '../../services/referralFollowUpService';
import { auditLogger } from '../../services/auditLogger';

// =============================================================================
// TYPES
// =============================================================================

type StatusFilter = 'all' | 'pending' | 'invited' | 'enrolled';
type AgingBucket = 'all' | '3-7' | '7-14' | '14+';

// =============================================================================
// HELPERS
// =============================================================================

function maskPhone(phone: string | null): string {
  if (!phone || phone.length < 4) return '***';
  return `***-***-${phone.slice(-4)}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getAgingColor(days: number): 'normal' | 'elevated' | 'high' | 'critical' {
  if (days >= 14) return 'critical';
  if (days >= 7) return 'high';
  if (days >= 3) return 'elevated';
  return 'normal';
}

function getStatusVariant(status: string): 'info' | 'neutral' | 'elevated' {
  switch (status) {
    case 'pending': return 'neutral';
    case 'invited': return 'info';
    case 'enrolled': return 'elevated';
    default: return 'neutral';
  }
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function AgingMetricCard({ label, value, color }: {
  label: string;
  value: number;
  color: 'green' | 'yellow' | 'orange' | 'red';
}) {
  const colorMap = {
    green: 'bg-green-50 border-green-200 text-green-900',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    orange: 'bg-orange-50 border-orange-200 text-orange-900',
    red: 'bg-red-50 border-red-200 text-red-900',
  };

  return (
    <div className={`rounded-lg border p-4 ${colorMap[color]}`}>
      <p className="text-sm font-medium opacity-75">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function HistoryModal({ referralId, onClose }: {
  referralId: string;
  onClose: () => void;
}) {
  const [history, setHistory] = useState<FollowUpLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHistory() {
      const result = await referralFollowUpService.getFollowUpHistory(referralId);
      if (result.success) {
        setHistory(result.data);
      }
      setLoading(false);
    }
    loadHistory();
  }, [referralId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-label="Follow-up history"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Follow-Up History</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" type="button" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-5 h-5 animate-spin text-[var(--ea-primary,#00857a)] mr-2" />
            <span className="text-gray-600">Loading history...</span>
          </div>
        ) : history.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">No follow-up attempts recorded.</p>
        ) : (
          <div className="space-y-3">
            {history.map(entry => (
              <div key={entry.id} className="border rounded-md p-3 text-sm">
                <div className="flex items-center justify-between mb-1">
                  <EABadge
                    variant={entry.delivery_status === 'sent' || entry.delivery_status === 'delivered' ? 'info' : 'critical'}
                    size="sm"
                  >
                    {entry.follow_up_type} — {entry.delivery_status}
                  </EABadge>
                  <span className="text-xs text-gray-500">{formatDate(entry.created_at)}</span>
                </div>
                <p className="text-gray-700">
                  Reason: {entry.follow_up_reason.replace(/_/g, ' ')} | Day {entry.aging_days}
                </p>
                {entry.error_message && (
                  <p className="text-red-600 text-xs mt-1">{entry.error_message}</p>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <EAButton variant="ghost" size="sm" onClick={onClose}>Close</EAButton>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const ReferralAgingDashboard: React.FC = () => {
  useDashboardTheme();
  const [referrals, setReferrals] = useState<AgingReferral[]>([]);
  const [stats, setStats] = useState<ReferralAgingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [agingFilter, setAgingFilter] = useState<AgingBucket>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [historyReferralId, setHistoryReferralId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [referralsRes, statsRes] = await Promise.all([
      referralFollowUpService.getAgingReferrals(),
      referralFollowUpService.getAgingStats(),
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
    if (statusFilter !== 'all' && r.referral_status !== statusFilter) return false;
    if (agingFilter === '3-7' && (r.aging_days < 3 || r.aging_days >= 7)) return false;
    if (agingFilter === '7-14' && (r.aging_days < 7 || r.aging_days >= 14)) return false;
    if (agingFilter === '14+' && r.aging_days < 14) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const orgName = (r.source_org_name || '').toLowerCase();
      const phone = (r.patient_phone || '').toLowerCase();
      if (!orgName.includes(q) && !phone.includes(q)) return false;
    }
    return true;
  });

  const handleSendReminder = async (referral: AgingReferral) => {
    setSendingId(referral.referral_id);
    try {
      const result = await referralFollowUpService.triggerManualFollowUp(
        referral.referral_id,
        'sms',
        referral.tenant_id
      );

      if (!result.success) {
        setError(result.error.message);
      } else {
        // Refresh data
        await fetchData();
      }
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('REFERRAL_MANUAL_SEND_UI_FAILED', e);
      setError('Failed to send reminder. Please try again.');
    }
    setSendingId(null);
  };

  // --- Loading state ---
  if (loading) {
    return (
      <EACard>
        <EACardContent className="flex items-center justify-center p-12">
          <RefreshCw className="w-5 h-5 animate-spin text-[var(--ea-primary,#00857a)] mr-3" />
          <span className="text-gray-600">Loading referral aging data...</span>
        </EACardContent>
      </EACard>
    );
  }

  return (
    <div className="space-y-4" aria-label="Referral Aging Dashboard">
      {/* Alert Banner for 14+ day referrals */}
      {(stats?.bucket_14_plus ?? 0) > 0 && (
        <EAAlert variant="critical">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>
              {stats?.bucket_14_plus} referral{(stats?.bucket_14_plus ?? 0) !== 1 ? 's' : ''} aging 14+ days — escalation required.
            </span>
          </div>
        </EAAlert>
      )}

      {/* Aging Bucket Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <AgingMetricCard label="0-3 Days" value={stats?.bucket_0_3 ?? 0} color="green" />
        <AgingMetricCard label="3-7 Days" value={stats?.bucket_3_7 ?? 0} color="yellow" />
        <AgingMetricCard label="7-14 Days" value={stats?.bucket_7_14 ?? 0} color="orange" />
        <AgingMetricCard label="14+ Days" value={stats?.bucket_14_plus ?? 0} color="red" />
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
          icon={<Clock className="w-5 h-5" />}
          action={
            <EAButton variant="ghost" size="sm" onClick={fetchData}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </EAButton>
          }
        >
          Aging Referrals
        </EACardHeader>

        <EACardContent className="p-0">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b bg-gray-50">
            <Filter className="w-4 h-4 text-gray-400" />

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as StatusFilter)}
              className="text-sm rounded-md border-gray-300 shadow-sm focus-visible:ring-[var(--ea-primary,#00857a)] focus-visible:border-[var(--ea-primary,#00857a)]"
              aria-label="Filter by status"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="invited">Invited</option>
              <option value="enrolled">Enrolled</option>
            </select>

            <select
              value={agingFilter}
              onChange={e => setAgingFilter(e.target.value as AgingBucket)}
              className="text-sm rounded-md border-gray-300 shadow-sm focus-visible:ring-[var(--ea-primary,#00857a)] focus-visible:border-[var(--ea-primary,#00857a)]"
              aria-label="Filter by aging bucket"
            >
              <option value="all">All Aging</option>
              <option value="3-7">3-7</option>
              <option value="7-14">7-14</option>
              <option value="14+">14+</option>
            </select>

            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search org or phone..."
              className="text-sm rounded-md border-gray-300 shadow-sm focus-visible:ring-[var(--ea-primary,#00857a)] focus-visible:border-[var(--ea-primary,#00857a)] w-48"
              aria-label="Search referrals"
            />
          </div>

          {/* Table Header */}
          <div className="hidden sm:flex items-center gap-4 px-4 py-2 border-b text-xs font-medium text-gray-500 uppercase tracking-wider bg-white">
            <span className="w-36">Source Org</span>
            <span className="w-28">Patient Phone</span>
            <span className="w-20">Status</span>
            <span className="w-16 flex items-center gap-1"><Clock className="w-3 h-3" /> Days</span>
            <span className="w-28">Last Follow-Up</span>
            <span className="w-12">Count</span>
            <span className="flex-1 text-right">Actions</span>
          </div>

          {/* Rows */}
          {filteredReferrals.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-300" />
              <p className="text-sm font-medium">All referrals are current</p>
              <p className="text-xs mt-1">
                {referrals.length === 0
                  ? 'No aging referrals require follow-up.'
                  : 'No referrals match the current filters.'}
              </p>
            </div>
          ) : (
            filteredReferrals.map(referral => (
              <div
                key={referral.referral_id}
                className="flex flex-wrap sm:flex-nowrap items-center gap-4 px-4 py-3 border-b last:border-b-0 hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-medium text-gray-900 w-36 truncate" title={referral.source_org_name || ''}>
                  {referral.source_org_name || 'Unknown'}
                </span>

                <span className="text-sm text-gray-600 w-28">
                  {maskPhone(referral.patient_phone)}
                </span>

                <span className="w-20">
                  <EABadge variant={getStatusVariant(referral.referral_status)} size="sm">
                    {referral.referral_status}
                  </EABadge>
                </span>

                <span className="w-16">
                  <EABadge
                    variant={getAgingColor(referral.aging_days)}
                    size="sm"
                    pulse={referral.aging_days >= 14}
                  >
                    {referral.aging_days}d
                  </EABadge>
                </span>

                <span className="w-28 text-xs text-gray-500">
                  {formatDate(referral.last_follow_up_at)}
                </span>

                <span className="w-12 text-sm text-gray-600 text-center">
                  {referral.follow_up_count}
                </span>

                <span className="flex-1 flex gap-2 justify-end">
                  <EAButton
                    variant="primary"
                    size="sm"
                    onClick={() => handleSendReminder(referral)}
                    loading={sendingId === referral.referral_id}
                    disabled={sendingId !== null}
                  >
                    <Send className="w-3 h-3 mr-1" />
                    Send
                  </EAButton>
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
            ))
          )}
        </EACardContent>
      </EACard>

      {/* History Modal */}
      {historyReferralId && (
        <HistoryModal
          referralId={historyReferralId}
          onClose={() => setHistoryReferralId(null)}
        />
      )}
    </div>
  );
};

export default ReferralAgingDashboard;
