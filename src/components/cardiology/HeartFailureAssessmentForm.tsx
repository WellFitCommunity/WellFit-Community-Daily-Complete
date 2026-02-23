/**
 * HeartFailureAssessmentForm - Record heart failure assessment
 *
 * Purpose: Data entry for HF clinical assessment including NYHA class,
 *          BNP/NT-proBNP, weight tracking, fluid status, and clinical signs
 * Used by: CardiologyDashboard heart failure tab
 */

import React, { useState } from 'react';
import { CardiologyService } from '../../services/cardiology';
import { CardiologyObservationService } from '../../services/fhir/cardiology';
import { auditLogger } from '../../services/auditLogger';
import { interpretBNP, getWeightChangeAlert, NYHA_DESCRIPTIONS } from '../../types/cardiology';
import type { NYHAClass, FluidStatus, EdemaGrade } from '../../types/cardiology';

interface HeartFailureAssessmentFormProps {
  patientId: string;
  tenantId: string;
  registryId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const FLUID_STATUS_OPTIONS: { value: FluidStatus; label: string }[] = [
  { value: 'euvolemic', label: 'Euvolemic (Normal)' },
  { value: 'hypervolemic', label: 'Hypervolemic (Fluid Overloaded)' },
  { value: 'hypovolemic', label: 'Hypovolemic (Volume Depleted)' },
];

const EDEMA_OPTIONS: { value: EdemaGrade; label: string }[] = [
  { value: 0, label: '0 — None' },
  { value: 1, label: '1+ — Mild, 2mm' },
  { value: 2, label: '2+ — Moderate, 4mm' },
  { value: 3, label: '3+ — Severe, 6mm' },
  { value: 4, label: '4+ — Very severe, 8mm+' },
];

const NYHA_OPTIONS: NYHAClass[] = ['I', 'II', 'III', 'IV'];

const HeartFailureAssessmentForm: React.FC<HeartFailureAssessmentFormProps> = ({
  patientId,
  tenantId,
  registryId,
  onSuccess,
  onCancel,
}) => {
  const [assessedBy, setAssessedBy] = useState('');
  const [nyhaClass, setNyhaClass] = useState<NYHAClass>('II');
  const [bnp, setBnp] = useState('');
  const [ntProBnp, setNtProBnp] = useState('');
  const [dailyWeight, setDailyWeight] = useState('');
  const [previousWeight, setPreviousWeight] = useState('');
  const [fluidStatus, setFluidStatus] = useState<FluidStatus>('euvolemic');
  const [edemaGrade, setEdemaGrade] = useState<EdemaGrade>(0);
  const [dyspnea, setDyspnea] = useState(false);
  const [orthopnea, setOrthopnea] = useState(false);
  const [pnd, setPnd] = useState(false);
  const [jvd, setJvd] = useState(false);
  const [crackles, setCrackles] = useState(false);
  const [s3Gallop, setS3Gallop] = useState(false);
  const [fluidRestriction, setFluidRestriction] = useState('');
  const [sodiumRestriction, setSodiumRestriction] = useState('');
  const [diureticAdjustment, setDiureticAdjustment] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const bnpValue = bnp ? parseFloat(bnp) : null;
  const dailyWeightVal = dailyWeight ? parseFloat(dailyWeight) : null;
  const previousWeightVal = previousWeight ? parseFloat(previousWeight) : null;
  const weightChange = dailyWeightVal !== null && previousWeightVal !== null
    ? dailyWeightVal - previousWeightVal
    : null;
  const weightAlert = weightChange !== null ? getWeightChangeAlert(weightChange) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dailyWeight) { setError('Daily weight is required'); return; }

    setSaving(true);
    setError(null);

    try {
      const result = await CardiologyService.createHeartFailureAssessment({
        patient_id: patientId,
        tenant_id: tenantId,
        registry_id: registryId,
        assessed_by: assessedBy || undefined,
        nyha_class: nyhaClass,
        bnp_pg_ml: bnpValue ?? undefined,
        nt_pro_bnp_pg_ml: ntProBnp ? parseFloat(ntProBnp) : undefined,
        daily_weight_kg: parseFloat(dailyWeight),
        previous_weight_kg: previousWeightVal ?? undefined,
        fluid_status: fluidStatus,
        edema_grade: edemaGrade,
        dyspnea_at_rest: dyspnea,
        orthopnea,
        pnd,
        jugular_venous_distension: jvd,
        crackles,
        s3_gallop: s3Gallop,
        fluid_restriction_ml: fluidRestriction ? parseInt(fluidRestriction) : undefined,
        sodium_restriction_mg: sodiumRestriction ? parseInt(sodiumRestriction) : undefined,
        diuretic_adjustment: diureticAdjustment || undefined,
        notes: notes || undefined,
      });

      if (!result.success) {
        setError(result.error || 'Failed to save HF assessment');
        return;
      }

      // Generate FHIR Observation for BNP
      if (result.data) {
        await CardiologyObservationService.createObservationFromHF(result.data);
      }

      await auditLogger.info('CARD_HF_ASSESSMENT_RECORDED', {
        patientId,
        nyhaClass,
        dailyWeightKg: parseFloat(dailyWeight),
        weightAlert,
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
        <p className="text-green-800 font-medium text-lg">Heart failure assessment recorded</p>
        {weightAlert && (
          <p className={`font-medium mt-2 ${weightAlert === 'high' ? 'text-red-700' : 'text-yellow-700'}`}>
            Weight change: {weightChange !== null ? `${weightChange > 0 ? '+' : ''}${weightChange.toFixed(1)} kg` : ''}
            {weightAlert === 'high' ? ' — Contact provider' : ' — Monitor closely'}
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Heart Failure Assessment</h3>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600 min-h-[44px] min-w-[44px]">
          Cancel
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3" role="alert">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Assessed By */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Assessed By</label>
        <input
          type="text"
          value={assessedBy}
          onChange={(e) => setAssessedBy(e.target.value)}
          placeholder="Provider name"
          className="w-full p-2 border border-gray-300 rounded-lg min-h-[44px]"
        />
      </div>

      {/* NYHA Class */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">NYHA Functional Class <span className="text-red-500">*</span></label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {NYHA_OPTIONS.map(cls => (
            <button
              key={cls}
              type="button"
              onClick={() => setNyhaClass(cls)}
              className={`p-3 rounded-lg border text-center min-h-[44px] transition-colors ${
                nyhaClass === cls
                  ? 'bg-red-50 border-red-500 text-red-700 font-medium'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="block text-lg font-bold">Class {cls}</span>
              <span className="block text-xs mt-1">{NYHA_DESCRIPTIONS[cls]?.substring(0, 40)}...</span>
            </button>
          ))}
        </div>
      </div>

      {/* BNP / NT-proBNP */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">BNP (pg/mL)</label>
          <input
            type="number"
            min={0}
            max={50000}
            value={bnp}
            onChange={(e) => setBnp(e.target.value)}
            placeholder="e.g. 250"
            className="w-full p-2 border border-gray-300 rounded-lg min-h-[44px]"
          />
          {bnpValue !== null && (
            <p className={`text-xs mt-1 ${bnpValue >= 400 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
              {interpretBNP(bnpValue)}
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">NT-proBNP (pg/mL)</label>
          <input
            type="number"
            min={0}
            max={100000}
            value={ntProBnp}
            onChange={(e) => setNtProBnp(e.target.value)}
            placeholder="e.g. 900"
            className="w-full p-2 border border-gray-300 rounded-lg min-h-[44px]"
          />
        </div>
      </div>

      {/* Weight Tracking */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Daily Weight (kg) <span className="text-red-500">*</span></label>
          <input
            type="number"
            min={20}
            max={300}
            step={0.1}
            value={dailyWeight}
            onChange={(e) => setDailyWeight(e.target.value)}
            placeholder="e.g. 80.5"
            className="w-full p-2 border border-gray-300 rounded-lg min-h-[44px]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Previous Weight (kg)</label>
          <input
            type="number"
            min={20}
            max={300}
            step={0.1}
            value={previousWeight}
            onChange={(e) => setPreviousWeight(e.target.value)}
            placeholder="e.g. 79.0"
            className="w-full p-2 border border-gray-300 rounded-lg min-h-[44px]"
          />
        </div>
      </div>
      {weightChange !== null && (
        <div className={`rounded-lg p-3 ${
          weightAlert === 'high' ? 'bg-red-50 border border-red-200' :
          weightAlert === 'medium' ? 'bg-yellow-50 border border-yellow-200' :
          'bg-green-50 border border-green-200'
        }`}>
          <p className={`text-sm font-medium ${
            weightAlert === 'high' ? 'text-red-700' :
            weightAlert === 'medium' ? 'text-yellow-700' :
            'text-green-700'
          }`}>
            Weight change: {weightChange > 0 ? '+' : ''}{weightChange.toFixed(1)} kg ({(weightChange * 2.205).toFixed(1)} lbs)
            {weightAlert === 'high' && ' — Significant fluid retention'}
            {weightAlert === 'medium' && ' — Monitor closely'}
            {!weightAlert && ' — Within normal range'}
          </p>
        </div>
      )}

      {/* Fluid Status & Edema */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fluid Status</label>
          <select
            value={fluidStatus}
            onChange={(e) => setFluidStatus(e.target.value as FluidStatus)}
            className="w-full p-2 border border-gray-300 rounded-lg min-h-[44px]"
          >
            {FLUID_STATUS_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Edema Grade</label>
          <select
            value={edemaGrade}
            onChange={(e) => setEdemaGrade(parseInt(e.target.value) as EdemaGrade)}
            className="w-full p-2 border border-gray-300 rounded-lg min-h-[44px]"
          >
            {EDEMA_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Clinical Signs */}
      <fieldset>
        <legend className="text-sm font-medium text-gray-700 mb-2">Clinical Signs</legend>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {[
            { label: 'Dyspnea at Rest', checked: dyspnea, onChange: setDyspnea },
            { label: 'Orthopnea', checked: orthopnea, onChange: setOrthopnea },
            { label: 'PND (Paroxysmal Nocturnal Dyspnea)', checked: pnd, onChange: setPnd },
            { label: 'JVD (Jugular Venous Distension)', checked: jvd, onChange: setJvd },
            { label: 'Crackles', checked: crackles, onChange: setCrackles },
            { label: 'S3 Gallop', checked: s3Gallop, onChange: setS3Gallop },
          ].map(({ label, checked, onChange }) => (
            <label key={label} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-50">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Restrictions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fluid Restriction (mL/day)</label>
          <input
            type="number"
            min={500}
            max={5000}
            step={100}
            value={fluidRestriction}
            onChange={(e) => setFluidRestriction(e.target.value)}
            placeholder="e.g. 1500"
            className="w-full p-2 border border-gray-300 rounded-lg min-h-[44px]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sodium Restriction (mg/day)</label>
          <input
            type="number"
            min={500}
            max={5000}
            step={100}
            value={sodiumRestriction}
            onChange={(e) => setSodiumRestriction(e.target.value)}
            placeholder="e.g. 2000"
            className="w-full p-2 border border-gray-300 rounded-lg min-h-[44px]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Diuretic Adjustment</label>
          <input
            type="text"
            value={diureticAdjustment}
            onChange={(e) => setDiureticAdjustment(e.target.value)}
            placeholder="e.g. Increase Lasix to 40mg BID"
            className="w-full p-2 border border-gray-300 rounded-lg min-h-[44px]"
          />
        </div>
      </div>

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
          disabled={saving || !dailyWeight}
          className="px-6 py-2 bg-red-600 text-white rounded-lg font-medium min-h-[44px] disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save HF Assessment'}
        </button>
      </div>
    </form>
  );
};

export default HeartFailureAssessmentForm;
