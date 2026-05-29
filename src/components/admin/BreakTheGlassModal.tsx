/**
 * BreakTheGlassModal — ONC 170.315(d)(6) emergency-access capture.
 *
 * Lets an authenticated clinical/staff user record time-limited emergency
 * access to a patient record. A reason is mandatory; the grant is audited
 * server-side (grant_emergency_access) with the accessor, patient, reason,
 * IP, and an automatic expiry. The accessor can end the grant early (revoke).
 *
 * This component captures the justification and surfaces the recorded grant.
 * All authorization, name/IP lookup, tenant isolation, and expiry live in the
 * SECURITY DEFINER RPCs — see migration 20260528140000.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { emergencyAccessService, type EmergencyAccessGrant } from '../../services/emergencyAccessService';
import {
  EMERGENCY_ACCESS_REASONS,
  EMERGENCY_ACCESS_DURATIONS,
  DEFAULT_EMERGENCY_ACCESS_MINUTES,
} from '../../constants/emergencyAccess';

export interface BreakTheGlassModalProps {
  /** Patient whose record is being accessed (auth.users.id). */
  patientId: string;
  /** Optional display label for the patient (no PHI beyond what the caller already shows). */
  patientLabel?: string;
  isOpen: boolean;
  onClose: () => void;
  /** Called after a grant is successfully recorded. */
  onGranted?: (grant: EmergencyAccessGrant) => void;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export const BreakTheGlassModal: React.FC<BreakTheGlassModalProps> = ({
  patientId,
  patientLabel,
  isOpen,
  onClose,
  onGranted,
}) => {
  const [reason, setReason] = useState('');
  const [explanation, setExplanation] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(DEFAULT_EMERGENCY_ACCESS_MINUTES);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [grant, setGrant] = useState<EmergencyAccessGrant | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [revoked, setRevoked] = useState(false);

  // Reset transient state whenever the modal (re)opens for a patient.
  useEffect(() => {
    if (isOpen) {
      setReason('');
      setExplanation('');
      setDurationMinutes(DEFAULT_EMERGENCY_ACCESS_MINUTES);
      setError(null);
      setGrant(null);
      setRevoked(false);
    }
  }, [isOpen, patientId]);

  const handleGrant = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      const reasonLabel =
        EMERGENCY_ACCESS_REASONS.find((r) => r.value === reason)?.label ?? '';
      if (!reasonLabel) {
        setError('Select a reason for emergency access.');
        return;
      }
      if (reason === 'other' && !explanation.trim()) {
        setError('Describe the reason in the explanation field.');
        return;
      }

      setSubmitting(true);
      const result = await emergencyAccessService.grantAccess({
        patientId,
        reason: reasonLabel,
        explanation: explanation.trim() || undefined,
        durationMinutes,
      });
      setSubmitting(false);

      if (!result.success) {
        setError(result.error.message);
        return;
      }
      setGrant(result.data);
      onGranted?.(result.data);
    },
    [patientId, reason, explanation, durationMinutes, onGranted]
  );

  const handleRevoke = useCallback(async () => {
    if (!grant) return;
    setRevoking(true);
    const result = await emergencyAccessService.revokeAccess(grant.accessId);
    setRevoking(false);
    if (!result.success) {
      setError(result.error.message);
      return;
    }
    setRevoked(true);
  }, [grant]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="btg-title"
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl" aria-hidden="true">🚨</span>
            <h2 id="btg-title" className="text-xl font-semibold text-red-800">
              Break the glass — emergency access
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="min-h-[44px] min-w-[44px] text-gray-500 hover:text-gray-800 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <p className="mt-2 text-sm text-gray-600">
          You are about to record emergency access to
          {patientLabel ? ` ${patientLabel}'s` : ' this patient’s'} record.
          This access is time-limited, fully audited, and a supervisor is notified.
        </p>

        {/* Granted confirmation */}
        {grant ? (
          <div className="mt-4 space-y-4">
            <div
              role="status"
              className="p-4 rounded-lg border border-green-300 bg-green-50 text-green-900"
            >
              <p className="font-medium">Emergency access recorded.</p>
              <dl className="mt-2 text-sm space-y-1">
                <div>
                  <dt className="inline text-green-700">Expires: </dt>
                  <dd className="inline">{formatTime(grant.expiresAt)}</dd>
                </div>
                <div>
                  <dt className="inline text-green-700">Duration: </dt>
                  <dd className="inline">{grant.durationMinutes} minutes</dd>
                </div>
                {grant.shouldNotifySupervisor && (
                  <p className="mt-1 text-green-800">A supervisor will be notified of this access.</p>
                )}
              </dl>
            </div>

            {revoked ? (
              <p role="status" className="text-sm text-gray-700">
                This emergency access has been ended.
              </p>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleRevoke}
                  disabled={revoking}
                  className="min-h-[44px] px-5 text-base font-medium bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 focus:ring-2 focus:ring-gray-400 disabled:opacity-50"
                >
                  {revoking ? 'Ending…' : 'End access now'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] px-5 text-base font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500"
                >
                  Continue to record
                </button>
              </div>
            )}
            {error && (
              <p role="alert" className="text-red-700 text-sm">{error}</p>
            )}
          </div>
        ) : (
          /* Grant form */
          <form onSubmit={handleGrant} className="mt-4 space-y-4" aria-label="Break the glass">
            <div>
              <label htmlFor="btg-reason" className="block text-base font-medium text-gray-700 mb-1">
                Reason for emergency access
              </label>
              <select
                id="btg-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full p-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              >
                <option value="">Please select</option>
                {EMERGENCY_ACCESS_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="btg-explanation" className="block text-base font-medium text-gray-700 mb-1">
                Explanation {reason === 'other' ? '(required)' : '(optional)'}
              </label>
              <textarea
                id="btg-explanation"
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                rows={3}
                placeholder="Briefly describe the emergency justifying this access."
                className="w-full p-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div>
              <label htmlFor="btg-duration" className="block text-base font-medium text-gray-700 mb-1">
                Access duration
              </label>
              <select
                id="btg-duration"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full p-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              >
                {EMERGENCY_ACCESS_DURATIONS.map((d) => (
                  <option key={d.minutes} value={d.minutes}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <div role="alert" className="p-3 rounded-lg border bg-yellow-50 border-yellow-300 text-yellow-900 text-sm">
                {error}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="min-h-[44px] px-6 text-base font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Recording…' : 'Break the glass'}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="min-h-[44px] px-6 text-base font-medium bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 focus:ring-2 focus:ring-gray-400 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default BreakTheGlassModal;
