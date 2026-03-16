/**
 * PatientAmendmentReviewQueue - Clinical Staff Review of Patient Amendment Requests
 *
 * Purpose: Display pending patient amendment requests for clinical staff to review
 * Used by: Admin clinical section (sectionDefinitions.tsx)
 * Auth: admin/clinician roles only
 * Regulation: 45 CFR 164.526 (Right to Amend)
 *
 * Features:
 *  - List pending requests sorted by deadline (soonest first)
 *  - Accept/deny actions with denial reason input
 *  - Deadline countdown with urgency highlighting
 *  - Stats: total pending, urgent (under 7 days)
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  patientAmendmentService,
  type PatientAmendmentRequest,
  type AmendmentRecordType,
} from '../../services/patientAmendmentService';
import { auditLogger } from '../../services/auditLogger';

// =============================================================================
// TYPES
// =============================================================================

interface ReviewAction {
  requestId: string;
  type: 'accept' | 'deny';
}

// =============================================================================
// CONSTANTS
// =============================================================================

const RECORD_TYPE_LABELS: Record<AmendmentRecordType, string> = {
  demographics: 'Demographics',
  conditions: 'Conditions',
  medications: 'Medications',
  allergies: 'Allergies',
  vitals: 'Vitals',
  lab_results: 'Lab Results',
  care_plans: 'Care Plans',
  clinical_notes: 'Clinical Notes',
  other: 'Other',
};

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  submitted: { bg: 'bg-blue-100', text: 'text-blue-800' },
  under_review: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  accepted: { bg: 'bg-green-100', text: 'text-green-800' },
  denied: { bg: 'bg-red-100', text: 'text-red-800' },
  withdrawn: { bg: 'bg-gray-100', text: 'text-gray-800' },
};

// =============================================================================
// HELPERS
// =============================================================================

function getDaysUntilDeadline(deadline: string): number {
  const diff = new Date(deadline).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getDeadlineClass(daysLeft: number): string {
  if (daysLeft <= 0) return 'text-red-700 bg-red-50 border-red-300';
  if (daysLeft <= 7) return 'text-red-600 bg-red-50 border-red-200';
  if (daysLeft <= 14) return 'text-amber-600 bg-amber-50 border-amber-200';
  return 'text-gray-600 bg-gray-50 border-gray-200';
}

function getDeadlineLabel(daysLeft: number): string {
  if (daysLeft <= 0) return 'OVERDUE';
  if (daysLeft === 1) return '1 day remaining';
  return `${daysLeft} days remaining`;
}

// =============================================================================
// COMPONENT
// =============================================================================

const PatientAmendmentReviewQueue: React.FC = () => {
  const [requests, setRequests] = useState<PatientAmendmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [reviewAction, setReviewAction] = useState<ReviewAction | null>(null);
  const [denialReason, setDenialReason] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await patientAmendmentService.getPendingAmendments();
      if (!result.success) {
        setError(result.error.message);
        return;
      }

      setRequests(result.data);
      await auditLogger.info('AMENDMENT_REVIEW_QUEUE_LOADED', {
        pendingCount: result.data.length,
      });
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('AMENDMENT_REVIEW_QUEUE_LOAD_FAILED', e);
      setError('Failed to load amendment requests. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleAccept = useCallback(async (requestId: string) => {
    try {
      setProcessingId(requestId);
      setError(null);

      const result = await patientAmendmentService.reviewAmendmentRequest({
        request_id: requestId,
        decision: 'accepted',
      });

      if (!result.success) {
        setError(result.error.message);
        return;
      }

      setRequests(prev => prev.filter(r => r.id !== requestId));
      setSuccessMessage('Amendment request accepted successfully.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('AMENDMENT_ACCEPT_UI_FAILED', e);
      setError('Failed to accept amendment request.');
    } finally {
      setProcessingId(null);
    }
  }, []);

  const handleDeny = useCallback(async () => {
    if (!reviewAction || reviewAction.type !== 'deny') return;
    if (!denialReason.trim()) {
      setError('A denial reason is required per 45 CFR 164.526(d).');
      return;
    }

    try {
      setProcessingId(reviewAction.requestId);
      setError(null);

      const result = await patientAmendmentService.reviewAmendmentRequest({
        request_id: reviewAction.requestId,
        decision: 'denied',
        denial_reason: denialReason.trim(),
      });

      if (!result.success) {
        setError(result.error.message);
        return;
      }

      setRequests(prev => prev.filter(r => r.id !== reviewAction.requestId));
      setReviewAction(null);
      setDenialReason('');
      setSuccessMessage('Amendment request denied. Patient will be notified.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('AMENDMENT_DENY_UI_FAILED', e);
      setError('Failed to deny amendment request.');
    } finally {
      setProcessingId(null);
    }
  }, [reviewAction, denialReason]);

  const urgentCount = requests.filter(
    r => getDaysUntilDeadline(r.response_deadline) <= 7
  ).length;

  // -- Loading State --
  if (loading) {
    return (
      <div
        className="flex items-center justify-center p-12"
        role="status"
        aria-label="Loading amendment requests"
      >
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--ea-primary)]" />
        <span className="ml-3 text-gray-600 text-lg">Loading amendment requests...</span>
      </div>
    );
  }

  // -- Error State (no data) --
  if (error && requests.length === 0 && !successMessage) {
    return (
      <div className="p-6" role="alert">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-medium">Unable to load amendment requests</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          <button
            onClick={loadRequests}
            className="mt-3 min-h-[44px] min-w-[44px] px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 text-base font-medium"
            aria-label="Retry loading amendment requests"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" aria-label="Patient Amendment Review Queue">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Patient Amendment Review Queue</h2>
          <p className="text-gray-500 mt-1">45 CFR 164.526 - Right to Amend</p>
        </div>
        <button
          onClick={loadRequests}
          disabled={loading}
          className="min-h-[44px] min-w-[44px] px-4 py-2 bg-[var(--ea-primary)] text-[var(--ea-text-on-primary)] rounded-lg hover:bg-[var(--ea-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ea-primary)] text-base font-medium disabled:opacity-50"
          aria-label="Refresh amendment requests"
        >
          Refresh
        </button>
      </div>

      {/* Success banner */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3" role="status">
          <p className="text-green-700 font-medium text-sm">{successMessage}</p>
        </div>
      )}

      {/* Inline error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3" role="alert">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Pending Requests</p>
          <p className="text-3xl font-bold text-[var(--ea-primary)]">{requests.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Urgent (7 days or less)</p>
          <p className={`text-3xl font-bold ${urgentCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {urgentCount}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Response Window</p>
          <p className="text-lg font-bold text-gray-700">60 days per HIPAA</p>
        </div>
      </div>

      {/* Denial Modal */}
      {reviewAction?.type === 'deny' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-label="Deny amendment request"
        >
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Deny Amendment Request</h3>
            <p className="text-gray-600 text-sm mb-4">
              Per 45 CFR 164.526(d), you must provide a written basis for the denial.
              The patient has the right to file a statement of disagreement.
            </p>
            <label htmlFor="denial-reason" className="block text-sm font-medium text-gray-700 mb-1">
              Denial Reason (required)
            </label>
            <textarea
              id="denial-reason"
              value={denialReason}
              onChange={e => setDenialReason(e.target.value)}
              rows={4}
              className="w-full border border-gray-300 rounded-lg p-3 text-base focus-visible:ring-2 focus-visible:ring-[var(--ea-primary)] focus-visible:border-[var(--ea-primary)]"
              placeholder="Provide the clinical basis for denying this amendment..."
            />
            <div className="flex gap-3 justify-end mt-4">
              <button
                onClick={() => { setReviewAction(null); setDenialReason(''); }}
                className="min-h-[44px] min-w-[44px] px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 text-base font-medium"
                aria-label="Cancel denial"
              >
                Cancel
              </button>
              <button
                onClick={handleDeny}
                disabled={!denialReason.trim() || processingId !== null}
                className="min-h-[44px] min-w-[44px] px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 text-base font-medium disabled:opacity-50"
                aria-label="Confirm denial"
              >
                {processingId ? 'Processing...' : 'Confirm Denial'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {requests.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-500 text-lg">No pending amendment requests.</p>
          <p className="text-gray-400 text-sm mt-1">
            All patient amendment requests have been reviewed.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map(request => {
            const daysLeft = getDaysUntilDeadline(request.response_deadline);
            const deadlineClass = getDeadlineClass(daysLeft);
            const statusStyle = STATUS_STYLES[request.status] ?? STATUS_STYLES.submitted;

            return (
              <div
                key={request.id}
                className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {request.record_description}
                      </h3>
                      <span
                        className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${statusStyle.bg} ${statusStyle.text}`}
                      >
                        {request.status.replace(/_/g, ' ')}
                      </span>
                      <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                        {RECORD_TYPE_LABELS[request.record_type]}
                      </span>
                    </div>

                    <div className="mt-2 space-y-1 text-sm">
                      {request.current_value && (
                        <p className="text-gray-500">
                          <span className="font-medium text-gray-700">Current value:</span>{' '}
                          {request.current_value}
                        </p>
                      )}
                      <p className="text-gray-500">
                        <span className="font-medium text-gray-700">Requested change:</span>{' '}
                        {request.requested_value}
                      </p>
                      <p className="text-gray-500">
                        <span className="font-medium text-gray-700">Reason:</span>{' '}
                        {request.reason}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-500">
                      <span>Submitted: {formatDate(request.created_at)}</span>
                      <span>Request #: {request.request_number || 'Pending'}</span>
                    </div>
                  </div>

                  {/* Deadline badge */}
                  <div className={`px-3 py-2 rounded-lg border text-sm font-semibold ${deadlineClass}`}>
                    {getDeadlineLabel(daysLeft)}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-3 mt-4 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => handleAccept(request.id)}
                    disabled={processingId === request.id}
                    className="min-h-[44px] min-w-[44px] px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 text-base font-medium disabled:opacity-50"
                    aria-label={`Accept amendment request: ${request.record_description}`}
                  >
                    {processingId === request.id ? 'Processing...' : 'Accept'}
                  </button>
                  <button
                    onClick={() => setReviewAction({ requestId: request.id, type: 'deny' })}
                    disabled={processingId === request.id}
                    className="min-h-[44px] min-w-[44px] px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 text-base font-medium disabled:opacity-50"
                    aria-label={`Deny amendment request: ${request.record_description}`}
                  >
                    Deny
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PatientAmendmentReviewQueue;
