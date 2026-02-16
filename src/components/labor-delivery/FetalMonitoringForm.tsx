/**
 * FetalMonitoringForm - Record fetal heart rate monitoring
 *
 * Purpose: Clinician data entry for fetal heart rate assessment
 * Used by: LaborDeliveryDashboard Labor & Delivery tab
 */

import React, { useState } from 'react';
import type {
  CreateFetalMonitoringRequest,
  FHRVariability,
  DecelerationType,
  FetalHRCategory,
} from '../../types/laborDelivery';
import { LaborDeliveryService } from '../../services/laborDelivery';

interface FetalMonitoringFormProps {
  patientId: string;
  tenantId: string;
  pregnancyId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

interface FormState {
  assessment_time: string;
  assessed_by: string;
  fhr_baseline: string;
  variability: FHRVariability;
  accelerations_present: boolean;
  deceleration_type: DecelerationType;
  deceleration_depth_bpm: string;
  fhr_category: FetalHRCategory;
  uterine_activity: string;
  interpretation: string;
  action_taken: string;
}

const INITIAL_STATE: FormState = {
  assessment_time: new Date().toISOString().slice(0, 16),
  assessed_by: '',
  fhr_baseline: '',
  variability: 'moderate',
  accelerations_present: true,
  deceleration_type: 'none',
  deceleration_depth_bpm: '',
  fhr_category: 'I',
  uterine_activity: '',
  interpretation: '',
  action_taken: '',
};

const VARIABILITY_OPTIONS: { value: FHRVariability; label: string }[] = [
  { value: 'absent', label: 'Absent' },
  { value: 'minimal', label: 'Minimal (0-5 bpm)' },
  { value: 'moderate', label: 'Moderate (6-25 bpm)' },
  { value: 'marked', label: 'Marked (>25 bpm)' },
];

const DECEL_OPTIONS: { value: DecelerationType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'early', label: 'Early' },
  { value: 'late', label: 'Late' },
  { value: 'variable', label: 'Variable' },
  { value: 'prolonged', label: 'Prolonged' },
];

const CATEGORY_OPTIONS: { value: FetalHRCategory; label: string }[] = [
  { value: 'I', label: 'Category I (Normal)' },
  { value: 'II', label: 'Category II (Indeterminate)' },
  { value: 'III', label: 'Category III (Abnormal)' },
];

const FetalMonitoringForm: React.FC<FetalMonitoringFormProps> = ({
  patientId,
  tenantId,
  pregnancyId,
  onSuccess,
  onCancel,
}) => {
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const fhrBaseline = parseInt(form.fhr_baseline, 10);
    if (isNaN(fhrBaseline)) {
      setError('FHR baseline is required.');
      return;
    }

    setSaving(true);
    const request: CreateFetalMonitoringRequest = {
      patient_id: patientId,
      tenant_id: tenantId,
      pregnancy_id: pregnancyId,
      assessment_time: new Date(form.assessment_time).toISOString(),
      assessed_by: form.assessed_by || undefined,
      fhr_baseline: fhrBaseline,
      variability: form.variability,
      accelerations_present: form.accelerations_present,
      deceleration_type: form.deceleration_type,
      deceleration_depth_bpm: form.deceleration_depth_bpm
        ? parseInt(form.deceleration_depth_bpm, 10)
        : undefined,
      fhr_category: form.fhr_category,
      uterine_activity: form.uterine_activity || undefined,
      interpretation: form.interpretation || undefined,
      action_taken: form.action_taken || undefined,
    };

    const result = await LaborDeliveryService.createFetalMonitoring(request);
    setSaving(false);

    if (result.success) {
      onSuccess();
    } else {
      setError(result.error ?? 'Failed to save fetal monitoring.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-6 space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Fetal Heart Rate Monitoring</h3>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded" role="alert">
          {error}
        </div>
      )}

      {/* Row 1: Time + Assessed By + FHR Baseline */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="fm-time" className="block text-sm font-medium text-gray-700 mb-1">Assessment Time</label>
          <input id="fm-time" type="datetime-local" name="assessment_time" value={form.assessment_time}
            onChange={handleChange} required className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="fm-assessor" className="block text-sm font-medium text-gray-700 mb-1">Assessed By</label>
          <input id="fm-assessor" type="text" name="assessed_by" value={form.assessed_by}
            onChange={handleChange} placeholder="Nurse/provider name"
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="fm-fhr" className="block text-sm font-medium text-gray-700 mb-1">FHR Baseline (bpm)</label>
          <input id="fm-fhr" type="number" name="fhr_baseline" value={form.fhr_baseline}
            onChange={handleChange} min="60" max="240"
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
      </div>

      {/* Row 2: Variability + Decelerations + Category */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="fm-variability" className="block text-sm font-medium text-gray-700 mb-1">Variability</label>
          <select id="fm-variability" name="variability" value={form.variability} onChange={handleChange}
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]">
            {VARIABILITY_OPTIONS.map((v) => (
              <option key={v.value} value={v.value}>{v.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="fm-decel" className="block text-sm font-medium text-gray-700 mb-1">Decelerations</label>
          <select id="fm-decel" name="deceleration_type" value={form.deceleration_type} onChange={handleChange}
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]">
            {DECEL_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="fm-category" className="block text-sm font-medium text-gray-700 mb-1">FHR Category</label>
          <select id="fm-category" name="fhr_category" value={form.fhr_category} onChange={handleChange}
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]">
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 3: Decel Depth + Accelerations + Uterine Activity */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="fm-decel-depth" className="block text-sm font-medium text-gray-700 mb-1">Decel Depth (bpm)</label>
          <input id="fm-decel-depth" type="number" name="deceleration_depth_bpm" value={form.deceleration_depth_bpm}
            onChange={handleChange} min="0" max="100"
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 min-h-[44px]">
            <input type="checkbox" name="accelerations_present" checked={form.accelerations_present}
              onChange={handleChange} className="h-5 w-5 rounded border-gray-300" />
            <span className="text-sm font-medium text-gray-700">Accelerations Present</span>
          </label>
        </div>
        <div>
          <label htmlFor="fm-uterine" className="block text-sm font-medium text-gray-700 mb-1">Uterine Activity</label>
          <input id="fm-uterine" type="text" name="uterine_activity" value={form.uterine_activity}
            onChange={handleChange} placeholder="e.g. regular q3min"
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
      </div>

      {/* Row 4: Interpretation + Action Taken */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="fm-interpretation" className="block text-sm font-medium text-gray-700 mb-1">Interpretation</label>
          <textarea id="fm-interpretation" name="interpretation" value={form.interpretation}
            onChange={handleChange} rows={2} placeholder="Clinical interpretation of tracing"
            className="w-full border rounded px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="fm-action" className="block text-sm font-medium text-gray-700 mb-1">Action Taken</label>
          <textarea id="fm-action" name="action_taken" value={form.action_taken}
            onChange={handleChange} rows={2} placeholder="e.g. position change, O2, IV bolus"
            className="w-full border rounded px-3 py-2 text-sm" />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={saving}
          className="bg-pink-600 text-white px-6 py-2 rounded font-medium min-h-[44px] hover:bg-pink-700 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Monitoring'}
        </button>
        <button type="button" onClick={onCancel}
          className="border border-gray-300 text-gray-700 px-6 py-2 rounded font-medium min-h-[44px] hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </form>
  );
};

export default FetalMonitoringForm;
