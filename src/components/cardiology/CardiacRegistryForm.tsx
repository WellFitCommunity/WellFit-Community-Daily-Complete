/**
 * CardiacRegistryForm - Cardiac patient enrollment form
 *
 * Purpose: Enroll patient in cardiac registry with conditions, risk factors,
 *          NYHA class, baseline LVEF, and auto-calculated CHA2DS2-VASc score
 * Used by: CardiologyDashboard overview tab
 */

import React, { useState, useMemo } from 'react';
import { CardiologyService } from '../../services/cardiology';
import { auditLogger } from '../../services/auditLogger';
import {
  calculateCHA2DS2VASc,
  interpretLVEF,
  NYHA_DESCRIPTIONS,
} from '../../types/cardiology';
import type {
  CardiacCondition,
  CardiacRiskFactor,
  NYHAClass,
} from '../../types/cardiology';

interface CardiacRegistryFormProps {
  patientId: string;
  tenantId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const CONDITIONS: { value: CardiacCondition; label: string }[] = [
  { value: 'coronary_artery_disease', label: 'Coronary Artery Disease' },
  { value: 'heart_failure', label: 'Heart Failure' },
  { value: 'atrial_fibrillation', label: 'Atrial Fibrillation' },
  { value: 'hypertension', label: 'Hypertension' },
  { value: 'valvular_disease', label: 'Valvular Disease' },
  { value: 'cardiomyopathy', label: 'Cardiomyopathy' },
  { value: 'congenital_heart_disease', label: 'Congenital Heart Disease' },
  { value: 'peripheral_artery_disease', label: 'Peripheral Artery Disease' },
  { value: 'pulmonary_hypertension', label: 'Pulmonary Hypertension' },
  { value: 'aortic_aneurysm', label: 'Aortic Aneurysm' },
];

const RISK_FACTORS: { value: CardiacRiskFactor; label: string }[] = [
  { value: 'diabetes', label: 'Diabetes' },
  { value: 'hypertension', label: 'Hypertension' },
  { value: 'hyperlipidemia', label: 'Hyperlipidemia' },
  { value: 'smoking', label: 'Smoking' },
  { value: 'obesity', label: 'Obesity' },
  { value: 'family_history', label: 'Family History of CAD' },
  { value: 'sedentary_lifestyle', label: 'Sedentary Lifestyle' },
  { value: 'chronic_kidney_disease', label: 'Chronic Kidney Disease' },
  { value: 'sleep_apnea', label: 'Sleep Apnea' },
  { value: 'prior_mi', label: 'Prior MI' },
];

const NYHA_OPTIONS: NYHAClass[] = ['I', 'II', 'III', 'IV'];

const CardiacRegistryForm: React.FC<CardiacRegistryFormProps> = ({
  patientId,
  tenantId,
  onSuccess,
  onCancel,
}) => {
  const [conditions, setConditions] = useState<CardiacCondition[]>([]);
  const [riskFactors, setRiskFactors] = useState<CardiacRiskFactor[]>([]);
  const [nyhaClass, setNyhaClass] = useState<NYHAClass | ''>('');
  const [lvefPercent, setLvefPercent] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // CHA2DS2-VASc calculator inputs
  const [patientAge, setPatientAge] = useState('');
  const [isFemale, setIsFemale] = useState(false);
  const [hasStrokeTia, setHasStrokeTia] = useState(false);

  // Auto-derive CHA2DS2-VASc components from selected conditions/risk factors
  const cha2ds2VascScore = useMemo(() => {
    const age = parseInt(patientAge);
    if (isNaN(age) || age < 0) return null;
    return calculateCHA2DS2VASc({
      age,
      isFemale,
      hasChf: conditions.includes('heart_failure'),
      hasHypertension: conditions.includes('hypertension') || riskFactors.includes('hypertension'),
      hasDiabetes: riskFactors.includes('diabetes'),
      hasStrokeTia,
      hasVascularDisease: conditions.includes('peripheral_artery_disease') || riskFactors.includes('prior_mi'),
    });
  }, [patientAge, isFemale, conditions, riskFactors, hasStrokeTia]);

  const lvefValue = lvefPercent ? parseFloat(lvefPercent) : null;

  const toggleCondition = (condition: CardiacCondition) => {
    setConditions(prev =>
      prev.includes(condition) ? prev.filter(c => c !== condition) : [...prev, condition]
    );
  };

  const toggleRiskFactor = (factor: CardiacRiskFactor) => {
    setRiskFactors(prev =>
      prev.includes(factor) ? prev.filter(f => f !== factor) : [...prev, factor]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (conditions.length === 0) {
      setError('Select at least one cardiac condition');
      return;
    }
    setSaving(true);
    setError(null);

    try {
      const result = await CardiologyService.createRegistry({
        patient_id: patientId,
        tenant_id: tenantId,
        conditions,
        risk_factors: riskFactors,
        nyha_class: nyhaClass || undefined,
        lvef_percent: lvefValue ?? undefined,
        cha2ds2_vasc_score: cha2ds2VascScore ?? undefined,
        notes: notes || undefined,
      });

      if (!result.success) {
        setError(result.error || 'Failed to enroll patient');
        return;
      }

      await auditLogger.info('CARD_REGISTRY_ENROLLED', {
        patientId,
        conditions: conditions.length,
        riskFactors: riskFactors.length,
      });
      setSuccess(true);
      setTimeout(onSuccess, 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unexpected error';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (success) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
        <p className="text-green-800 font-medium text-lg">Patient enrolled in cardiac registry</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Cardiac Registry Enrollment</h3>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600 min-h-[44px] min-w-[44px]">
          Cancel
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3" role="alert">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Cardiac Conditions */}
      <fieldset>
        <legend className="text-sm font-medium text-gray-700 mb-2">
          Cardiac Conditions <span className="text-red-500">*</span>
        </legend>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {CONDITIONS.map(({ value, label }) => (
            <label key={value} className="flex items-center gap-2 cursor-pointer p-1">
              <input
                type="checkbox"
                checked={conditions.includes(value)}
                onChange={() => toggleCondition(value)}
                className="rounded border-gray-300"
              />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Risk Factors */}
      <fieldset>
        <legend className="text-sm font-medium text-gray-700 mb-2">Risk Factors</legend>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {RISK_FACTORS.map(({ value, label }) => (
            <label key={value} className="flex items-center gap-2 cursor-pointer p-1">
              <input
                type="checkbox"
                checked={riskFactors.includes(value)}
                onChange={() => toggleRiskFactor(value)}
                className="rounded border-gray-300"
              />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Clinical Assessment */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">NYHA Class</label>
          <select
            value={nyhaClass}
            onChange={(e) => setNyhaClass(e.target.value as NYHAClass | '')}
            className="w-full p-2 border border-gray-300 rounded-lg min-h-[44px]"
          >
            <option value="">Not assessed</option>
            {NYHA_OPTIONS.map(cls => (
              <option key={cls} value={cls}>Class {cls}</option>
            ))}
          </select>
          {nyhaClass && (
            <p className="text-xs text-gray-500 mt-1">{NYHA_DESCRIPTIONS[nyhaClass]}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Baseline LVEF (%)</label>
          <input
            type="number"
            min={0}
            max={80}
            value={lvefPercent}
            onChange={(e) => setLvefPercent(e.target.value)}
            placeholder="e.g. 55"
            className="w-full p-2 border border-gray-300 rounded-lg min-h-[44px]"
          />
          {lvefValue !== null && (
            <p className="text-xs text-gray-500 mt-1">{interpretLVEF(lvefValue)}</p>
          )}
        </div>
      </div>

      {/* CHA2DS2-VASc Calculator */}
      {conditions.includes('atrial_fibrillation') && (
        <fieldset className="bg-gray-50 rounded-lg p-4">
          <legend className="text-sm font-medium text-gray-700 mb-2">CHA2DS2-VASc Score (AFib Stroke Risk)</legend>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Patient Age</label>
              <input
                type="number"
                min={0}
                max={120}
                value={patientAge}
                onChange={(e) => setPatientAge(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded min-h-[44px]"
              />
            </div>
            <label className="flex items-center gap-2 p-1">
              <input type="checkbox" checked={isFemale} onChange={(e) => setIsFemale(e.target.checked)} className="rounded" />
              <span className="text-sm">Female sex</span>
            </label>
            <label className="flex items-center gap-2 p-1">
              <input type="checkbox" checked={hasStrokeTia} onChange={(e) => setHasStrokeTia(e.target.checked)} className="rounded" />
              <span className="text-sm">Prior Stroke/TIA</span>
            </label>
            {cha2ds2VascScore !== null && (
              <div className="flex items-center">
                <span className="text-sm text-gray-600 mr-2">Score:</span>
                <span className="text-2xl font-bold text-red-600">{cha2ds2VascScore}</span>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2">CHF, HTN, DM, and vascular disease auto-derived from selections above</p>
        </fieldset>
      )}

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full p-2 border border-gray-300 rounded-lg"
          placeholder="Additional clinical notes..."
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 min-h-[44px]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || conditions.length === 0}
          className="px-6 py-2 bg-red-600 text-white rounded-lg font-medium min-h-[44px] disabled:opacity-50"
        >
          {saving ? 'Enrolling...' : 'Enroll Patient'}
        </button>
      </div>
    </form>
  );
};

export default CardiacRegistryForm;
