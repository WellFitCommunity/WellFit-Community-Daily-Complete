/**
 * NewbornAssessmentForm - Record newborn assessment
 *
 * Purpose: Clinician data entry for immediate newborn evaluation
 * Used by: LaborDeliveryDashboard Newborn tab
 */

import React, { useState } from 'react';
import type {
  CreateNewbornAssessmentRequest,
  NewbornDisposition,
} from '../../types/laborDelivery';
import { LaborDeliveryService } from '../../services/laborDelivery';

interface NewbornAssessmentFormProps {
  patientId: string;
  tenantId: string;
  pregnancyId: string;
  deliveryId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

interface FormState {
  birth_datetime: string;
  sex: 'male' | 'female' | 'ambiguous';
  weight_g: string;
  length_cm: string;
  head_circumference_cm: string;
  apgar_1_min: string;
  apgar_5_min: string;
  apgar_10_min: string;
  ballard_gestational_age_weeks: string;
  temperature_c: string;
  heart_rate: string;
  respiratory_rate: string;
  disposition: NewbornDisposition;
  anomalies: string;
  vitamin_k_given: boolean;
  erythromycin_given: boolean;
  hepatitis_b_vaccine: boolean;
  notes: string;
}

const INITIAL_STATE: FormState = {
  birth_datetime: new Date().toISOString().slice(0, 16),
  sex: 'male',
  weight_g: '',
  length_cm: '',
  head_circumference_cm: '',
  apgar_1_min: '',
  apgar_5_min: '',
  apgar_10_min: '',
  ballard_gestational_age_weeks: '',
  temperature_c: '',
  heart_rate: '',
  respiratory_rate: '',
  disposition: 'rooming_in',
  anomalies: '',
  vitamin_k_given: true,
  erythromycin_given: true,
  hepatitis_b_vaccine: false,
  notes: '',
};

const DISPOSITION_OPTIONS: { value: NewbornDisposition; label: string }[] = [
  { value: 'rooming_in', label: 'Rooming In' },
  { value: 'well_newborn_nursery', label: 'Well Newborn Nursery' },
  { value: 'nicu', label: 'NICU' },
  { value: 'transferred', label: 'Transferred' },
];

const NewbornAssessmentForm: React.FC<NewbornAssessmentFormProps> = ({
  patientId,
  tenantId,
  pregnancyId,
  deliveryId,
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

    const weight = parseInt(form.weight_g, 10);
    const length = parseFloat(form.length_cm);
    const headCirc = parseFloat(form.head_circumference_cm);
    const apgar1 = parseInt(form.apgar_1_min, 10);
    const apgar5 = parseInt(form.apgar_5_min, 10);

    if (isNaN(weight) || isNaN(length) || isNaN(headCirc)) {
      setError('Weight, length, and head circumference are required.');
      return;
    }
    if (isNaN(apgar1) || isNaN(apgar5)) {
      setError('APGAR scores at 1 and 5 minutes are required.');
      return;
    }

    setSaving(true);
    const request: CreateNewbornAssessmentRequest = {
      patient_id: patientId,
      tenant_id: tenantId,
      pregnancy_id: pregnancyId,
      delivery_id: deliveryId,
      birth_datetime: new Date(form.birth_datetime).toISOString(),
      sex: form.sex,
      weight_g: weight,
      length_cm: length,
      head_circumference_cm: headCirc,
      apgar_1_min: apgar1,
      apgar_5_min: apgar5,
      apgar_10_min: form.apgar_10_min ? parseInt(form.apgar_10_min, 10) : undefined,
      ballard_gestational_age_weeks: form.ballard_gestational_age_weeks
        ? parseInt(form.ballard_gestational_age_weeks, 10)
        : undefined,
      temperature_c: form.temperature_c ? parseFloat(form.temperature_c) : undefined,
      heart_rate: form.heart_rate ? parseInt(form.heart_rate, 10) : undefined,
      respiratory_rate: form.respiratory_rate ? parseInt(form.respiratory_rate, 10) : undefined,
      disposition: form.disposition,
      anomalies: form.anomalies ? form.anomalies.split(',').map((a) => a.trim()).filter(Boolean) : undefined,
      vitamin_k_given: form.vitamin_k_given,
      erythromycin_given: form.erythromycin_given,
      hepatitis_b_vaccine: form.hepatitis_b_vaccine,
      notes: form.notes || undefined,
    };

    const result = await LaborDeliveryService.createNewbornAssessment(request);
    setSaving(false);

    if (result.success) {
      onSuccess();
    } else {
      setError(result.error ?? 'Failed to save newborn assessment.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-6 space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Newborn Assessment</h3>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded" role="alert">
          {error}
        </div>
      )}

      {/* Row 1: Birth DateTime + Sex + Disposition */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="nb-birth" className="block text-sm font-medium text-gray-700 mb-1">Birth Date/Time</label>
          <input id="nb-birth" type="datetime-local" name="birth_datetime" value={form.birth_datetime}
            onChange={handleChange} required className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="nb-sex" className="block text-sm font-medium text-gray-700 mb-1">Sex</label>
          <select id="nb-sex" name="sex" value={form.sex} onChange={handleChange}
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]">
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="ambiguous">Ambiguous</option>
          </select>
        </div>
        <div>
          <label htmlFor="nb-disposition" className="block text-sm font-medium text-gray-700 mb-1">Disposition</label>
          <select id="nb-disposition" name="disposition" value={form.disposition} onChange={handleChange}
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]">
            {DISPOSITION_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 2: Measurements */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label htmlFor="nb-weight" className="block text-sm font-medium text-gray-700 mb-1">Weight (g)</label>
          <input id="nb-weight" type="number" name="weight_g" value={form.weight_g}
            onChange={handleChange} min="300" max="7000"
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="nb-length" className="block text-sm font-medium text-gray-700 mb-1">Length (cm)</label>
          <input id="nb-length" type="number" name="length_cm" value={form.length_cm}
            onChange={handleChange} step="0.5" min="20" max="65"
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="nb-head" className="block text-sm font-medium text-gray-700 mb-1">Head Circ (cm)</label>
          <input id="nb-head" type="number" name="head_circumference_cm" value={form.head_circumference_cm}
            onChange={handleChange} step="0.5" min="20" max="50"
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="nb-ballard" className="block text-sm font-medium text-gray-700 mb-1">Ballard GA (wks)</label>
          <input id="nb-ballard" type="number" name="ballard_gestational_age_weeks" value={form.ballard_gestational_age_weeks}
            onChange={handleChange} min="22" max="44"
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
      </div>

      {/* Row 3: APGAR Scores */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label htmlFor="nb-apgar1" className="block text-sm font-medium text-gray-700 mb-1">APGAR 1 min (0-10)</label>
          <input id="nb-apgar1" type="number" name="apgar_1_min" value={form.apgar_1_min}
            onChange={handleChange} min="0" max="10"
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="nb-apgar5" className="block text-sm font-medium text-gray-700 mb-1">APGAR 5 min (0-10)</label>
          <input id="nb-apgar5" type="number" name="apgar_5_min" value={form.apgar_5_min}
            onChange={handleChange} min="0" max="10"
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="nb-apgar10" className="block text-sm font-medium text-gray-700 mb-1">APGAR 10 min (0-10)</label>
          <input id="nb-apgar10" type="number" name="apgar_10_min" value={form.apgar_10_min}
            onChange={handleChange} min="0" max="10"
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
      </div>

      {/* Row 4: Vitals */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label htmlFor="nb-temp" className="block text-sm font-medium text-gray-700 mb-1">Temp (C)</label>
          <input id="nb-temp" type="number" name="temperature_c" value={form.temperature_c}
            onChange={handleChange} step="0.1" min="34" max="42"
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="nb-hr" className="block text-sm font-medium text-gray-700 mb-1">Heart Rate</label>
          <input id="nb-hr" type="number" name="heart_rate" value={form.heart_rate}
            onChange={handleChange} min="60" max="220"
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="nb-rr" className="block text-sm font-medium text-gray-700 mb-1">Respiratory Rate</label>
          <input id="nb-rr" type="number" name="respiratory_rate" value={form.respiratory_rate}
            onChange={handleChange} min="10" max="80"
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
      </div>

      {/* Row 5: Medications Given */}
      <div className="grid grid-cols-3 gap-4">
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 min-h-[44px]">
            <input type="checkbox" name="vitamin_k_given" checked={form.vitamin_k_given}
              onChange={handleChange} className="h-5 w-5 rounded border-gray-300" />
            <span className="text-sm font-medium text-gray-700">Vitamin K Given</span>
          </label>
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 min-h-[44px]">
            <input type="checkbox" name="erythromycin_given" checked={form.erythromycin_given}
              onChange={handleChange} className="h-5 w-5 rounded border-gray-300" />
            <span className="text-sm font-medium text-gray-700">Erythromycin Given</span>
          </label>
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 min-h-[44px]">
            <input type="checkbox" name="hepatitis_b_vaccine" checked={form.hepatitis_b_vaccine}
              onChange={handleChange} className="h-5 w-5 rounded border-gray-300" />
            <span className="text-sm font-medium text-gray-700">Hep B Vaccine</span>
          </label>
        </div>
      </div>

      {/* Anomalies + Notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="nb-anomalies" className="block text-sm font-medium text-gray-700 mb-1">
            Anomalies (comma-separated)
          </label>
          <input id="nb-anomalies" type="text" name="anomalies" value={form.anomalies}
            onChange={handleChange} placeholder="e.g. cleft lip, polydactyly"
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="nb-notes" className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea id="nb-notes" name="notes" value={form.notes} onChange={handleChange}
            rows={2} className="w-full border rounded px-3 py-2 text-sm" />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={saving}
          className="bg-pink-600 text-white px-6 py-2 rounded font-medium min-h-[44px] hover:bg-pink-700 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Newborn Assessment'}
        </button>
        <button type="button" onClick={onCancel}
          className="border border-gray-300 text-gray-700 px-6 py-2 rounded font-medium min-h-[44px] hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </form>
  );
};

export default NewbornAssessmentForm;
