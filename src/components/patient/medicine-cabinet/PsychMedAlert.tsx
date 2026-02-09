/**
 * PsychMedAlert — Psychiatric medication interaction alert banner
 *
 * Displays warnings when a patient has multiple psychiatric medications.
 * Supports severity levels (critical/warning) and acknowledgment workflow.
 */

import React from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import { PsychMedAlertProps } from './MedicineCabinet.types';

export const PsychMedAlert: React.FC<PsychMedAlertProps> = ({
  psychMedAlert,
  psychAlerts,
  onAcknowledge
}) => {
  if (!psychMedAlert.hasMultiplePsychMeds || psychAlerts.length === 0) {
    return null;
  }

  const firstAlert = psychAlerts[0];
  const isCritical = firstAlert.severity === 'critical';

  return (
    <div className={`mb-6 rounded-xl border-2 p-6 ${
      isCritical ? 'bg-red-50 border-red-300' : 'bg-yellow-50 border-yellow-300'
    }`}>
      <div className="flex items-start gap-4">
        <div className={`shrink-0 ${isCritical ? 'text-red-600' : 'text-yellow-600'}`}>
          <AlertTriangle className="w-10 h-10" />
        </div>
        <div className="flex-1">
          <h3 className={`text-xl font-bold mb-2 ${
            isCritical ? 'text-red-900' : 'text-yellow-900'
          }`}>
            Multiple Psychiatric Medications Detected
          </h3>
          <p className={`mb-3 ${isCritical ? 'text-red-800' : 'text-yellow-800'}`}>
            Patient is taking {psychMedAlert.psychMedCount} psychiatric medications simultaneously.
            {psychMedAlert.requiresReview && ' Requires clinical review.'}
          </p>

          {/* Medication List */}
          <div className="bg-white bg-opacity-60 rounded-lg p-4 mb-3">
            <p className="font-semibold text-gray-900 mb-2">Psychiatric Medications:</p>
            <ul className="space-y-1">
              {psychMedAlert.medications.map((med, idx) => (
                <li key={idx} className="text-sm text-gray-800">
                  • <span className="font-medium">{med.name}</span>
                  <span className="text-gray-600"> - {med.category}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Warnings */}
          {psychMedAlert.warnings.length > 0 && (
            <div className="bg-white bg-opacity-60 rounded-lg p-4 mb-3">
              <p className="font-semibold text-gray-900 mb-2">Warnings:</p>
              <ul className="space-y-1">
                {psychMedAlert.warnings.map((warning, idx) => (
                  <li key={idx} className="text-sm text-gray-800 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            {!firstAlert.acknowledged && (
              <button
                onClick={async () => {
                  const alertId = firstAlert.id;
                  if (!alertId) return;
                  const success = await onAcknowledge(alertId);
                  if (success) {
                    toast.success('Alert acknowledged');
                  }
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                Acknowledge Alert
              </button>
            )}
            {firstAlert.acknowledged && (
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="w-5 h-5" />
                <span className="text-sm font-medium">Acknowledged</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
