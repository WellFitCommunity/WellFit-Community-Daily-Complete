/**
 * LDDrugInteractionAlert — Drug interaction warning for L&D medications
 *
 * Purpose: Auto-check medication against patient's active meds before administration
 * Used by: MedicationAdminForm (shown after medication is selected, before confirm)
 */

import React, { useState, useEffect } from 'react';
import { checkLDDrugInteraction } from '../../services/laborDelivery/laborDeliveryAI';
import type { LDDrugInteractionResult } from '../../services/laborDelivery/laborDeliveryAI';

interface LDDrugInteractionAlertProps {
  medicationName: string;
  patientId: string;
  onSafetyCheck?: (safe: boolean) => void;
}

const LDDrugInteractionAlert: React.FC<LDDrugInteractionAlertProps> = ({
  medicationName,
  patientId,
  onSafetyCheck,
}) => {
  const [result, setResult] = useState<LDDrugInteractionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!medicationName || !patientId) return;

    let cancelled = false;
    const check = async () => {
      setLoading(true);
      setError(null);
      const response = await checkLDDrugInteraction(medicationName, patientId);
      if (cancelled) return;
      if (response.success && response.data) {
        setResult(response.data);
        onSafetyCheck?.(!response.data.has_interactions);
      } else {
        setError(response.error?.message ?? 'Interaction check failed');
        onSafetyCheck?.(true); // Don't block on check failure
      }
      setLoading(false);
    };
    check();

    return () => { cancelled = true; };
    // Only re-run when medication or patient changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medicationName, patientId]);

  if (loading) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-700">
        Checking drug interactions for {medicationName}...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded p-3 text-sm text-gray-600">
        Drug interaction check unavailable: {error}
      </div>
    );
  }

  if (!result) return null;

  if (!result.has_interactions) {
    return (
      <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-700">
        No known drug interactions found for {medicationName}
        {result.checked_against.length > 0 && (
          <span className="text-xs text-green-600 ml-1">
            (checked against {result.checked_against.length} active medications)
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4" role="alert">
      <h5 className="text-red-800 font-bold text-sm mb-2">
        Drug Interaction Warning — {medicationName}
      </h5>
      <div className="space-y-2">
        {result.interactions.map((interaction, i) => (
          <div key={i} className="bg-white rounded p-3 border border-red-200">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                interaction.severity === 'high' ? 'bg-red-200 text-red-800' :
                interaction.severity === 'moderate' ? 'bg-orange-200 text-orange-800' :
                'bg-yellow-200 text-yellow-800'
              }`}>
                {interaction.severity.toUpperCase()}
              </span>
              <span className="text-sm font-medium text-gray-800">
                {interaction.interacting_medication}
              </span>
            </div>
            <p className="text-xs text-gray-700">{interaction.description}</p>
          </div>
        ))}
      </div>

      {result.alternatives && result.alternatives.length > 0 && (
        <div className="mt-3 pt-3 border-t border-red-200">
          <h6 className="text-xs font-semibold text-gray-700 mb-2">AI-Suggested Alternatives</h6>
          {result.alternatives.map((alt, i) => (
            <div key={i} className="text-xs text-gray-600 mb-1">
              <span className="font-medium">{alt.medication_name}</span> — {alt.rationale}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-red-700 mt-3 font-medium">
        Review with pharmacist before proceeding. Interaction check is advisory only.
      </p>
    </div>
  );
};

export default LDDrugInteractionAlert;
