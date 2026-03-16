/**
 * ClaimResubmissionModals - Correction, Void, and Chain modals
 *
 * Purpose: Modal components extracted from ClaimResubmissionDashboard
 * for 600-line compliance.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import React, { useState } from 'react';
import { EAButton, EAAlert, EABadge } from '../envision-atlus';
import type { RejectedClaim, ResubmissionChainEntry } from '../../services/claimResubmissionService';

function formatCurrency(amount: number): string {
  return `$${(amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function ClaimStatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'critical' | 'elevated' | 'info'> = {
    rejected: 'critical',
    void: 'elevated',
    generated: 'info',
  };
  return <EABadge variant={variants[status] || 'info'} size="sm">{status}</EABadge>;
}

// =============================================================================
// CORRECTION MODAL
// =============================================================================

export function CorrectionModal({ claim, onSubmit, onClose }: {
  claim: RejectedClaim;
  onSubmit: (note: string) => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isValid = note.length >= 10;

  const handleSubmit = async () => {
    setSubmitting(true);
    await onSubmit(note);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-label="Create corrected claim">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Create Corrected Claim</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" type="button" aria-label="Close">&times;</button>
        </div>

        <div className="space-y-3 mb-4">
          <div className="text-sm text-gray-600">
            <p><strong>Original Claim:</strong> {claim.control_number || claim.claim_id.slice(0, 8)}</p>
            <p><strong>Payer:</strong> {claim.payer_name || 'Unknown'}</p>
            <p><strong>Amount:</strong> {formatCurrency(claim.total_charge)}</p>
            {claim.denial && (
              <p><strong>Denial Reason:</strong> {claim.denial.denial_reason || 'Not specified'}</p>
            )}
          </div>

          <div>
            <label htmlFor="correction-note" className="block text-sm font-medium text-gray-700 mb-1">
              Correction Note (min 10 characters)
            </label>
            <textarea
              id="correction-note"
              className="w-full border rounded-md p-2 text-sm focus-visible:ring-2 focus-visible:ring-[var(--ea-primary)] focus-visible:border-[var(--ea-primary)]"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Describe what was corrected (e.g., updated diagnosis code, fixed modifier)..."
            />
            {note.length > 0 && note.length < 10 && (
              <p className="text-xs text-red-500 mt-1">{10 - note.length} more characters needed</p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <EAButton variant="ghost" size="sm" onClick={onClose}>Cancel</EAButton>
          <EAButton variant="primary" size="sm" onClick={handleSubmit} disabled={!isValid || submitting}>
            {submitting ? 'Creating...' : 'Create Corrected Claim'}
          </EAButton>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// VOID MODAL
// =============================================================================

export function VoidModal({ claim, onSubmit, onClose }: {
  claim: RejectedClaim;
  onSubmit: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isValid = reason.length >= 10;

  const handleSubmit = async () => {
    setSubmitting(true);
    await onSubmit(reason);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-label="Void claim">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Void Rejected Claim</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" type="button" aria-label="Close">&times;</button>
        </div>

        <div className="space-y-3 mb-4">
          <EAAlert variant="warning">
            This action is permanent. The claim will be marked as void and cannot be resubmitted.
          </EAAlert>
          <div className="text-sm text-gray-600">
            <p><strong>Claim:</strong> {claim.control_number || claim.claim_id.slice(0, 8)}</p>
            <p><strong>Amount:</strong> {formatCurrency(claim.total_charge)}</p>
          </div>
          <div>
            <label htmlFor="void-reason" className="block text-sm font-medium text-gray-700 mb-1">
              Void Reason (min 10 characters)
            </label>
            <textarea
              id="void-reason"
              className="w-full border rounded-md p-2 text-sm focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:border-red-500"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this claim cannot be recovered..."
            />
            {reason.length > 0 && reason.length < 10 && (
              <p className="text-xs text-red-500 mt-1">{10 - reason.length} more characters needed</p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <EAButton variant="ghost" size="sm" onClick={onClose}>Cancel</EAButton>
          <EAButton variant="danger" size="sm" onClick={handleSubmit} disabled={!isValid || submitting}>
            {submitting ? 'Voiding...' : 'Confirm Void'}
          </EAButton>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// CHAIN MODAL
// =============================================================================

export function ChainModal({ chain, onClose }: {
  chain: ResubmissionChainEntry[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-label="Resubmission chain">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Resubmission History</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" type="button" aria-label="Close">&times;</button>
        </div>

        {chain.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">No resubmission history found.</p>
        ) : (
          <div className="space-y-3">
            {chain.map((entry, idx) => (
              <div
                key={entry.claim_id}
                className={`border rounded-md p-3 ${entry.is_current ? 'border-[var(--ea-primary)] bg-blue-50' : 'border-gray-200'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">
                    #{idx + 1} — {entry.control_number || entry.claim_id.slice(0, 8)}
                  </span>
                  <ClaimStatusBadge status={entry.status} />
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  <span>Resubmission #{entry.resubmission_count}</span>
                  <span className="mx-2">&middot;</span>
                  <span>{formatDate(entry.created_at)}</span>
                  {entry.is_current && (
                    <>
                      <span className="mx-2">&middot;</span>
                      <span className="font-medium text-[var(--ea-primary)]">Current</span>
                    </>
                  )}
                </div>
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
