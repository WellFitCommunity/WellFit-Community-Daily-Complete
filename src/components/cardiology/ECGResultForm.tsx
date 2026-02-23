/**
 * ECGResultForm - Record a 12-lead ECG result
 *
 * Purpose: Data entry for ECG findings including rhythm, intervals, ST changes,
 *          STEMI detection, and clinical interpretation
 * Used by: CardiologyDashboard ECG & Tests tab
 */

import React, { useState } from 'react';
import { CardiologyService } from '../../services/cardiology';
import { CardiologyObservationService } from '../../services/fhir/cardiology';
import { auditLogger } from '../../services/auditLogger';
import type { ECGRhythm, STChange } from '../../types/cardiology';

interface ECGResultFormProps {
  patientId: string;
  tenantId: string;
  registryId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const RHYTHM_OPTIONS: { value: ECGRhythm; label: string }[] = [
  { value: 'normal_sinus', label: 'Normal Sinus Rhythm' },
  { value: 'sinus_bradycardia', label: 'Sinus Bradycardia' },
  { value: 'sinus_tachycardia', label: 'Sinus Tachycardia' },
  { value: 'atrial_fibrillation', label: 'Atrial Fibrillation' },
  { value: 'atrial_flutter', label: 'Atrial Flutter' },
  { value: 'svt', label: 'SVT' },
  { value: 'ventricular_tachycardia', label: 'Ventricular Tachycardia' },
  { value: 'ventricular_fibrillation', label: 'Ventricular Fibrillation' },
  { value: 'heart_block_first', label: '1st Degree Heart Block' },
  { value: 'heart_block_second_type1', label: '2nd Degree Type I (Wenckebach)' },
  { value: 'heart_block_second_type2', label: '2nd Degree Type II (Mobitz)' },
  { value: 'heart_block_third', label: '3rd Degree (Complete) Heart Block' },
  { value: 'paced_rhythm', label: 'Paced Rhythm' },
  { value: 'junctional_rhythm', label: 'Junctional Rhythm' },
];

const ST_OPTIONS: { value: STChange; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'st_elevation', label: 'ST Elevation' },
  { value: 'st_depression', label: 'ST Depression' },
  { value: 't_wave_inversion', label: 'T-Wave Inversion' },
  { value: 'nonspecific', label: 'Nonspecific ST-T Changes' },
];

const ECGResultForm: React.FC<ECGResultFormProps> = ({
  patientId,
  tenantId,
  registryId,
  onSuccess,
  onCancel,
}) => {
  const [performedDate, setPerformedDate] = useState(new Date().toISOString().split('T')[0]);
  const [performedBy, setPerformedBy] = useState('');
  const [rhythm, setRhythm] = useState<ECGRhythm | ''>('');
  const [heartRate, setHeartRate] = useState('');
  const [prInterval, setPrInterval] = useState('');
  const [qrsDuration, setQrsDuration] = useState('');
  const [qtc, setQtc] = useState('');
  const [axisDegrees, setAxisDegrees] = useState('');
  const [stChanges, setStChanges] = useState<STChange>('none');
  const [isStemi, setIsStemi] = useState(false);
  const [isNormal, setIsNormal] = useState(false);
  const [interpretation, setInterpretation] = useState('');
  const [findingsText, setFindingsText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rhythm) { setError('Rhythm is required'); return; }
    if (!heartRate) { setError('Heart rate is required'); return; }

    setSaving(true);
    setError(null);

    try {
      const findings = findingsText
        .split('\n')
        .map(f => f.trim())
        .filter(f => f.length > 0);

      const result = await CardiologyService.createEcgResult({
        patient_id: patientId,
        tenant_id: tenantId,
        registry_id: registryId,
        performed_date: performedDate,
        performed_by: performedBy || undefined,
        rhythm,
        heart_rate: parseInt(heartRate),
        pr_interval_ms: prInterval ? parseInt(prInterval) : undefined,
        qrs_duration_ms: qrsDuration ? parseInt(qrsDuration) : undefined,
        qtc_ms: qtc ? parseInt(qtc) : undefined,
        axis_degrees: axisDegrees ? parseInt(axisDegrees) : undefined,
        st_changes: stChanges,
        is_stemi: isStemi,
        is_normal: isNormal,
        interpretation: interpretation || undefined,
        findings: findings.length > 0 ? findings : undefined,
      });

      if (!result.success) {
        setError(result.error || 'Failed to save ECG result');
        return;
      }

      // Generate FHIR Observations from ECG data
      if (result.data) {
        await CardiologyObservationService.createObservationsFromEcg(result.data);
      }

      await auditLogger.info('CARD_ECG_RECORDED', {
        patientId,
        rhythm,
        isStemi,
        heartRate: parseInt(heartRate),
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
        <p className="text-green-800 font-medium text-lg">ECG result recorded</p>
        {isStemi && (
          <p className="text-red-700 font-bold mt-2">STEMI DETECTED — Activate cath lab protocol</p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Record ECG Result</h3>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600 min-h-[44px] min-w-[44px]">
          Cancel
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3" role="alert">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Test Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date Performed <span className="text-red-500">*</span></label>
          <input
            type="date"
            value={performedDate}
            onChange={(e) => setPerformedDate(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-lg min-h-[44px]"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Performed By</label>
          <input
            type="text"
            value={performedBy}
            onChange={(e) => setPerformedBy(e.target.value)}
            placeholder="Technician/provider name"
            className="w-full p-2 border border-gray-300 rounded-lg min-h-[44px]"
          />
        </div>
      </div>

      {/* Rhythm & Rate */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Rhythm <span className="text-red-500">*</span></label>
          <select
            value={rhythm}
            onChange={(e) => setRhythm(e.target.value as ECGRhythm)}
            className="w-full p-2 border border-gray-300 rounded-lg min-h-[44px]"
            required
          >
            <option value="">Select rhythm...</option>
            {RHYTHM_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Heart Rate (bpm) <span className="text-red-500">*</span></label>
          <input
            type="number"
            min={20}
            max={300}
            value={heartRate}
            onChange={(e) => setHeartRate(e.target.value)}
            placeholder="e.g. 72"
            className="w-full p-2 border border-gray-300 rounded-lg min-h-[44px]"
            required
          />
        </div>
      </div>

      {/* Intervals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">PR (ms)</label>
          <input
            type="number"
            min={0}
            max={500}
            value={prInterval}
            onChange={(e) => setPrInterval(e.target.value)}
            placeholder="120-200"
            className="w-full p-2 border border-gray-300 rounded-lg min-h-[44px]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">QRS (ms)</label>
          <input
            type="number"
            min={0}
            max={300}
            value={qrsDuration}
            onChange={(e) => setQrsDuration(e.target.value)}
            placeholder="80-120"
            className="w-full p-2 border border-gray-300 rounded-lg min-h-[44px]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">QTc (ms)</label>
          <input
            type="number"
            min={0}
            max={700}
            value={qtc}
            onChange={(e) => setQtc(e.target.value)}
            placeholder="350-450"
            className="w-full p-2 border border-gray-300 rounded-lg min-h-[44px]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Axis (°)</label>
          <input
            type="number"
            min={-180}
            max={180}
            value={axisDegrees}
            onChange={(e) => setAxisDegrees(e.target.value)}
            placeholder="-30 to 90"
            className="w-full p-2 border border-gray-300 rounded-lg min-h-[44px]"
          />
        </div>
      </div>

      {/* ST Changes & STEMI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ST Changes</label>
          <select
            value={stChanges}
            onChange={(e) => setStChanges(e.target.value as STChange)}
            className="w-full p-2 border border-gray-300 rounded-lg min-h-[44px]"
          >
            {ST_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded-lg cursor-pointer min-h-[44px]">
          <input
            type="checkbox"
            checked={isStemi}
            onChange={(e) => setIsStemi(e.target.checked)}
            className="rounded border-red-400"
          />
          <span className="text-sm font-medium text-red-700">STEMI Detected</span>
        </label>
        <label className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg cursor-pointer min-h-[44px]">
          <input
            type="checkbox"
            checked={isNormal}
            onChange={(e) => setIsNormal(e.target.checked)}
            className="rounded border-green-400"
          />
          <span className="text-sm font-medium text-green-700">Normal ECG</span>
        </label>
      </div>

      {/* Findings & Interpretation */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Findings (one per line)</label>
        <textarea
          value={findingsText}
          onChange={(e) => setFindingsText(e.target.value)}
          rows={3}
          className="w-full p-2 border border-gray-300 rounded-lg"
          placeholder="Left axis deviation&#10;Left ventricular hypertrophy&#10;..."
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Interpretation</label>
        <textarea
          value={interpretation}
          onChange={(e) => setInterpretation(e.target.value)}
          rows={2}
          className="w-full p-2 border border-gray-300 rounded-lg"
          placeholder="Overall ECG interpretation..."
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
          disabled={saving || !rhythm || !heartRate}
          className="px-6 py-2 bg-red-600 text-white rounded-lg font-medium min-h-[44px] disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save ECG Result'}
        </button>
      </div>
    </form>
  );
};

export default ECGResultForm;
