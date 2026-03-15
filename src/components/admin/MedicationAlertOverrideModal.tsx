/**
 * MedicationAlertOverrideModal
 *
 * Modal for providers to formally override medication safety alerts
 * (contraindications, drug interactions, allergies). Collects structured
 * reason code, mandatory explanation (20-char min), provider signature,
 * and displays weekly override count with escalation warnings.
 *
 * Pattern: HandoffBypassModal.tsx (src/components/nurse/)
 */

import React, { useState, useEffect } from 'react';
import { useUser } from '../../contexts/AuthContext';
import { medicationOverrideService } from '../../services/medicationOverrideService';
import type {
  AlertType,
  AlertSeverity,
  OverrideReason,
  RecordOverrideRequest,
} from '../../services/medicationOverrideService';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface MedicationAlertOverrideModalProps {
  onClose: () => void;
  onOverrideComplete: () => void;
  alertType: AlertType;
  alertSeverity: AlertSeverity;
  alertDescription: string;
  alertRecommendations: string[];
  medicationName: string;
  medicationRxcui?: string;
  patientId: string;
  checkId?: string;
  tenantId?: string;
}

const REASON_LABELS: Record<OverrideReason, string> = {
  clinical_judgment: 'Clinical Judgment — benefits outweigh risks',
  patient_specific_exception: 'Patient-Specific Exception — documented history',
  documented_tolerance: 'Documented Tolerance — prior safe use',
  informed_consent: 'Informed Consent — patient accepts risk',
  palliative_care: 'Palliative / Comfort Care — goals of care',
  monitoring_plan: 'Monitoring Plan — will monitor closely',
  other: 'Other (explain below)',
};

const SEVERITY_STYLES: Record<AlertSeverity, { bg: string; border: string; text: string; label: string }> = {
  contraindicated: { bg: 'bg-red-100', border: 'border-red-500', text: 'text-red-900', label: 'CONTRAINDICATED' },
  high: { bg: 'bg-orange-100', border: 'border-orange-500', text: 'text-orange-900', label: 'HIGH SEVERITY' },
  moderate: { bg: 'bg-yellow-100', border: 'border-yellow-500', text: 'text-yellow-900', label: 'MODERATE' },
  low: { bg: 'bg-blue-100', border: 'border-blue-500', text: 'text-blue-900', label: 'LOW' },
};

const MIN_EXPLANATION_LENGTH = 20;

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const MedicationAlertOverrideModal: React.FC<MedicationAlertOverrideModalProps> = ({
  onClose,
  onOverrideComplete,
  alertType,
  alertSeverity,
  alertDescription,
  alertRecommendations,
  medicationName,
  medicationRxcui,
  patientId,
  checkId,
  tenantId,
}) => {
  const user = useUser();

  const [overrideReason, setOverrideReason] = useState<OverrideReason>('clinical_judgment');
  const [explanation, setExplanation] = useState('');
  const [providerSignature, setProviderSignature] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weeklyCount, setWeeklyCount] = useState(0);

  const severity = SEVERITY_STYLES[alertSeverity];

  // Load weekly override count for this provider
  useEffect(() => {
    if (user?.id) {
      medicationOverrideService.getProviderWeeklyCount(user.id).then((result) => {
        if (result.success) {
          setWeeklyCount(result.data);
        }
      });
    }
  }, [user?.id]);

  const willTriggerEscalation = weeklyCount + 1 >= 3;
  const overrideNumber = weeklyCount + 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (explanation.trim().length < MIN_EXPLANATION_LENGTH) {
      setError(`Explanation must be at least ${MIN_EXPLANATION_LENGTH} characters (currently ${explanation.trim().length})`);
      return;
    }

    if (!providerSignature.trim()) {
      setError('Provider signature is required');
      return;
    }

    if (!user?.id) {
      setError('User session not available');
      return;
    }

    setIsSubmitting(true);

    const request: RecordOverrideRequest = {
      alert_type: alertType,
      alert_severity: alertSeverity,
      alert_description: alertDescription,
      alert_recommendations: alertRecommendations,
      check_id: checkId,
      medication_name: medicationName,
      medication_rxcui: medicationRxcui,
      provider_id: user.id,
      provider_signature: providerSignature.trim(),
      patient_id: patientId,
      override_reason: overrideReason,
      override_explanation: explanation.trim(),
      tenant_id: tenantId,
    };

    const result = await medicationOverrideService.recordOverride(request);

    if (result.success) {
      onOverrideComplete();
    } else {
      setError(result.error.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Severity-colored warning header */}
        <div className={`${severity.bg} border-2 ${severity.border} rounded-lg p-4 mb-6`}>
          <div className="flex items-start gap-3">
            <span className="text-3xl">
              {alertSeverity === 'contraindicated' ? '🛑' : alertSeverity === 'high' ? '⚠️' : '⚡'}
            </span>
            <div className="flex-1">
              <h2 className={`text-xl font-bold ${severity.text} mb-1`}>
                {severity.label}: {medicationName}
              </h2>
              <p className={`text-sm ${severity.text}`}>
                {alertDescription}
              </p>
            </div>
          </div>
        </div>

        {/* Alert recommendations */}
        {alertRecommendations.length > 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
            <h3 className="font-bold text-gray-900 mb-2 text-sm">Clinical Recommendations:</h3>
            <ul className="text-sm text-gray-700 space-y-1">
              {alertRecommendations.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5">-</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Weekly count warning */}
        <div className={`border-2 rounded-lg p-4 mb-6 ${
          willTriggerEscalation
            ? 'bg-red-50 border-red-500'
            : 'bg-yellow-50 border-yellow-500'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">{willTriggerEscalation ? '🚨' : '📊'}</span>
            <h3 className={`font-bold ${willTriggerEscalation ? 'text-red-900' : 'text-yellow-900'}`}>
              {willTriggerEscalation
                ? 'MANAGER WILL BE NOTIFIED'
                : `Override #${overrideNumber} of 3 this week`
              }
            </h3>
          </div>
          <p className={`text-sm ${willTriggerEscalation ? 'text-red-800' : 'text-yellow-800'}`}>
            {willTriggerEscalation
              ? `This is override #${overrideNumber} in 7 days. Your manager will be automatically notified and this will be flagged for review.`
              : 'After 3 overrides in 7 days, your manager is automatically notified.'
            }
          </p>
        </div>

        {/* Override Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Reason dropdown */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Override Reason <span className="text-red-500">*</span>
            </label>
            <select
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value as OverrideReason)}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[var(--ea-primary)] focus:outline-hidden"
              required
            >
              {Object.entries(REASON_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Explanation textarea */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Clinical Justification <span className="text-red-500">*</span>
            </label>
            <textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Provide detailed clinical justification for overriding this alert (minimum 20 characters)"
              rows={4}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[var(--ea-primary)] focus:outline-hidden resize-none"
              required
              minLength={MIN_EXPLANATION_LENGTH}
            />
            <div className={`text-xs mt-1 ${
              explanation.trim().length >= MIN_EXPLANATION_LENGTH ? 'text-green-600' : 'text-gray-500'
            }`}>
              {explanation.trim().length} / {MIN_EXPLANATION_LENGTH} minimum characters
            </div>
          </div>

          {/* Provider signature */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Provider Signature <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={providerSignature}
              onChange={(e) => setProviderSignature(e.target.value)}
              placeholder="Type your full name to sign"
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[var(--ea-primary)] focus:outline-hidden"
              required
            />
            <div className="text-xs text-gray-600 mt-1">
              By typing your name, you accept clinical responsibility for overriding this alert.
            </div>
          </div>

          {/* Error display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Audit notice */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-bold text-gray-900 mb-2 text-sm">Permanently Logged:</h4>
            <ul className="text-xs text-gray-700 space-y-1">
              <li>Your identity: {user?.email || 'Current user'}</li>
              <li>Date/time: {new Date().toLocaleString()}</li>
              <li>Alert type: {alertType} ({alertSeverity})</li>
              <li>Medication: {medicationName}</li>
              <li>Override count this week: #{overrideNumber}</li>
            </ul>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel — Follow Recommendations
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex-1 px-6 py-3 text-white rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed ${
                alertSeverity === 'contraindicated'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-orange-600 hover:bg-orange-700'
              }`}
            >
              {isSubmitting ? 'Recording Override...' : 'Override and Proceed'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MedicationAlertOverrideModal;
