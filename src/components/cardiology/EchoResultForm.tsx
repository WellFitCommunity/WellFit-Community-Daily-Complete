/**
 * EchoResultForm - Record echocardiogram results
 *
 * Purpose: Data entry for echo findings including LVEF, RV function,
 *          LV dimensions, valve assessment, and diastolic function
 * Used by: CardiologyDashboard overview tab
 */

import React, { useState } from 'react';
import { CardiologyService } from '../../services/cardiology';
import { CardiologyObservationService } from '../../services/fhir/cardiology';
import { auditLogger } from '../../services/auditLogger';
import { interpretLVEF } from '../../types/cardiology';
import type { CardEchoResult, ValveResult } from '../../types/cardiology';

interface EchoResultFormProps {
  patientId: string;
  tenantId: string;
  registryId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

type RVFunction = CardEchoResult['rv_function'];
type DiastolicFunction = NonNullable<CardEchoResult['diastolic_function']>;

const RV_OPTIONS: { value: RVFunction; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'mildly_reduced', label: 'Mildly Reduced' },
  { value: 'moderately_reduced', label: 'Moderately Reduced' },
  { value: 'severely_reduced', label: 'Severely Reduced' },
];

const DIASTOLIC_OPTIONS: { value: DiastolicFunction; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'grade_1', label: 'Grade I (Impaired Relaxation)' },
  { value: 'grade_2', label: 'Grade II (Pseudonormal)' },
  { value: 'grade_3', label: 'Grade III (Restrictive)' },
];

const WALL_MOTION_OPTIONS = [
  'anterior', 'anteroseptal', 'septal', 'inferoseptal',
  'inferior', 'inferolateral', 'anterolateral', 'apical',
];

const VALVES: ValveResult['valve'][] = ['mitral', 'aortic', 'tricuspid', 'pulmonic'];
const STENOSIS_GRADES: ValveResult['stenosis_grade'][] = ['none', 'mild', 'moderate', 'severe'];
const REGURG_GRADES: ValveResult['regurgitation_grade'][] = ['none', 'trace', 'mild', 'moderate', 'severe'];

function createDefaultValveResults(): ValveResult[] {
  return VALVES.map(valve => ({ valve, stenosis_grade: 'none', regurgitation_grade: 'none' }));
}

const EchoResultForm: React.FC<EchoResultFormProps> = ({
  patientId,
  tenantId,
  registryId,
  onSuccess,
  onCancel,
}) => {
  const [performedDate, setPerformedDate] = useState(new Date().toISOString().split('T')[0]);
  const [performedBy, setPerformedBy] = useState('');
  const [lvefPercent, setLvefPercent] = useState('');
  const [rvFunction, setRvFunction] = useState<RVFunction>('normal');
  const [lvedd, setLvedd] = useState('');
  const [lvesd, setLvesd] = useState('');
  const [wallMotion, setWallMotion] = useState<string[]>([]);
  const [valveResults, setValveResults] = useState<ValveResult[]>(createDefaultValveResults);
  const [pericardialEffusion, setPericardialEffusion] = useState(false);
  const [diastolicFunction, setDiastolicFunction] = useState<DiastolicFunction | ''>('');
  const [interpretation, setInterpretation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const lvefValue = lvefPercent ? parseFloat(lvefPercent) : null;

  const toggleWallMotion = (region: string) => {
    setWallMotion(prev =>
      prev.includes(region) ? prev.filter(r => r !== region) : [...prev, region]
    );
  };

  const updateValve = (
    valve: ValveResult['valve'],
    field: 'stenosis_grade' | 'regurgitation_grade',
    value: string
  ) => {
    setValveResults(prev =>
      prev.map(v =>
        v.valve === valve ? { ...v, [field]: value } : v
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lvefPercent) { setError('LVEF is required'); return; }

    setSaving(true);
    setError(null);

    try {
      const hasValveFindings = valveResults.some(
        v => v.stenosis_grade !== 'none' || v.regurgitation_grade !== 'none'
      );

      const result = await CardiologyService.createEchoResult({
        patient_id: patientId,
        tenant_id: tenantId,
        registry_id: registryId,
        performed_date: performedDate,
        performed_by: performedBy || undefined,
        lvef_percent: parseFloat(lvefPercent),
        rv_function: rvFunction,
        lv_end_diastolic_diameter_mm: lvedd ? parseFloat(lvedd) : undefined,
        lv_end_systolic_diameter_mm: lvesd ? parseFloat(lvesd) : undefined,
        wall_motion_abnormalities: wallMotion.length > 0 ? wallMotion : undefined,
        valve_results: hasValveFindings ? valveResults : undefined,
        pericardial_effusion: pericardialEffusion,
        diastolic_function: diastolicFunction || undefined,
        interpretation: interpretation || undefined,
      });

      if (!result.success) {
        setError(result.error || 'Failed to save echo result');
        return;
      }

      // Generate FHIR Observation for LVEF
      if (result.data) {
        await CardiologyObservationService.createObservationFromEcho(result.data);
      }

      await auditLogger.info('CARD_ECHO_RECORDED', {
        patientId,
        lvef: parseFloat(lvefPercent),
        rvFunction,
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
        <p className="text-green-800 font-medium text-lg">Echocardiogram result recorded</p>
        {lvefValue !== null && lvefValue < 40 && (
          <p className="text-red-700 font-medium mt-2">LVEF {lvefValue}% — {interpretLVEF(lvefValue)}</p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Record Echocardiogram</h3>
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
            placeholder="Sonographer/cardiologist name"
            className="w-full p-2 border border-gray-300 rounded-lg min-h-[44px]"
          />
        </div>
      </div>

      {/* Ventricular Function */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">LVEF (%) <span className="text-red-500">*</span></label>
          <input
            type="number"
            min={5}
            max={80}
            value={lvefPercent}
            onChange={(e) => setLvefPercent(e.target.value)}
            placeholder="e.g. 55"
            className="w-full p-2 border border-gray-300 rounded-lg min-h-[44px]"
            required
          />
          {lvefValue !== null && (
            <p className={`text-xs mt-1 ${lvefValue < 40 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
              {interpretLVEF(lvefValue)}
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">RV Function</label>
          <select
            value={rvFunction}
            onChange={(e) => setRvFunction(e.target.value as RVFunction)}
            className="w-full p-2 border border-gray-300 rounded-lg min-h-[44px]"
          >
            {RV_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* LV Dimensions */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">LV End-Diastolic (mm)</label>
          <input
            type="number"
            min={20}
            max={90}
            value={lvedd}
            onChange={(e) => setLvedd(e.target.value)}
            placeholder="35-56"
            className="w-full p-2 border border-gray-300 rounded-lg min-h-[44px]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">LV End-Systolic (mm)</label>
          <input
            type="number"
            min={10}
            max={70}
            value={lvesd}
            onChange={(e) => setLvesd(e.target.value)}
            placeholder="20-40"
            className="w-full p-2 border border-gray-300 rounded-lg min-h-[44px]"
          />
        </div>
      </div>

      {/* Valve Assessment */}
      <fieldset>
        <legend className="text-sm font-medium text-gray-700 mb-2">Valve Assessment</legend>
        <div className="space-y-3">
          {valveResults.map(vr => (
            <div key={vr.valve} className="grid grid-cols-3 gap-3 items-center">
              <span className="text-sm font-medium text-gray-700 capitalize">{vr.valve}</span>
              <select
                value={vr.stenosis_grade}
                onChange={(e) => updateValve(vr.valve, 'stenosis_grade', e.target.value)}
                className="p-2 border border-gray-300 rounded-lg text-sm min-h-[44px]"
                aria-label={`${vr.valve} stenosis`}
              >
                {STENOSIS_GRADES.map(g => (
                  <option key={g} value={g}>Stenosis: {g}</option>
                ))}
              </select>
              <select
                value={vr.regurgitation_grade}
                onChange={(e) => updateValve(vr.valve, 'regurgitation_grade', e.target.value)}
                className="p-2 border border-gray-300 rounded-lg text-sm min-h-[44px]"
                aria-label={`${vr.valve} regurgitation`}
              >
                {REGURG_GRADES.map(g => (
                  <option key={g} value={g}>Regurg: {g}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </fieldset>

      {/* Wall Motion Abnormalities */}
      <fieldset>
        <legend className="text-sm font-medium text-gray-700 mb-2">Wall Motion Abnormalities</legend>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {WALL_MOTION_OPTIONS.map(region => (
            <label key={region} className="flex items-center gap-2 cursor-pointer p-1">
              <input
                type="checkbox"
                checked={wallMotion.includes(region)}
                onChange={() => toggleWallMotion(region)}
                className="rounded border-gray-300"
              />
              <span className="text-sm capitalize">{region}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Other Findings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg cursor-pointer min-h-[44px]">
          <input
            type="checkbox"
            checked={pericardialEffusion}
            onChange={(e) => setPericardialEffusion(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="text-sm font-medium text-gray-700">Pericardial Effusion</span>
        </label>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Diastolic Function</label>
          <select
            value={diastolicFunction}
            onChange={(e) => setDiastolicFunction(e.target.value as DiastolicFunction | '')}
            className="w-full p-2 border border-gray-300 rounded-lg min-h-[44px]"
          >
            <option value="">Not assessed</option>
            {DIASTOLIC_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Interpretation */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Interpretation</label>
        <textarea
          value={interpretation}
          onChange={(e) => setInterpretation(e.target.value)}
          rows={3}
          className="w-full p-2 border border-gray-300 rounded-lg"
          placeholder="Overall echocardiographic interpretation..."
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
          disabled={saving || !lvefPercent}
          className="px-6 py-2 bg-red-600 text-white rounded-lg font-medium min-h-[44px] disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Echo Result'}
        </button>
      </div>
    </form>
  );
};

export default EchoResultForm;
