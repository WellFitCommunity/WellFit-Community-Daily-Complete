/**
 * PostpartumAssessmentForm - Record postpartum assessment
 *
 * Purpose: Clinician data entry for postpartum maternal evaluation
 * Used by: LaborDeliveryDashboard Postpartum tab
 */

import React, { useState } from 'react';
import type {
  CreatePostpartumAssessmentRequest,
  LochiaType,
  BreastfeedingStatus,
  PostpartumEmotionalStatus,
} from '../../types/laborDelivery';
import { LaborDeliveryService } from '../../services/laborDelivery';

interface PostpartumAssessmentFormProps {
  patientId: string;
  tenantId: string;
  pregnancyId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

interface FormState {
  hours_postpartum: string;
  assessed_by: string;
  fundal_height: string;
  fundal_firmness: 'firm' | 'boggy';
  lochia: LochiaType;
  lochia_amount: 'scant' | 'light' | 'moderate' | 'heavy';
  bp_systolic: string;
  bp_diastolic: string;
  heart_rate: string;
  temperature_c: string;
  breastfeeding_status: BreastfeedingStatus;
  lactation_notes: string;
  pain_score: string;
  pain_location: string;
  emotional_status: PostpartumEmotionalStatus;
  epds_score: string;
  voiding: boolean;
  bowel_movement: boolean;
  incision_intact: boolean;
  notes: string;
}

const INITIAL_STATE: FormState = {
  hours_postpartum: '',
  assessed_by: '',
  fundal_height: '',
  fundal_firmness: 'firm',
  lochia: 'rubra',
  lochia_amount: 'moderate',
  bp_systolic: '',
  bp_diastolic: '',
  heart_rate: '',
  temperature_c: '',
  breastfeeding_status: 'not_initiated',
  lactation_notes: '',
  pain_score: '',
  pain_location: '',
  emotional_status: 'stable',
  epds_score: '',
  voiding: false,
  bowel_movement: false,
  incision_intact: true,
  notes: '',
};

const LOCHIA_OPTIONS: { value: LochiaType; label: string }[] = [
  { value: 'rubra', label: 'Rubra (red)' },
  { value: 'serosa', label: 'Serosa (pink)' },
  { value: 'alba', label: 'Alba (white/yellow)' },
  { value: 'abnormal', label: 'Abnormal' },
];

const BREASTFEEDING_OPTIONS: { value: BreastfeedingStatus; label: string }[] = [
  { value: 'not_initiated', label: 'Not Initiated' },
  { value: 'exclusive_breastfeeding', label: 'Exclusive Breastfeeding' },
  { value: 'supplementing', label: 'Supplementing' },
  { value: 'formula_only', label: 'Formula Only' },
  { value: 'declined', label: 'Declined' },
];

const EMOTIONAL_OPTIONS: { value: PostpartumEmotionalStatus; label: string }[] = [
  { value: 'stable', label: 'Stable' },
  { value: 'tearful', label: 'Tearful' },
  { value: 'anxious', label: 'Anxious' },
  { value: 'depressed_screening_positive', label: 'Depressed (screening +)' },
  { value: 'bonding_concerns', label: 'Bonding Concerns' },
];

const PostpartumAssessmentForm: React.FC<PostpartumAssessmentFormProps> = ({
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

    const hoursPostpartum = parseFloat(form.hours_postpartum);
    const bpSys = parseInt(form.bp_systolic, 10);
    const bpDia = parseInt(form.bp_diastolic, 10);
    const hr = parseInt(form.heart_rate, 10);
    const temp = parseFloat(form.temperature_c);
    const painScore = parseInt(form.pain_score, 10);

    if (isNaN(hoursPostpartum)) {
      setError('Hours postpartum is required.');
      return;
    }
    if (isNaN(bpSys) || isNaN(bpDia)) {
      setError('Blood pressure is required.');
      return;
    }
    if (isNaN(hr) || isNaN(temp)) {
      setError('Heart rate and temperature are required.');
      return;
    }
    if (isNaN(painScore)) {
      setError('Pain score is required.');
      return;
    }
    if (!form.fundal_height.trim()) {
      setError('Fundal height is required.');
      return;
    }

    setSaving(true);
    const request: CreatePostpartumAssessmentRequest = {
      patient_id: patientId,
      tenant_id: tenantId,
      pregnancy_id: pregnancyId,
      hours_postpartum: hoursPostpartum,
      assessed_by: form.assessed_by || undefined,
      fundal_height: form.fundal_height,
      fundal_firmness: form.fundal_firmness,
      lochia: form.lochia,
      lochia_amount: form.lochia_amount,
      bp_systolic: bpSys,
      bp_diastolic: bpDia,
      heart_rate: hr,
      temperature_c: temp,
      breastfeeding_status: form.breastfeeding_status,
      lactation_notes: form.lactation_notes || undefined,
      pain_score: painScore,
      pain_location: form.pain_location || undefined,
      emotional_status: form.emotional_status,
      epds_score: form.epds_score ? parseInt(form.epds_score, 10) : undefined,
      voiding: form.voiding,
      bowel_movement: form.bowel_movement,
      incision_intact: form.incision_intact,
      notes: form.notes || undefined,
    };

    const result = await LaborDeliveryService.createPostpartumAssessment(request);
    setSaving(false);

    if (result.success) {
      onSuccess();
    } else {
      setError(result.error ?? 'Failed to save postpartum assessment.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-6 space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Postpartum Assessment</h3>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded" role="alert">
          {error}
        </div>
      )}

      {/* Row 1: Hours PP + Assessed By + Fundal */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label htmlFor="pp-hours" className="block text-sm font-medium text-gray-700 mb-1">Hours Postpartum</label>
          <input id="pp-hours" type="number" name="hours_postpartum" value={form.hours_postpartum}
            onChange={handleChange} step="0.5" min="0" max="168"
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="pp-assessor" className="block text-sm font-medium text-gray-700 mb-1">Assessed By</label>
          <input id="pp-assessor" type="text" name="assessed_by" value={form.assessed_by}
            onChange={handleChange} placeholder="Nurse name"
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="pp-fundal" className="block text-sm font-medium text-gray-700 mb-1">Fundal Height</label>
          <input id="pp-fundal" type="text" name="fundal_height" value={form.fundal_height}
            onChange={handleChange} placeholder="e.g. U/U, U+1, U-1"
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="pp-firmness" className="block text-sm font-medium text-gray-700 mb-1">Fundal Firmness</label>
          <select id="pp-firmness" name="fundal_firmness" value={form.fundal_firmness} onChange={handleChange}
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]">
            <option value="firm">Firm</option>
            <option value="boggy">Boggy</option>
          </select>
        </div>
      </div>

      {/* Row 2: Lochia + Vitals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label htmlFor="pp-lochia" className="block text-sm font-medium text-gray-700 mb-1">Lochia</label>
          <select id="pp-lochia" name="lochia" value={form.lochia} onChange={handleChange}
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]">
            {LOCHIA_OPTIONS.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="pp-lochia-amt" className="block text-sm font-medium text-gray-700 mb-1">Lochia Amount</label>
          <select id="pp-lochia-amt" name="lochia_amount" value={form.lochia_amount} onChange={handleChange}
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]">
            <option value="scant">Scant</option>
            <option value="light">Light</option>
            <option value="moderate">Moderate</option>
            <option value="heavy">Heavy</option>
          </select>
        </div>
        <div>
          <label htmlFor="pp-bp-sys" className="block text-sm font-medium text-gray-700 mb-1">BP Systolic</label>
          <input id="pp-bp-sys" type="number" name="bp_systolic" value={form.bp_systolic}
            onChange={handleChange} min="60" max="260"
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="pp-bp-dia" className="block text-sm font-medium text-gray-700 mb-1">BP Diastolic</label>
          <input id="pp-bp-dia" type="number" name="bp_diastolic" value={form.bp_diastolic}
            onChange={handleChange} min="30" max="180"
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
      </div>

      {/* Row 3: More Vitals + Pain */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label htmlFor="pp-hr" className="block text-sm font-medium text-gray-700 mb-1">Heart Rate</label>
          <input id="pp-hr" type="number" name="heart_rate" value={form.heart_rate}
            onChange={handleChange} min="40" max="200"
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="pp-temp" className="block text-sm font-medium text-gray-700 mb-1">Temp (C)</label>
          <input id="pp-temp" type="number" name="temperature_c" value={form.temperature_c}
            onChange={handleChange} step="0.1" min="34" max="42"
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="pp-pain" className="block text-sm font-medium text-gray-700 mb-1">Pain Score (0-10)</label>
          <input id="pp-pain" type="number" name="pain_score" value={form.pain_score}
            onChange={handleChange} min="0" max="10"
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="pp-pain-loc" className="block text-sm font-medium text-gray-700 mb-1">Pain Location</label>
          <input id="pp-pain-loc" type="text" name="pain_location" value={form.pain_location}
            onChange={handleChange} placeholder="e.g. perineum, incision"
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
      </div>

      {/* Row 4: Breastfeeding + Emotional */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="pp-bf" className="block text-sm font-medium text-gray-700 mb-1">Breastfeeding Status</label>
          <select id="pp-bf" name="breastfeeding_status" value={form.breastfeeding_status} onChange={handleChange}
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]">
            {BREASTFEEDING_OPTIONS.map((b) => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="pp-emotional" className="block text-sm font-medium text-gray-700 mb-1">Emotional Status</label>
          <select id="pp-emotional" name="emotional_status" value={form.emotional_status} onChange={handleChange}
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]">
            {EMOTIONAL_OPTIONS.map((em) => (
              <option key={em.value} value={em.value}>{em.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="pp-epds" className="block text-sm font-medium text-gray-700 mb-1">EPDS Score (0-30)</label>
          <input id="pp-epds" type="number" name="epds_score" value={form.epds_score}
            onChange={handleChange} min="0" max="30"
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
      </div>

      {/* Row 5: Checkboxes */}
      <div className="grid grid-cols-3 gap-4">
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 min-h-[44px]">
            <input type="checkbox" name="voiding" checked={form.voiding}
              onChange={handleChange} className="h-5 w-5 rounded border-gray-300" />
            <span className="text-sm font-medium text-gray-700">Voiding</span>
          </label>
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 min-h-[44px]">
            <input type="checkbox" name="bowel_movement" checked={form.bowel_movement}
              onChange={handleChange} className="h-5 w-5 rounded border-gray-300" />
            <span className="text-sm font-medium text-gray-700">Bowel Movement</span>
          </label>
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 min-h-[44px]">
            <input type="checkbox" name="incision_intact" checked={form.incision_intact}
              onChange={handleChange} className="h-5 w-5 rounded border-gray-300" />
            <span className="text-sm font-medium text-gray-700">Incision Intact</span>
          </label>
        </div>
      </div>

      {/* Lactation Notes + Notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="pp-lact-notes" className="block text-sm font-medium text-gray-700 mb-1">Lactation Notes</label>
          <textarea id="pp-lact-notes" name="lactation_notes" value={form.lactation_notes}
            onChange={handleChange} rows={2} className="w-full border rounded px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="pp-notes" className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea id="pp-notes" name="notes" value={form.notes} onChange={handleChange}
            rows={2} className="w-full border rounded px-3 py-2 text-sm" />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={saving}
          className="bg-pink-600 text-white px-6 py-2 rounded font-medium min-h-[44px] hover:bg-pink-700 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Assessment'}
        </button>
        <button type="button" onClick={onCancel}
          className="border border-gray-300 text-gray-700 px-6 py-2 rounded font-medium min-h-[44px] hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </form>
  );
};

export default PostpartumAssessmentForm;
