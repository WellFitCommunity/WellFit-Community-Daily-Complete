/**
 * RiskAssessmentForm - Maternal risk assessment scoring form
 *
 * Purpose: Document risk factors, calculate weighted risk score, determine risk level
 * Used by: LDOverview (when pregnancy exists)
 * Table: ld_risk_assessments
 *
 * Scoring: Each risk factor has a weight. Sum of weights determines risk level.
 * 0-2 = low, 3-5 = moderate, 6-9 = high, 10+ = critical
 */

import React, { useState, useCallback } from 'react';
import { LaborDeliveryService } from '../../services/laborDelivery';
import type { PregnancyRiskLevel } from '../../types/laborDelivery';
import { auditLogger } from '../../services/auditLogger';

interface RiskAssessmentFormProps {
  patientId: string;
  tenantId: string;
  pregnancyId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

interface WeightedRiskFactor {
  label: string;
  weight: number;
}

const WEIGHTED_RISK_FACTORS: WeightedRiskFactor[] = [
  { label: 'Advanced maternal age (>35)', weight: 1 },
  { label: 'Gestational diabetes', weight: 2 },
  { label: 'Preeclampsia', weight: 3 },
  { label: 'Chronic hypertension', weight: 2 },
  { label: 'Multiple gestation', weight: 3 },
  { label: 'Prior cesarean', weight: 1 },
  { label: 'Preterm labor history', weight: 2 },
  { label: 'Placenta previa', weight: 3 },
  { label: 'IUGR', weight: 2 },
  { label: 'Rh sensitization', weight: 2 },
  { label: 'Substance use', weight: 2 },
  { label: 'BMI > 40', weight: 2 },
  { label: 'Cervical insufficiency', weight: 2 },
  { label: 'Prior stillbirth', weight: 3 },
];

function calculateRiskLevel(score: number): PregnancyRiskLevel {
  if (score >= 10) return 'critical';
  if (score >= 6) return 'high';
  if (score >= 3) return 'moderate';
  return 'low';
}

const LEVEL_STYLES: Record<PregnancyRiskLevel, string> = {
  low: 'bg-green-100 text-green-800 border-green-300',
  moderate: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  high: 'bg-orange-100 text-orange-800 border-orange-300',
  critical: 'bg-red-100 text-red-800 border-red-300',
};

const RiskAssessmentForm: React.FC<RiskAssessmentFormProps> = ({
  patientId, tenantId, pregnancyId, onSuccess, onCancel,
}) => {
  const [selectedFactors, setSelectedFactors] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const score = WEIGHTED_RISK_FACTORS
    .filter((f) => selectedFactors.has(f.label))
    .reduce((sum, f) => sum + f.weight, 0);

  const riskLevel = calculateRiskLevel(score);

  const toggleFactor = useCallback((label: string) => {
    setSelectedFactors((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const result = await LaborDeliveryService.createRiskAssessment({
        patient_id: patientId,
        tenant_id: tenantId,
        pregnancy_id: pregnancyId,
        risk_level: riskLevel,
        risk_factors: Array.from(selectedFactors),
        score,
        scoring_system: 'weighted_factor_sum',
        notes: notes.trim() || undefined,
      });

      if (result.success) {
        onSuccess();
      } else {
        setError(result.error ?? 'Failed to save risk assessment');
      }
    } catch (err: unknown) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('LD_RISK_FORM_ERROR', errorObj, { patientId });
      setError(errorObj.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-6 space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Maternal Risk Assessment</h3>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      )}

      {/* Risk Score Display */}
      <div className={`border rounded-lg p-4 text-center ${LEVEL_STYLES[riskLevel]}`}>
        <p className="text-sm font-medium">Calculated Risk Level</p>
        <p className="text-3xl font-bold mt-1">{riskLevel.toUpperCase()}</p>
        <p className="text-sm mt-1">Score: {score} points</p>
      </div>

      {/* Risk Factor Checkboxes */}
      <fieldset>
        <legend className="text-sm font-medium text-gray-700 mb-3">
          Risk Factors (select all that apply)
        </legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {WEIGHTED_RISK_FACTORS.map((factor) => (
            <label
              key={factor.label}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer min-h-[44px] transition-colors ${
                selectedFactors.has(factor.label)
                  ? 'bg-pink-50 border-pink-300'
                  : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedFactors.has(factor.label)}
                onChange={() => toggleFactor(factor.label)}
                className="h-4 w-4 text-pink-600 rounded"
              />
              <span className="text-sm flex-1">{factor.label}</span>
              <span className="text-xs text-gray-400 font-mono">+{factor.weight}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Notes */}
      <div>
        <label htmlFor="risk-notes" className="block text-sm font-medium text-gray-700 mb-1">
          Clinical Notes (optional)
        </label>
        <textarea
          id="risk-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-lg border-gray-300 border p-3 text-sm focus:ring-pink-500 focus:border-pink-500"
          placeholder="Additional clinical observations..."
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button
          type="button" onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300
            rounded-lg hover:bg-gray-50 min-h-[44px]"
        >
          Cancel
        </button>
        <button
          type="submit" disabled={submitting}
          className="px-6 py-2 text-sm font-medium text-white bg-pink-600 rounded-lg
            hover:bg-pink-700 disabled:opacity-50 min-h-[44px]"
        >
          {submitting ? 'Saving...' : 'Save Risk Assessment'}
        </button>
      </div>
    </form>
  );
};

export default RiskAssessmentForm;
