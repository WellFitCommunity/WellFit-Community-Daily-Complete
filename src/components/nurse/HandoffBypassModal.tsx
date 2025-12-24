// ============================================================================
// Emergency Handoff Bypass Modal
// ============================================================================
// Purpose: Allow nurses to override system validation when technology fails
// Design: Collect reason, signature, log everything, show bypass count
// ============================================================================

import React, { useState } from 'react';
import { useUser } from '../../contexts/AuthContext';

interface HandoffBypassModalProps {
  onClose: () => void;
  onBypass: (bypassData: BypassFormData) => Promise<void>;
  pendingCount: number;
  pendingPatients: Array<{ patient_id: string; patient_name: string; room_number: string | null }>;
  currentBypassCount: number; // Current bypasses this week
}

export interface BypassFormData {
  override_reason: 'system_glitch' | 'network_issue' | 'patient_emergency' | 'time_critical' | 'other';
  override_explanation: string;
  nurse_signature: string;
}

export const HandoffBypassModal: React.FC<HandoffBypassModalProps> = ({
  onClose,
  onBypass,
  pendingCount,
  pendingPatients,
  currentBypassCount,
}) => {
  const user = useUser();
  const [formData, setFormData] = useState<BypassFormData>({
    override_reason: 'system_glitch',
    override_explanation: '',
    nurse_signature: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reasonLabels = {
    system_glitch: 'System Glitch / Bug',
    network_issue: 'Network / Connection Issue',
    patient_emergency: 'Patient Emergency (Coding / Urgent)',
    time_critical: 'Time-Critical Situation',
    other: 'Other (explain below)',
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.override_explanation.trim()) {
      setError('Explanation is required');
      return;
    }

    if (!formData.nurse_signature.trim()) {
      setError('Signature is required');
      return;
    }

    if (formData.override_explanation.length < 10) {
      setError('Please provide a detailed explanation (at least 10 characters)');
      return;
    }

    setIsSubmitting(true);
    try {
      await onBypass(formData);
      // Success handled by parent component
    } catch (err) {

      setError(err instanceof Error ? err.message : 'Failed to log bypass');
      setIsSubmitting(false);
    }
  };

  const willTriggerNotification = currentBypassCount + 1 >= 3;
  const bypassNumber = currentBypassCount + 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Warning Header */}
        <div className="bg-orange-100 border-2 border-orange-500 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <span className="text-3xl">⚠️</span>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-orange-900 mb-1">
                Emergency Handoff Override
              </h2>
              <p className="text-sm text-orange-800">
                You are bypassing system validation. This action will be permanently logged and audited.
              </p>
            </div>
          </div>
        </div>

        {/* Pending Patients Info */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <h3 className="font-bold text-red-900 mb-2">
            System shows {pendingCount} patient{pendingCount !== 1 ? 's' : ''} unreviewed:
          </h3>
          <ul className="text-sm text-red-800 space-y-1">
            {pendingPatients.map((patient) => (
              <li key={patient.patient_id} className="flex items-center gap-2">
                <span className="text-red-600">•</span>
                <span className="font-medium">
                  {patient.room_number ? `Room ${patient.room_number}` : 'No Room'} - {patient.patient_name}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Bypass Count Warning */}
        <div className={`border-2 rounded-lg p-4 mb-6 ${
          willTriggerNotification
            ? 'bg-red-50 border-red-500'
            : 'bg-yellow-50 border-yellow-500'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">{willTriggerNotification ? '🚨' : '⚠️'}</span>
            <h3 className={`font-bold ${
              willTriggerNotification ? 'text-red-900' : 'text-yellow-900'
            }`}>
              {willTriggerNotification
                ? `MANAGER WILL BE NOTIFIED`
                : `Bypass #${bypassNumber} of 3 this week`
              }
            </h3>
          </div>
          <p className={`text-sm ${
            willTriggerNotification ? 'text-red-800' : 'text-yellow-800'
          }`}>
            {willTriggerNotification
              ? `This is your ${bypassNumber === 3 ? '3rd' : bypassNumber + 'th'} bypass in 7 days. Your nurse manager will be automatically notified and this will be flagged for review.`
              : `After 3 bypasses in 7 days, your manager will be notified. Use bypasses only when necessary.`
            }
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Reason Dropdown */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Reason for Override <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.override_reason}
              onChange={(e) => setFormData({ ...formData, override_reason: e.target.value as any })}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-hidden"
              required
            >
              {Object.entries(reasonLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Explanation */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Detailed Explanation <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.override_explanation}
              onChange={(e) => setFormData({ ...formData, override_explanation: e.target.value })}
              placeholder="Example: I reviewed Room 311 three times and clicked Confirm, but the system keeps showing it as unreviewed. I verified the patient's status and confirmed safe handoff."
              rows={4}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-hidden resize-none"
              required
              minLength={10}
            />
            <div className="text-xs text-gray-600 mt-1">
              {formData.override_explanation.length} characters (minimum 10 required)
            </div>
          </div>

          {/* Signature */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Confirm Your Identity <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.nurse_signature}
              onChange={(e) => setFormData({ ...formData, nurse_signature: e.target.value })}
              placeholder="Type your full name"
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-hidden"
              required
            />
            <div className="text-xs text-gray-600 mt-1">
              By typing your name, you acknowledge responsibility for this override.
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Audit Notice */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-bold text-gray-900 mb-2 text-sm">What will be logged:</h4>
            <ul className="text-xs text-gray-700 space-y-1">
              <li>✓ Your name and ID: {user?.email || 'Current user'}</li>
              <li>✓ Date and time: {new Date().toLocaleString()}</li>
              <li>✓ Shift type and patients affected</li>
              <li>✓ Your reason and explanation</li>
              <li>✓ IP address and device information</li>
              <li>✓ Bypass count this week: {bypassNumber}</li>
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
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Logging Override...' : 'Override and Accept Handoff'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default HandoffBypassModal;
