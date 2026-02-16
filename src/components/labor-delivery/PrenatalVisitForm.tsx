/**
 * PrenatalVisitForm - Record a prenatal visit
 *
 * Purpose: Clinician data entry for prenatal visit vitals and exam findings
 * Used by: LaborDeliveryDashboard Prenatal Visits tab
 */

import React, { useState } from 'react';
import type { CreatePrenatalVisitRequest } from '../../types/laborDelivery';
import { LaborDeliveryService } from '../../services/laborDelivery';

interface PrenatalVisitFormProps {
  patientId: string;
  tenantId: string;
  pregnancyId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

interface FormState {
  visit_date: string;
  gestational_age_weeks: string;
  gestational_age_days: string;
  weight_kg: string;
  bp_systolic: string;
  bp_diastolic: string;
  fetal_heart_rate: string;
  fundal_height_cm: string;
  fetal_presentation: string;
  cervical_dilation_cm: string;
  cervical_effacement_percent: string;
  cervical_station: string;
  urine_protein: string;
  urine_glucose: string;
  edema: boolean;
  complaints: string;
  notes: string;
}

const INITIAL_STATE: FormState = {
  visit_date: new Date().toISOString().split('T')[0],
  gestational_age_weeks: '',
  gestational_age_days: '0',
  weight_kg: '',
  bp_systolic: '',
  bp_diastolic: '',
  fetal_heart_rate: '',
  fundal_height_cm: '',
  fetal_presentation: '',
  cervical_dilation_cm: '',
  cervical_effacement_percent: '',
  cervical_station: '',
  urine_protein: '',
  urine_glucose: '',
  edema: false,
  complaints: '',
  notes: '',
};

const PrenatalVisitForm: React.FC<PrenatalVisitFormProps> = ({
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

    const gaWeeks = parseInt(form.gestational_age_weeks, 10);
    const bpSys = parseInt(form.bp_systolic, 10);
    const bpDia = parseInt(form.bp_diastolic, 10);
    const weight = parseFloat(form.weight_kg);

    if (isNaN(gaWeeks) || isNaN(bpSys) || isNaN(bpDia) || isNaN(weight)) {
      setError('GA weeks, blood pressure, and weight are required.');
      return;
    }

    setSaving(true);
    const request: CreatePrenatalVisitRequest = {
      patient_id: patientId,
      tenant_id: tenantId,
      pregnancy_id: pregnancyId,
      visit_date: form.visit_date,
      gestational_age_weeks: gaWeeks,
      gestational_age_days: parseInt(form.gestational_age_days, 10) || 0,
      weight_kg: weight,
      bp_systolic: bpSys,
      bp_diastolic: bpDia,
      fetal_heart_rate: form.fetal_heart_rate ? parseInt(form.fetal_heart_rate, 10) : undefined,
      fundal_height_cm: form.fundal_height_cm ? parseFloat(form.fundal_height_cm) : undefined,
      cervical_dilation_cm: form.cervical_dilation_cm ? parseFloat(form.cervical_dilation_cm) : undefined,
      cervical_effacement_percent: form.cervical_effacement_percent ? parseInt(form.cervical_effacement_percent, 10) : undefined,
      complaints: form.complaints ? form.complaints.split(',').map((c) => c.trim()).filter(Boolean) : [],
      notes: form.notes || undefined,
    };

    const result = await LaborDeliveryService.createPrenatalVisit(request);
    setSaving(false);

    if (result.success) {
      onSuccess();
    } else {
      setError(result.error ?? 'Failed to save prenatal visit.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-6 space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Record Prenatal Visit</h3>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded" role="alert">
          {error}
        </div>
      )}

      {/* Row 1: Date + GA */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label htmlFor="pv-visit-date" className="block text-sm font-medium text-gray-700 mb-1">Visit Date</label>
          <input id="pv-visit-date" type="date" name="visit_date" value={form.visit_date}
            onChange={handleChange} required className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="pv-ga-weeks" className="block text-sm font-medium text-gray-700 mb-1">GA Weeks</label>
          <input id="pv-ga-weeks" type="number" name="gestational_age_weeks" value={form.gestational_age_weeks}
            onChange={handleChange} min="0" max="45" className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="pv-ga-days" className="block text-sm font-medium text-gray-700 mb-1">GA Days</label>
          <input id="pv-ga-days" type="number" name="gestational_age_days" value={form.gestational_age_days}
            onChange={handleChange} min="0" max="6" className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="pv-weight" className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
          <input id="pv-weight" type="number" name="weight_kg" value={form.weight_kg}
            onChange={handleChange} step="0.1" min="30" max="300" className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
      </div>

      {/* Row 2: Vitals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label htmlFor="pv-bp-sys" className="block text-sm font-medium text-gray-700 mb-1">BP Systolic</label>
          <input id="pv-bp-sys" type="number" name="bp_systolic" value={form.bp_systolic}
            onChange={handleChange} min="60" max="260" className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="pv-bp-dia" className="block text-sm font-medium text-gray-700 mb-1">BP Diastolic</label>
          <input id="pv-bp-dia" type="number" name="bp_diastolic" value={form.bp_diastolic}
            onChange={handleChange} min="30" max="180" className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="pv-fhr" className="block text-sm font-medium text-gray-700 mb-1">Fetal HR (bpm)</label>
          <input id="pv-fhr" type="number" name="fetal_heart_rate" value={form.fetal_heart_rate}
            onChange={handleChange} min="60" max="240" className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="pv-fundal" className="block text-sm font-medium text-gray-700 mb-1">Fundal Height (cm)</label>
          <input id="pv-fundal" type="number" name="fundal_height_cm" value={form.fundal_height_cm}
            onChange={handleChange} min="0" max="50" className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
      </div>

      {/* Row 3: Cervical Exam */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label htmlFor="pv-dilation" className="block text-sm font-medium text-gray-700 mb-1">Dilation (cm)</label>
          <input id="pv-dilation" type="number" name="cervical_dilation_cm" value={form.cervical_dilation_cm}
            onChange={handleChange} min="0" max="10" step="0.5" className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="pv-effacement" className="block text-sm font-medium text-gray-700 mb-1">Effacement (%)</label>
          <input id="pv-effacement" type="number" name="cervical_effacement_percent" value={form.cervical_effacement_percent}
            onChange={handleChange} min="0" max="100" className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="pv-urine-protein" className="block text-sm font-medium text-gray-700 mb-1">Urine Protein</label>
          <select id="pv-urine-protein" name="urine_protein" value={form.urine_protein}
            onChange={handleChange} className="w-full border rounded px-3 py-2 text-sm min-h-[44px]">
            <option value="">--</option>
            <option value="negative">Negative</option>
            <option value="trace">Trace</option>
            <option value="1+">1+</option>
            <option value="2+">2+</option>
            <option value="3+">3+</option>
            <option value="4+">4+</option>
          </select>
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 min-h-[44px]">
            <input type="checkbox" name="edema" checked={form.edema} onChange={handleChange}
              className="h-5 w-5 rounded border-gray-300" />
            <span className="text-sm font-medium text-gray-700">Edema Present</span>
          </label>
        </div>
      </div>

      {/* Complaints + Notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="pv-complaints" className="block text-sm font-medium text-gray-700 mb-1">
            Complaints (comma-separated)
          </label>
          <input id="pv-complaints" type="text" name="complaints" value={form.complaints}
            onChange={handleChange} placeholder="e.g. headache, swelling, nausea"
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="pv-notes" className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea id="pv-notes" name="notes" value={form.notes} onChange={handleChange}
            rows={2} className="w-full border rounded px-3 py-2 text-sm" />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={saving}
          className="bg-pink-600 text-white px-6 py-2 rounded font-medium min-h-[44px] hover:bg-pink-700 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Visit'}
        </button>
        <button type="button" onClick={onCancel}
          className="border border-gray-300 text-gray-700 px-6 py-2 rounded font-medium min-h-[44px] hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </form>
  );
};

export default PrenatalVisitForm;
