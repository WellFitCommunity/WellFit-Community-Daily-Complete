/**
 * MyAmendmentRequests - Patient Amendment Request Management Page
 *
 * Purpose: Allow patients to view and submit amendment requests for their health records
 * Route: /my-amendment-requests
 * Regulation: 45 CFR 164.526 (Right to Amend)
 *
 * Features:
 *  - Form to submit new amendment request (record type, description, reason)
 *  - List of existing requests with status badges
 *  - Ability to file disagreement statement on denied requests
 *  - Loading/error/success states
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  patientAmendmentService,
  type PatientAmendmentRequest,
  type AmendmentRecordType,
} from '../services/patientAmendmentService';
import { auditLogger } from '../services/auditLogger';

// =============================================================================
// TYPES
// =============================================================================

interface FormState {
  recordType: AmendmentRecordType;
  description: string;
  currentValue: string;
  requestedValue: string;
  reason: string;
}

const INITIAL_FORM: FormState = {
  recordType: 'demographics',
  description: '',
  currentValue: '',
  requestedValue: '',
  reason: '',
};

// =============================================================================
// CONSTANTS
// =============================================================================

const RECORD_TYPE_OPTIONS: { value: AmendmentRecordType; label: string }[] = [
  { value: 'demographics', label: 'Demographics' },
  { value: 'conditions', label: 'Conditions / Diagnoses' },
  { value: 'medications', label: 'Medications' },
  { value: 'allergies', label: 'Allergies' },
  { value: 'vitals', label: 'Vital Signs' },
  { value: 'lab_results', label: 'Lab Results' },
  { value: 'care_plans', label: 'Care Plans' },
  { value: 'clinical_notes', label: 'Clinical Notes' },
  { value: 'other', label: 'Other' },
];

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  submitted: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Submitted' },
  under_review: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Under Review' },
  accepted: { bg: 'bg-green-100', text: 'text-green-800', label: 'Accepted' },
  denied: { bg: 'bg-red-100', text: 'text-red-800', label: 'Denied' },
  withdrawn: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Withdrawn' },
};

// =============================================================================
// HELPERS
// =============================================================================

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getRecordTypeLabel(type: AmendmentRecordType): string {
  return RECORD_TYPE_OPTIONS.find(o => o.value === type)?.label ?? type;
}

// =============================================================================
// COMPONENT
// =============================================================================

const MyAmendmentRequests: React.FC = () => {
  const [requests, setRequests] = useState<PatientAmendmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);

  // Disagreement state
  const [disagreementTargetId, setDisagreementTargetId] = useState<string | null>(null);
  const [disagreementText, setDisagreementText] = useState('');
  const [filingDisagreement, setFilingDisagreement] = useState(false);

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await patientAmendmentService.getMyAmendmentRequests();
      if (!result.success) {
        setError(result.error.message);
        return;
      }

      setRequests(result.data);
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('MY_AMENDMENTS_LOAD_FAILED', e);
      setError('Failed to load your amendment requests. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleFormChange = useCallback(
    (field: keyof FormState, value: string) => {
      setForm(prev => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!form.description.trim() || !form.requestedValue.trim() || !form.reason.trim()) {
        setError('Please fill in all required fields.');
        return;
      }

      try {
        setSubmitting(true);
        setError(null);

        const result = await patientAmendmentService.submitAmendmentRequest({
          record_type: form.recordType,
          record_description: form.description.trim(),
          current_value: form.currentValue.trim() || undefined,
          requested_value: form.requestedValue.trim(),
          reason: form.reason.trim(),
        });

        if (!result.success) {
          setError(result.error.message);
          return;
        }

        setRequests(prev => [result.data, ...prev]);
        setForm(INITIAL_FORM);
        setShowForm(false);
        setSuccessMessage(
          'Your amendment request has been submitted. You will be notified within 60 days.'
        );
        setTimeout(() => setSuccessMessage(null), 6000);
      } catch (err: unknown) {
        const e = err instanceof Error ? err : new Error(String(err));
        await auditLogger.error('AMENDMENT_SUBMIT_UI_FAILED', e);
        setError('Failed to submit your amendment request. Please try again.');
      } finally {
        setSubmitting(false);
      }
    },
    [form]
  );

  const handleFileDisagreement = useCallback(
    async (requestId: string) => {
      if (!disagreementText.trim()) {
        setError('Please write your disagreement statement before submitting.');
        return;
      }

      try {
        setFilingDisagreement(true);
        setError(null);

        const result = await patientAmendmentService.fileDisagreementStatement(
          requestId,
          disagreementText.trim()
        );

        if (!result.success) {
          setError(result.error.message);
          return;
        }

        setRequests(prev =>
          prev.map(r => (r.id === requestId ? result.data : r))
        );
        setDisagreementTargetId(null);
        setDisagreementText('');
        setSuccessMessage(
          'Your disagreement statement has been filed and will be included with your records.'
        );
        setTimeout(() => setSuccessMessage(null), 6000);
      } catch (err: unknown) {
        const e = err instanceof Error ? err : new Error(String(err));
        await auditLogger.error('DISAGREEMENT_SUBMIT_UI_FAILED', e);
        setError('Failed to file your disagreement statement. Please try again.');
      } finally {
        setFilingDisagreement(false);
      }
    },
    [disagreementText]
  );

  const isFormValid =
    form.description.trim() && form.requestedValue.trim() && form.reason.trim();

  // -- Loading State --
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div
          className="flex items-center justify-center p-12"
          role="status"
          aria-label="Loading amendment requests"
        >
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          <span className="ml-3 text-gray-600 text-lg">Loading your amendment requests...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Amendment Requests</h1>
          <p className="text-gray-500 mt-1">
            Request changes to your health records (45 CFR 164.526)
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="min-h-[44px] min-w-[44px] px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base font-medium"
            aria-label="Submit a new amendment request"
          >
            New Request
          </button>
        )}
      </div>

      {/* Success Banner */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4" role="status">
          <p className="text-green-800 font-medium">{successMessage}</p>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3" role="alert">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* New Request Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-4">Submit Amendment Request</h2>
          <p className="text-gray-500 text-sm mb-4">
            Under HIPAA, you have the right to request amendments to your health records.
            Your organization must respond within 60 days.
          </p>

          <div className="space-y-4">
            {/* Record Type */}
            <div>
              <label htmlFor="record-type" className="block text-sm font-medium text-gray-700 mb-1">
                Record Type
              </label>
              <select
                id="record-type"
                value={form.recordType}
                onChange={e => handleFormChange('recordType', e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-3 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[44px]"
                aria-label="Select the type of health record to amend"
              >
                {RECORD_TYPE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description of Record <span className="text-red-500">*</span>
              </label>
              <input
                id="description"
                type="text"
                value={form.description}
                onChange={e => handleFormChange('description', e.target.value)}
                placeholder="Which specific record or entry needs to be amended?"
                required
                className="w-full border border-gray-300 rounded-lg p-3 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[44px]"
              />
            </div>

            {/* Current Value (optional) */}
            <div>
              <label htmlFor="current-value" className="block text-sm font-medium text-gray-700 mb-1">
                Current Value (optional)
              </label>
              <textarea
                id="current-value"
                value={form.currentValue}
                onChange={e => handleFormChange('currentValue', e.target.value)}
                placeholder="What does the record currently say?"
                rows={2}
                className="w-full border border-gray-300 rounded-lg p-3 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Requested Change */}
            <div>
              <label htmlFor="requested-value" className="block text-sm font-medium text-gray-700 mb-1">
                Requested Change <span className="text-red-500">*</span>
              </label>
              <textarea
                id="requested-value"
                value={form.requestedValue}
                onChange={e => handleFormChange('requestedValue', e.target.value)}
                placeholder="What should the record say instead?"
                rows={3}
                required
                className="w-full border border-gray-300 rounded-lg p-3 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Reason */}
            <div>
              <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
                Reason for Amendment <span className="text-red-500">*</span>
              </label>
              <textarea
                id="reason"
                value={form.reason}
                onChange={e => handleFormChange('reason', e.target.value)}
                placeholder="Why do you believe this record is incorrect or incomplete?"
                rows={3}
                required
                className="w-full border border-gray-300 rounded-lg p-3 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="submit"
              disabled={submitting || !isFormValid}
              className="min-h-[44px] min-w-[44px] px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base font-medium disabled:opacity-50"
              aria-label="Submit amendment request"
            >
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setForm(INITIAL_FORM);
              }}
              className="min-h-[44px] min-w-[44px] px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 text-base font-medium"
              aria-label="Cancel new request"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Existing Requests */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Your Requests</h2>

        {requests.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
            <p className="text-gray-500 text-lg">You have not submitted any amendment requests.</p>
            <p className="text-gray-400 text-sm mt-1">
              Click &quot;New Request&quot; above to request changes to your health records.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map(request => {
              const statusStyle = STATUS_STYLES[request.status] ?? STATUS_STYLES.submitted;
              const canFileDisagreement =
                request.status === 'denied' && !request.disagreement_statement;

              return (
                <div
                  key={request.id}
                  className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {request.record_description}
                        </h3>
                        <span
                          className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${statusStyle.bg} ${statusStyle.text}`}
                          aria-label={`Status: ${statusStyle.label}`}
                        >
                          {statusStyle.label}
                        </span>
                        <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                          {getRecordTypeLabel(request.record_type)}
                        </span>
                      </div>

                      <div className="mt-2 space-y-1 text-sm">
                        <p className="text-gray-600">
                          <span className="font-medium">Requested change:</span>{' '}
                          {request.requested_value}
                        </p>
                        <p className="text-gray-600">
                          <span className="font-medium">Reason:</span> {request.reason}
                        </p>
                        <p className="text-gray-500">
                          Submitted: {formatDate(request.created_at)}
                        </p>
                      </div>

                      {/* Denial Information */}
                      {request.status === 'denied' && (
                        <div className="mt-3 bg-red-50 border border-red-100 rounded-lg p-3">
                          <p className="text-red-800 font-medium text-sm">Request Denied</p>
                          {request.denial_reason && (
                            <p className="text-red-700 text-sm mt-1">
                              Reason: {request.denial_reason}
                            </p>
                          )}
                          {request.reviewed_at && (
                            <p className="text-red-600 text-xs mt-1">
                              Reviewed on: {formatDate(request.reviewed_at)}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Acceptance Info */}
                      {request.status === 'accepted' && request.reviewed_at && (
                        <div className="mt-3 bg-green-50 border border-green-100 rounded-lg p-3">
                          <p className="text-green-800 font-medium text-sm">Request Accepted</p>
                          <p className="text-green-600 text-xs mt-1">
                            Approved on: {formatDate(request.reviewed_at)}
                          </p>
                        </div>
                      )}

                      {/* Existing Disagreement */}
                      {request.disagreement_statement && (
                        <div className="mt-3 bg-orange-50 border border-orange-100 rounded-lg p-3">
                          <p className="text-orange-800 font-medium text-sm">
                            Disagreement Statement Filed
                          </p>
                          <p className="text-orange-700 text-sm mt-1 italic">
                            &quot;{request.disagreement_statement}&quot;
                          </p>
                          {request.disagreement_filed_at && (
                            <p className="text-orange-600 text-xs mt-1">
                              Filed on: {formatDate(request.disagreement_filed_at)}
                            </p>
                          )}
                        </div>
                      )}

                      {/* File Disagreement Action */}
                      {canFileDisagreement && (
                        <div className="mt-3">
                          {disagreementTargetId === request.id ? (
                            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                              <p className="text-gray-700 text-sm mb-2">
                                Per 45 CFR 164.526(d)(1), you may file a statement of disagreement
                                that will be included with your records for future disclosures.
                              </p>
                              <label
                                htmlFor={`disagreement-${request.id}`}
                                className="block text-sm font-medium text-gray-700 mb-1"
                              >
                                Your Disagreement Statement
                              </label>
                              <textarea
                                id={`disagreement-${request.id}`}
                                value={disagreementText}
                                onChange={e => setDisagreementText(e.target.value)}
                                rows={4}
                                className="w-full border border-gray-300 rounded-lg p-3 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Explain why you disagree with the denial decision..."
                              />
                              <div className="flex gap-3 mt-3">
                                <button
                                  onClick={() => handleFileDisagreement(request.id)}
                                  disabled={filingDisagreement || !disagreementText.trim()}
                                  className="min-h-[44px] min-w-[44px] px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 text-base font-medium disabled:opacity-50"
                                  aria-label="Submit disagreement statement"
                                >
                                  {filingDisagreement ? 'Filing...' : 'File Disagreement'}
                                </button>
                                <button
                                  onClick={() => {
                                    setDisagreementTargetId(null);
                                    setDisagreementText('');
                                  }}
                                  className="min-h-[44px] min-w-[44px] px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 text-base font-medium"
                                  aria-label="Cancel disagreement"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDisagreementTargetId(request.id)}
                              className="min-h-[44px] min-w-[44px] px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 text-base font-medium"
                              aria-label={`File disagreement for: ${request.record_description}`}
                            >
                              File Disagreement Statement
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyAmendmentRequests;
