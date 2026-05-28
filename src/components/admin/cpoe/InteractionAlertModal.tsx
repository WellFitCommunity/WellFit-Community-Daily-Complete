/**
 * InteractionAlertModal — ONC 170.315(a)(9) CDS blocking-alert UI.
 *
 * Surfaces drug-drug interactions returned by checkDrugInteractions() during
 * medication order entry. Per ONC the prescriber may override after
 * acknowledging the alert — the rule is "alert + reason capture", not
 * "absolutely block." Each acknowledgment is audit-logged by the caller.
 *
 * Rendering policy:
 *   • severity='contraindicated' — red, requires explicit override reason
 *   • severity='high'            — orange, override-able with one click
 *   • severity='moderate'/'low'  — yellow/blue, informational only
 */

import React, { useCallback, useState } from 'react';
import type { DrugInteraction } from '../../../services/drugInteractionService';

export interface InteractionAlertModalProps {
  /** Interactions returned by drugInteractionService — display order preserved */
  interactions: DrugInteraction[];

  /** Called when the prescriber acknowledges and chooses to proceed.
   *  Reason is required when any contraindicated-severity alert is present. */
  onAcknowledge: (overrideReason: string) => void;

  /** Called when the prescriber cancels the order */
  onCancel: () => void;
}

const SEVERITY_STYLES: Record<DrugInteraction['severity'], string> = {
  contraindicated: 'bg-red-50 border-red-400 text-red-900',
  high: 'bg-orange-50 border-orange-400 text-orange-900',
  moderate: 'bg-yellow-50 border-yellow-400 text-yellow-900',
  low: 'bg-blue-50 border-blue-400 text-blue-900',
};

const SEVERITY_LABEL: Record<DrugInteraction['severity'], string> = {
  contraindicated: 'CONTRAINDICATED',
  high: 'HIGH',
  moderate: 'MODERATE',
  low: 'LOW',
};

export const InteractionAlertModal: React.FC<InteractionAlertModalProps> = ({
  interactions,
  onAcknowledge,
  onCancel,
}) => {
  const [overrideReason, setOverrideReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);

  const hasContraindicated = interactions.some((i) => i.severity === 'contraindicated');

  const handleAcknowledge = useCallback(() => {
    if (hasContraindicated && !overrideReason.trim()) {
      setReasonError('Override reason is required for contraindicated interactions.');
      return;
    }
    onAcknowledge(overrideReason.trim());
  }, [hasContraindicated, overrideReason, onAcknowledge]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cds-alert-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        <h2 id="cds-alert-title" className="text-2xl font-semibold text-gray-900 mb-2">
          Drug interaction alerts
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          ONC 170.315(a)(9) Clinical Decision Support — review the interactions
          below before proceeding. Acknowledging records your override in the
          audit log.
        </p>

        <ul aria-label="Drug interactions" className="space-y-3">
          {interactions.map((interaction, idx) => (
            <li
              key={`${interaction.interacting_medication}-${idx}`}
              className={`p-4 rounded-lg border ${SEVERITY_STYLES[interaction.severity]}`}
            >
              <div className="flex justify-between items-start gap-2">
                <div>
                  <p className="font-bold text-base">
                    {SEVERITY_LABEL[interaction.severity]} — interaction with{' '}
                    {interaction.interacting_medication}
                  </p>
                  <p className="text-sm mt-1">{interaction.description}</p>
                  {interaction.clinical_effects && (
                    <p className="text-sm mt-2">
                      <strong>Clinical effects:</strong> {interaction.clinical_effects}
                    </p>
                  )}
                  {interaction.management && (
                    <p className="text-sm mt-2">
                      <strong>Management:</strong> {interaction.management}
                    </p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>

        {hasContraindicated && (
          <div className="mt-4">
            <label htmlFor="cds-override-reason" className="block text-base font-medium text-gray-700 mb-1">
              Override reason (required for contraindicated alerts)
            </label>
            <textarea
              id="cds-override-reason"
              value={overrideReason}
              onChange={(e) => {
                setOverrideReason(e.target.value);
                setReasonError(null);
              }}
              rows={3}
              placeholder="Document your clinical justification for overriding this alert."
              className="w-full p-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              aria-invalid={!!reasonError}
              aria-describedby={reasonError ? 'cds-override-reason-error' : undefined}
            />
            {reasonError && (
              <p id="cds-override-reason-error" role="alert" className="text-red-700 text-sm mt-1">
                {reasonError}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] px-6 text-base font-medium bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 focus:ring-2 focus:ring-gray-400"
          >
            Cancel order
          </button>
          <button
            type="button"
            onClick={handleAcknowledge}
            className={`min-h-[44px] px-6 text-base font-medium rounded-lg focus:ring-2 ${
              hasContraindicated
                ? 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
                : 'bg-amber-500 text-white hover:bg-amber-600 focus:ring-amber-400'
            }`}
          >
            {hasContraindicated ? 'Override and continue' : 'Acknowledge and continue'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InteractionAlertModal;
