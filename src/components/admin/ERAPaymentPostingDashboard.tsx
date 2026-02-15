/**
 * ERAPaymentPostingDashboard - ERA/835 Payment Reconciliation
 *
 * Purpose: Shows unposted remittances, enables payment posting to claims,
 * and displays reconciliation stats to close the revenue cycle.
 *
 * Used by: sectionDefinitions.tsx (revenue category)
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  FileText,
  CreditCard,
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
  eraPaymentPostingService,
} from '../../services/eraPaymentPostingService';
import type {
  UnpostedRemittance,
  PaymentStats,
  PaymentMatch,
} from '../../services/eraPaymentPostingService';

// =============================================================================
// HELPERS
// =============================================================================

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatCurrency(amount: number): string {
  return `$${(amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function PaymentStatCard({ label, value, color, isCurrency }: {
  label: string;
  value: number;
  color: 'green' | 'blue' | 'amber' | 'gray';
  isCurrency?: boolean;
}) {
  const colorMap = {
    green: 'bg-green-50 border-green-200 text-green-900',
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    gray: 'bg-gray-50 border-gray-200 text-gray-900',
  };

  return (
    <div className={`rounded-lg border p-4 ${colorMap[color]}`}>
      <p className="text-sm font-medium opacity-75">{label}</p>
      <p className="text-2xl font-bold mt-1">{isCurrency ? formatCurrency(value) : value}</p>
    </div>
  );
}

function MatchableClaimsModal({ claims, onPost, onClose }: {
  claims: PaymentMatch[];
  onPost: (claimId: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-label="Match payment to claim"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Select Claim for Payment Posting
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" type="button" aria-label="Close">
            &times;
          </button>
        </div>

        {claims.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">No claims available for matching.</p>
        ) : (
          <div className="space-y-2">
            {claims.map(claim => (
              <div key={claim.claim_id} className="flex items-center justify-between border rounded-md p-3 hover:bg-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {claim.control_number || claim.claim_id.slice(0, 8)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {claim.payer_name || 'Unknown Payer'} &middot; {formatCurrency(claim.total_charge)}
                  </p>
                </div>
                <EAButton variant="primary" size="sm" onClick={() => onPost(claim.claim_id)}>
                  <CreditCard className="w-3 h-3 mr-1" />
                  Post
                </EAButton>
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

const ERAPaymentPostingDashboard: React.FC = () => {
  const [remittances, setRemittances] = useState<UnpostedRemittance[]>([]);
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matchableClaims, setMatchableClaims] = useState<PaymentMatch[]>([]);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [selectedRemittanceId, setSelectedRemittanceId] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [remRes, statsRes] = await Promise.all([
      eraPaymentPostingService.getUnpostedRemittances(),
      eraPaymentPostingService.getPaymentStats(),
    ]);

    if (!remRes.success) {
      setError(remRes.error.message);
      setRemittances([]);
    } else {
      setRemittances(remRes.data);
    }

    if (statsRes.success) {
      setStats(statsRes.data);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleMatchClick = async (remittanceId: string) => {
    setSelectedRemittanceId(remittanceId);
    const claimsRes = await eraPaymentPostingService.getMatchableClaims();
    if (claimsRes.success) {
      setMatchableClaims(claimsRes.data);
    }
    setShowMatchModal(true);
  };

  const handlePost = async (claimId: string) => {
    setPosting(true);
    const result = await eraPaymentPostingService.postPayment({
      claim_id: claimId,
      remittance_id: selectedRemittanceId,
      paid_amount: 0, // Would be populated from ERA parse data
      adjustment_amount: 0,
      patient_responsibility: 0,
      match_method: 'manual',
      match_confidence: 1.0,
      tenant_id: '', // resolved from RLS context
    });

    if (!result.success) {
      setError(result.error.message);
    } else {
      setShowMatchModal(false);
      await fetchData();
    }
    setPosting(false);
  };

  const unpostedCount = remittances.length;

  // --- Loading state ---
  if (loading) {
    return (
      <EACard>
        <EACardContent className="flex items-center justify-center p-12">
          <RefreshCw className="w-5 h-5 animate-spin text-blue-600 mr-3" />
          <span className="text-gray-600">Loading payment data...</span>
        </EACardContent>
      </EACard>
    );
  }

  return (
    <div className="space-y-4">
      {/* Alert Banner */}
      {unpostedCount > 0 && (
        <EAAlert variant="warning">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>
              {unpostedCount} remittance{unpostedCount !== 1 ? 's' : ''} with unposted payments need reconciliation.
            </span>
          </div>
        </EAAlert>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <PaymentStatCard label="Total Posted" value={stats.total_posted} color="green" />
          <PaymentStatCard label="Paid Amount" value={stats.total_paid_amount} color="blue" isCurrency />
          <PaymentStatCard label="Adjustments" value={stats.total_adjustments} color="amber" isCurrency />
          <PaymentStatCard label="Patient Responsibility" value={stats.total_patient_responsibility} color="gray" isCurrency />
        </div>
      )}

      {/* Error */}
      {error && (
        <EAAlert variant="critical" dismissible onDismiss={() => setError(null)}>
          {error}
        </EAAlert>
      )}

      {/* Unposted Remittances Table */}
      <EACard>
        <EACardHeader
          icon={<FileText className="w-5 h-5" />}
          action={
            <EAButton variant="ghost" size="sm" onClick={fetchData}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </EAButton>
          }
        >
          Unposted Remittances
        </EACardHeader>

        <EACardContent className="p-0">
          {/* Table Header */}
          <div className="hidden sm:flex items-center gap-4 px-4 py-2 border-b text-xs font-medium text-gray-500 uppercase tracking-wider bg-white">
            <span className="w-32">Payer</span>
            <span className="w-28">Received</span>
            <span className="w-24 text-right">Total Paid</span>
            <span className="w-20 text-center">Claims</span>
            <span className="w-20 text-center">Posted</span>
            <span className="w-20 text-center">Unposted</span>
            <span className="flex-1 text-right">Actions</span>
          </div>

          {/* Rows */}
          {remittances.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-300" />
              <p className="text-sm font-medium">All remittances posted</p>
              <p className="text-xs mt-1">No unreconciled ERA payments remain.</p>
            </div>
          ) : (
            remittances.map(rem => (
              <div
                key={rem.remittance_id}
                className="flex flex-wrap sm:flex-nowrap items-center gap-4 px-4 py-3 border-b last:border-b-0 hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm text-gray-900 w-32 truncate font-medium" title={rem.payer_name}>
                  {rem.payer_name}
                </span>

                <span className="text-sm text-gray-600 w-28">
                  {formatDate(rem.received_at)}
                </span>

                <span className="text-sm font-medium text-gray-900 w-24 text-right">
                  {formatCurrency(rem.total_paid)}
                </span>

                <span className="w-20 text-center text-sm text-gray-700">
                  {rem.claim_count}
                </span>

                <span className="w-20 text-center">
                  <EABadge variant="info" size="sm">{rem.posted_count}</EABadge>
                </span>

                <span className="w-20 text-center">
                  <EABadge
                    variant={rem.unposted_count > 0 ? 'elevated' : 'info'}
                    size="sm"
                    pulse={rem.unposted_count > 0}
                  >
                    {rem.unposted_count}
                  </EABadge>
                </span>

                <span className="flex-1 flex gap-2 justify-end">
                  <EAButton
                    variant="primary"
                    size="sm"
                    onClick={() => handleMatchClick(rem.remittance_id)}
                  >
                    <ArrowRight className="w-3 h-3 mr-1" />
                    Match &amp; Post
                  </EAButton>
                </span>
              </div>
            ))
          )}
        </EACardContent>
      </EACard>

      {/* Posted Today Summary */}
      {stats && stats.posted_today > 0 && (
        <div className="flex items-center gap-2 text-sm text-gray-600 px-1">
          <DollarSign className="w-4 h-4" />
          <span>
            <strong>{stats.posted_today}</strong> payment{stats.posted_today !== 1 ? 's' : ''} posted today
          </span>
        </div>
      )}

      {/* Match Modal */}
      {showMatchModal && (
        <MatchableClaimsModal
          claims={matchableClaims}
          onPost={handlePost}
          onClose={() => setShowMatchModal(false)}
        />
      )}

      {/* Posting overlay */}
      {posting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-lg p-6 shadow-xl flex items-center gap-3">
            <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
            <span className="text-gray-700">Posting payment...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ERAPaymentPostingDashboard;
