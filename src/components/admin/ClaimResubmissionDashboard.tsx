/**
 * ClaimResubmissionDashboard - Rejected claim correction and resubmission workflow
 *
 * Purpose: Displays rejected/voided claims with denial details, enables creating
 * corrected child claims, voiding unrecoverable claims, and viewing the full
 * resubmission chain.
 *
 * Used by: revenueSections.tsx (revenue category)
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  FileText,
  XCircle,
  Edit3,
  Link,
  Search,
  Activity,
} from 'lucide-react';
import {
  EACard,
  EACardContent,
  EACardHeader,
  EAButton,
  EAAlert,
  EABadge,
} from '../envision-atlus';
import { claimResubmissionService } from '../../services/claimResubmissionService';
import type {
  RejectedClaim,
  ResubmissionStats,
  ResubmissionChainEntry,
  ResubmissionStatusFilter,
} from '../../services/claimResubmissionService';
import { CorrectionModal, VoidModal, ChainModal } from './ClaimResubmissionModals';
import {
  clearinghouseMCP,
  type ClaimStatus,
  type RejectionGuidance,
} from '../../services/mcp/mcpClearinghouseClient';
import { auditLogger } from '../../services/auditLogger';
import { useDashboardTheme } from '../../hooks/useDashboardTheme';

function formatCurrency(amount: number): string {
  return `$${(amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function StatCard({ label, value, color, isCurrency }: {
  label: string;
  value: number;
  color: 'red' | 'amber' | 'green' | 'blue';
  isCurrency?: boolean;
}) {
  const colorMap = {
    red: 'bg-red-50 border-red-200 text-red-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    green: 'bg-green-50 border-green-200 text-green-900',
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
  };
  return (
    <div className={`rounded-lg border p-4 ${colorMap[color]}`}>
      <p className="text-sm font-medium opacity-75">{label}</p>
      <p className="text-2xl font-bold mt-1">{isCurrency ? formatCurrency(value) : value}</p>
    </div>
  );
}

function ClaimStatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'critical' | 'elevated' | 'info'> = {
    rejected: 'critical', void: 'elevated', generated: 'info',
  };
  return <EABadge variant={variants[status] || 'info'} size="sm">{status}</EABadge>;
}

const ClaimResubmissionDashboard: React.FC = () => {
  useDashboardTheme();
  const [claims, setClaims] = useState<RejectedClaim[]>([]);
  const [stats, setStats] = useState<ResubmissionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ResubmissionStatusFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [correctionTarget, setCorrectionTarget] = useState<RejectedClaim | null>(null);
  const [voidTarget, setVoidTarget] = useState<RejectedClaim | null>(null);
  const [chainData, setChainData] = useState<ResubmissionChainEntry[] | null>(null);
  const [claimStatuses, setClaimStatuses] = useState<Record<string, ClaimStatus | 'not_configured' | 'checking'>>({});
  const [rejectionGuidance, setRejectionGuidance] = useState<Record<string, RejectionGuidance>>({});

  const fetchData = useCallback(async (filter?: ResubmissionStatusFilter, search?: string) => {
    setLoading(true);
    setError(null);
    const [claimsRes, statsRes] = await Promise.all([
      claimResubmissionService.getRejectedClaims(filter, search),
      claimResubmissionService.getResubmissionStats(),
    ]);
    if (!claimsRes.success) {
      setError(claimsRes.error.message);
      setClaims([]);
    } else {
      setClaims(claimsRes.data);
    }
    if (statsRes.success) setStats(statsRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleFilterChange = (filter: ResubmissionStatusFilter) => {
    setStatusFilter(filter);
    fetchData(filter, searchTerm);
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    fetchData(statusFilter, term);
  };

  const handleCorrection = async (note: string) => {
    if (!correctionTarget) return;
    const result = await claimResubmissionService.createCorrectedClaim({
      original_claim_id: correctionTarget.claim_id,
      correction_note: note,
    });
    if (!result.success) setError(result.error.message);
    setCorrectionTarget(null);
    fetchData(statusFilter, searchTerm);
  };

  const handleVoid = async (reason: string) => {
    if (!voidTarget) return;
    const result = await claimResubmissionService.voidRejectedClaim(voidTarget.claim_id, reason);
    if (!result.success) setError(result.error.message);
    setVoidTarget(null);
    fetchData(statusFilter, searchTerm);
  };

  const handleViewChain = async (claimId: string) => {
    const result = await claimResubmissionService.getResubmissionChain(claimId);
    if (result.success) setChainData(result.data);
  };

  const handleCheckStatus = useCallback(async (claim: RejectedClaim) => {
    setClaimStatuses(prev => ({ ...prev, [claim.claim_id]: 'checking' }));

    try {
      const res = await clearinghouseMCP.checkClaimStatus({
        payer_id: claim.payer_name || 'unknown',
        provider_npi: '',
        date_of_service_from: claim.created_at.slice(0, 10),
        claim_id: claim.claim_id,
        trace_number: claim.control_number || undefined,
      });

      if (res.success && res.data?.status_response) {
        const status = res.data.status_response.status;
        setClaimStatuses(prev => ({ ...prev, [claim.claim_id]: status }));

        // Load rejection guidance if denial code available
        const denialCode = claim.denial?.denial_code;
        if (denialCode && !rejectionGuidance[claim.claim_id]) {
          try {
            const guidanceRes = await clearinghouseMCP.getRejectionReasons({ rejection_code: denialCode });
            if (guidanceRes.success && guidanceRes.data) {
              const guidance = guidanceRes.data;
              setRejectionGuidance(prev => ({ ...prev, [claim.claim_id]: guidance }));
            }
          } catch (guidanceErr: unknown) {
            await auditLogger.error(
              'REJECTION_GUIDANCE_FAILED',
              guidanceErr instanceof Error ? guidanceErr : new Error(String(guidanceErr)),
              { claimId: claim.claim_id, denialCode }
            );
          }
        }
      } else {
        setClaimStatuses(prev => ({ ...prev, [claim.claim_id]: 'not_configured' }));
      }
    } catch (err: unknown) {
      setClaimStatuses(prev => ({ ...prev, [claim.claim_id]: 'not_configured' }));
      await auditLogger.error(
        'CLAIM_STATUS_CHECK_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { claimId: claim.claim_id }
      );
    }
  }, [rejectionGuidance]);

  if (loading) {
    return (
      <EACard>
        <EACardContent className="flex items-center justify-center p-12">
          <RefreshCw className="w-5 h-5 animate-spin text-[var(--ea-primary,#00857a)] mr-3" />
          <span className="text-gray-600">Loading resubmission data...</span>
        </EACardContent>
      </EACard>
    );
  }

  return (
    <div className="space-y-4">
      {/* Alert Banner — past appeal deadline */}
      {stats && stats.past_appeal_deadline > 0 && (
        <EAAlert variant="critical">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>
              {stats.past_appeal_deadline} rejected claim{stats.past_appeal_deadline !== 1 ? 's have' : ' has'} passed the appeal deadline.
              Immediate action required.
            </span>
          </div>
        </EAAlert>
      )}

      {/* Stat Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Total Rejected" value={stats.total_rejected} color="red" />
          <StatCard label="Amount at Risk" value={stats.total_amount_at_risk} color="red" isCurrency />
          <StatCard label="Avg Days Since Rejection" value={stats.avg_days_since_rejection} color="amber" />
          <StatCard label="Resubmitted" value={stats.resubmitted_count} color="green" />
        </div>
      )}

      {/* Error */}
      {error && (
        <EAAlert variant="critical" dismissible onDismiss={() => setError(null)}>
          {error}
        </EAAlert>
      )}

      {/* Claims Table */}
      <EACard>
        <EACardHeader
          icon={<FileText className="w-5 h-5" />}
          action={
            <EAButton variant="ghost" size="sm" onClick={() => fetchData(statusFilter, searchTerm)}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </EAButton>
          }
        >
          Rejected Claims
        </EACardHeader>

        <EACardContent className="p-0">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b bg-gray-50">
            <select
              className="border rounded-md px-3 py-1.5 text-sm bg-white"
              value={statusFilter}
              onChange={(e) => handleFilterChange(e.target.value as ResubmissionStatusFilter)}
              aria-label="Filter by status"
            >
              <option value="all">All Statuses</option>
              <option value="rejected">Rejected</option>
              <option value="void">Voided</option>
            </select>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-2.5 top-2 text-gray-400" />
              <input
                type="text"
                className="w-full border rounded-md pl-8 pr-3 py-1.5 text-sm"
                placeholder="Search payer or control #..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                aria-label="Search claims"
              />
            </div>
          </div>

          {/* Table Header */}
          <div className="hidden sm:flex items-center gap-4 px-4 py-2 border-b text-xs font-medium text-gray-500 uppercase tracking-wider bg-white">
            <span className="w-28">Control #</span>
            <span className="w-32">Payer</span>
            <span className="w-20 text-right">Amount</span>
            <span className="w-16 text-center">Status</span>
            <span className="w-16 text-center">Days</span>
            <span className="w-32">Denial Reason</span>
            <span className="flex-1 text-right">Actions</span>
          </div>

          {/* Rows */}
          {claims.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-300" />
              <p className="text-sm font-medium">No rejected claims</p>
              <p className="text-xs mt-1">All claims are in good standing.</p>
            </div>
          ) : (
            claims.map(claim => {
              const claimStatus = claimStatuses[claim.claim_id];
              const guidance = rejectionGuidance[claim.claim_id];

              return (
                <div key={claim.claim_id} className="border-b last:border-b-0">
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors">
                    <span className="text-sm text-gray-900 w-28 truncate font-medium" title={claim.control_number || claim.claim_id}>
                      {claim.control_number || claim.claim_id.slice(0, 8)}
                    </span>
                    <span className="text-sm text-gray-600 w-32 truncate" title={claim.payer_name || 'Unknown'}>
                      {claim.payer_name || 'Unknown'}
                    </span>
                    <span className="text-sm font-medium text-gray-900 w-20 text-right">
                      {formatCurrency(claim.total_charge)}
                    </span>
                    <span className="w-16 text-center"><ClaimStatusBadge status={claim.status} /></span>
                    <span className="w-16 text-center text-sm text-gray-700">{claim.aging_days}d</span>
                    <span className="text-xs text-gray-500 w-32 truncate" title={claim.denial?.denial_reason || ''}>
                      {claim.denial?.denial_reason || '--'}
                    </span>
                    <span className="flex-1 flex gap-2 justify-end flex-wrap items-center">
                      {/* Clearinghouse Status Badge */}
                      {claimStatus === 'checking' && (
                        <RefreshCw className="w-3 h-3 animate-spin text-[var(--ea-primary,#00857a)]" />
                      )}
                      {claimStatus && claimStatus !== 'checking' && claimStatus !== 'not_configured' && (
                        <EABadge variant={claimStatus === 'paid' ? 'normal' : claimStatus === 'denied' ? 'critical' : 'info'} size="sm">
                          {claimStatus}
                        </EABadge>
                      )}
                      {claimStatus === 'not_configured' && (
                        <span className="text-xs text-orange-600" title="Clearinghouse not configured — add vendor credentials in Supabase secrets">
                          ⚠ Not configured
                        </span>
                      )}

                      <EAButton
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCheckStatus(claim)}
                        disabled={claimStatus === 'checking'}
                        title="Check status with clearinghouse"
                      >
                        <Activity className="w-3 h-3 mr-1" />Status
                      </EAButton>

                      {claim.status === 'rejected' && (
                        <>
                          <EAButton variant="primary" size="sm" onClick={() => setCorrectionTarget(claim)}>
                            <Edit3 className="w-3 h-3 mr-1" />Correct
                          </EAButton>
                          <EAButton variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => setVoidTarget(claim)}>
                            <XCircle className="w-3 h-3 mr-1" />Void
                          </EAButton>
                        </>
                      )}
                      <EAButton variant="ghost" size="sm" onClick={() => handleViewChain(claim.claim_id)}>
                        <Link className="w-3 h-3 mr-1" />History
                      </EAButton>
                    </span>
                  </div>

                  {/* Rejection Guidance (expanded inline) */}
                  {guidance && guidance.reasons.length > 0 && (
                    <div className="px-4 pb-3 bg-amber-50 border-t border-amber-100">
                      <p className="text-xs font-medium text-amber-800 mt-2 mb-1">Remediation Guidance</p>
                      {guidance.reasons.slice(0, 2).map((r, i) => (
                        <div key={i} className="text-xs text-amber-700 mb-1">
                          <span className="font-mono font-medium">{r.code}</span>: {r.remediation}
                        </div>
                      ))}
                      {guidance.appeal_guidance && (
                        <p className="text-xs text-amber-600 mt-1">
                          Appeal timeframe: {guidance.appeal_guidance.timeframe}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </EACardContent>
      </EACard>

      {correctionTarget && (
        <CorrectionModal claim={correctionTarget} onSubmit={handleCorrection} onClose={() => setCorrectionTarget(null)} />
      )}
      {voidTarget && (
        <VoidModal claim={voidTarget} onSubmit={handleVoid} onClose={() => setVoidTarget(null)} />
      )}
      {chainData && (
        <ChainModal chain={chainData} onClose={() => setChainData(null)} />
      )}
    </div>
  );
};

export default ClaimResubmissionDashboard;
