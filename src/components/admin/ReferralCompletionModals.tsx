/**
 * ReferralCompletionModals — Record Completion + Completion History modals
 *
 * Purpose: Extracted modals for specialist completion workflow.
 * Following ClaimResubmissionModals.tsx pattern.
 *
 * Used by: ReferralCompletionDashboard
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import React, { useState, useEffect } from 'react';
import { RefreshCw, X, CheckCircle } from 'lucide-react';
import { EAButton, EABadge } from '../envision-atlus';
import { referralCompletionService } from '../../services/referralCompletionService';
import type { AwaitingReferral } from '../../services/referralCompletionService';
import type { FollowUpLogEntry } from '../../services/referralFollowUpService';

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

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// =============================================================================
// RECORD COMPLETION MODAL
// =============================================================================

export function RecordCompletionModal({ referral, onSubmit, onClose }: {
  referral: AwaitingReferral;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const [specialistName, setSpecialistName] = useState('');
  const [completionDate, setCompletionDate] = useState('');
  const [report, setReport] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const isValid = specialistName.trim().length >= 2 && completionDate.length > 0;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    const result = await referralCompletionService.recordCompletion({
      referral_id: referral.referral_id,
      specialist_name: specialistName.trim(),
      completion_date: completionDate,
      report: report.trim() || undefined,
      recommendations: recommendations.trim() || undefined,
    });

    if (!result.success) {
      setError(result.error.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    onSubmit();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-label="Record specialist completion"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Record Specialist Completion</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" type="button" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Referral context */}
        <div className="text-sm text-gray-600 mb-4 space-y-1">
          <p><strong>Source:</strong> {referral.source_org_name || 'Unknown'}</p>
          <p><strong>Patient:</strong> {referral.patient_first_name?.charAt(0)}. {referral.patient_last_name}</p>
          <p><strong>Referred:</strong> {formatDate(referral.created_at)} ({referral.days_waiting} days ago)</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3 mb-4">
            {error}
          </div>
        )}

        <div className="space-y-3 mb-4">
          <div>
            <label htmlFor="specialist-name" className="block text-sm font-medium text-gray-700 mb-1">
              Specialist Name *
            </label>
            <input
              id="specialist-name"
              type="text"
              className="w-full border rounded-md p-2 text-sm focus-visible:ring-2 focus-visible:ring-[var(--ea-primary)] focus-visible:border-[var(--ea-primary)]"
              value={specialistName}
              onChange={(e) => setSpecialistName(e.target.value)}
              placeholder="Dr. Smith"
            />
          </div>

          <div>
            <label htmlFor="completion-date" className="block text-sm font-medium text-gray-700 mb-1">
              Completion Date *
            </label>
            <input
              id="completion-date"
              type="date"
              className="w-full border rounded-md p-2 text-sm focus-visible:ring-2 focus-visible:ring-[var(--ea-primary)] focus-visible:border-[var(--ea-primary)]"
              value={completionDate}
              onChange={(e) => setCompletionDate(e.target.value)}
              max={today}
            />
          </div>

          <div>
            <label htmlFor="specialist-report" className="block text-sm font-medium text-gray-700 mb-1">
              Report Summary (optional)
            </label>
            <textarea
              id="specialist-report"
              className="w-full border rounded-md p-2 text-sm focus-visible:ring-2 focus-visible:ring-[var(--ea-primary)] focus-visible:border-[var(--ea-primary)]"
              rows={3}
              value={report}
              onChange={(e) => setReport(e.target.value)}
              placeholder="Summary of specialist findings..."
            />
          </div>

          <div>
            <label htmlFor="specialist-recommendations" className="block text-sm font-medium text-gray-700 mb-1">
              Recommendations (optional)
            </label>
            <textarea
              id="specialist-recommendations"
              className="w-full border rounded-md p-2 text-sm focus-visible:ring-2 focus-visible:ring-[var(--ea-primary)] focus-visible:border-[var(--ea-primary)]"
              rows={2}
              value={recommendations}
              onChange={(e) => setRecommendations(e.target.value)}
              placeholder="Follow-up recommendations..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <EAButton variant="ghost" size="sm" onClick={onClose}>Cancel</EAButton>
          <EAButton
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={!isValid || submitting}
          >
            {submitting ? 'Recording...' : 'Record Completion'}
          </EAButton>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// COMPLETION HISTORY MODAL
// =============================================================================

export function CompletionHistoryModal({ referralId, onClose }: {
  referralId: string;
  onClose: () => void;
}) {
  const [history, setHistory] = useState<FollowUpLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHistory() {
      const result = await referralCompletionService.getCompletionHistory(referralId);
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
      aria-label="Completion history"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Completion History</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" type="button" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-5 h-5 animate-spin text-[var(--ea-primary)] mr-2" />
            <span className="text-gray-600">Loading history...</span>
          </div>
        ) : history.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">No specialist confirmation events recorded.</p>
        ) : (
          <div className="space-y-3">
            {history.map(entry => (
              <div key={entry.id} className="border rounded-md p-3 text-sm">
                <div className="flex items-center justify-between mb-1">
                  <EABadge
                    variant={entry.follow_up_reason === 'specialist_completion_recorded' ? 'info' : 'elevated'}
                    size="sm"
                  >
                    {entry.follow_up_reason === 'specialist_completion_recorded' ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Completion Recorded
                      </span>
                    ) : (
                      'No Confirmation'
                    )}
                  </EABadge>
                  <span className="text-xs text-gray-500">{formatDateTime(entry.created_at)}</span>
                </div>
                <p className="text-gray-700">
                  {entry.follow_up_type} | Day {entry.aging_days}
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
