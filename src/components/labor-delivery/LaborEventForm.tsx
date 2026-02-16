/**
 * LaborEventForm - Record a labor progression event
 *
 * Purpose: Clinician data entry for labor progression (partogram data points)
 * Used by: LaborDeliveryDashboard Labor & Delivery tab
 */

import React, { useState } from 'react';
import type { CreateLaborEventRequest, LaborStage, MembraneStatus } from '../../types/laborDelivery';
import { LaborDeliveryService } from '../../services/laborDelivery';

interface LaborEventFormProps {
  patientId: string;
  tenantId: string;
  pregnancyId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

interface FormState {
  event_time: string;
  stage: LaborStage;
  dilation_cm: string;
  effacement_percent: string;
  station: string;
  contraction_frequency: string;
  contraction_duration: string;
  contraction_intensity: '' | 'mild' | 'moderate' | 'strong';
  membrane_status: MembraneStatus;
  membrane_rupture_time: string;
  fluid_color: '' | 'clear' | 'meconium_light' | 'meconium_thick' | 'bloody';
  maternal_bp_systolic: string;
  maternal_bp_diastolic: string;
  maternal_hr: string;
  maternal_temp_c: string;
  notes: string;
}

const INITIAL_STATE: FormState = {
  event_time: new Date().toISOString().slice(0, 16),
  stage: 'latent_phase',
  dilation_cm: '',
  effacement_percent: '',
  station: '0',
  contraction_frequency: '',
  contraction_duration: '',
  contraction_intensity: '',
  membrane_status: 'intact',
  membrane_rupture_time: '',
  fluid_color: '',
  maternal_bp_systolic: '',
  maternal_bp_diastolic: '',
  maternal_hr: '',
  maternal_temp_c: '',
  notes: '',
};

const STAGE_OPTIONS: { value: LaborStage; label: string }[] = [
  { value: 'latent_phase', label: 'Latent Phase' },
  { value: 'active_phase', label: 'Active Phase' },
  { value: 'transition', label: 'Transition' },
  { value: 'second_stage', label: 'Second Stage' },
  { value: 'third_stage', label: 'Third Stage' },
  { value: 'immediate_postpartum', label: 'Immediate Postpartum' },
];

const LaborEventForm: React.FC<LaborEventFormProps> = ({
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
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const dilation = parseFloat(form.dilation_cm);
    const effacement = parseInt(form.effacement_percent, 10);
    const station = parseInt(form.station, 10);

    if (isNaN(dilation) || isNaN(effacement) || isNaN(station)) {
      setError('Dilation, effacement, and station are required.');
      return;
    }

    setSaving(true);
    const request: CreateLaborEventRequest = {
      patient_id: patientId,
      tenant_id: tenantId,
      pregnancy_id: pregnancyId,
      event_time: new Date(form.event_time).toISOString(),
      stage: form.stage,
      dilation_cm: dilation,
      effacement_percent: effacement,
      station,
      contraction_frequency_per_10min: form.contraction_frequency ? parseInt(form.contraction_frequency, 10) : undefined,
      contraction_duration_seconds: form.contraction_duration ? parseInt(form.contraction_duration, 10) : undefined,
      contraction_intensity: form.contraction_intensity || undefined,
      membrane_status: form.membrane_status,
      membrane_rupture_time: form.membrane_rupture_time ? new Date(form.membrane_rupture_time).toISOString() : undefined,
      fluid_color: form.fluid_color || undefined,
      maternal_bp_systolic: form.maternal_bp_systolic ? parseInt(form.maternal_bp_systolic, 10) : undefined,
      maternal_bp_diastolic: form.maternal_bp_diastolic ? parseInt(form.maternal_bp_diastolic, 10) : undefined,
      maternal_hr: form.maternal_hr ? parseInt(form.maternal_hr, 10) : undefined,
      maternal_temp_c: form.maternal_temp_c ? parseFloat(form.maternal_temp_c) : undefined,
      notes: form.notes || undefined,
    };

    const result = await LaborDeliveryService.createLaborEvent(request);
    setSaving(false);

    if (result.success) {
      onSuccess();
    } else {
      setError(result.error ?? 'Failed to save labor event.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-6 space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Record Labor Event</h3>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded" role="alert">
          {error}
        </div>
      )}

      {/* Row 1: Time + Stage */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label htmlFor="le-time" className="block text-sm font-medium text-gray-700 mb-1">Event Time</label>
          <input id="le-time" type="datetime-local" name="event_time" value={form.event_time}
            onChange={handleChange} required className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="le-stage" className="block text-sm font-medium text-gray-700 mb-1">Labor Stage</label>
          <select id="le-stage" name="stage" value={form.stage} onChange={handleChange}
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]">
            {STAGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="le-membrane" className="block text-sm font-medium text-gray-700 mb-1">Membranes</label>
          <select id="le-membrane" name="membrane_status" value={form.membrane_status} onChange={handleChange}
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]">
            <option value="intact">Intact</option>
            <option value="srom">SROM</option>
            <option value="arom">AROM</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>
        <div>
          <label htmlFor="le-fluid" className="block text-sm font-medium text-gray-700 mb-1">Fluid Color</label>
          <select id="le-fluid" name="fluid_color" value={form.fluid_color} onChange={handleChange}
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]">
            <option value="">--</option>
            <option value="clear">Clear</option>
            <option value="meconium_light">Meconium (Light)</option>
            <option value="meconium_thick">Meconium (Thick)</option>
            <option value="bloody">Bloody</option>
          </select>
        </div>
      </div>

      {/* Row 2: Cervical Exam */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label htmlFor="le-dilation" className="block text-sm font-medium text-gray-700 mb-1">Dilation (cm)</label>
          <input id="le-dilation" type="number" name="dilation_cm" value={form.dilation_cm}
            onChange={handleChange} min="0" max="10" step="0.5"
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="le-effacement" className="block text-sm font-medium text-gray-700 mb-1">Effacement (%)</label>
          <input id="le-effacement" type="number" name="effacement_percent" value={form.effacement_percent}
            onChange={handleChange} min="0" max="100"
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="le-station" className="block text-sm font-medium text-gray-700 mb-1">Station (-5 to +5)</label>
          <input id="le-station" type="number" name="station" value={form.station}
            onChange={handleChange} min="-5" max="5"
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
      </div>

      {/* Row 3: Contractions */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label htmlFor="le-ctx-freq" className="block text-sm font-medium text-gray-700 mb-1">Contractions / 10 min</label>
          <input id="le-ctx-freq" type="number" name="contraction_frequency" value={form.contraction_frequency}
            onChange={handleChange} min="0" max="15"
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="le-ctx-dur" className="block text-sm font-medium text-gray-700 mb-1">Duration (sec)</label>
          <input id="le-ctx-dur" type="number" name="contraction_duration" value={form.contraction_duration}
            onChange={handleChange} min="0" max="180"
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="le-ctx-int" className="block text-sm font-medium text-gray-700 mb-1">Intensity</label>
          <select id="le-ctx-int" name="contraction_intensity" value={form.contraction_intensity} onChange={handleChange}
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]">
            <option value="">--</option>
            <option value="mild">Mild</option>
            <option value="moderate">Moderate</option>
            <option value="strong">Strong</option>
          </select>
        </div>
      </div>

      {/* Row 4: Maternal Vitals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label htmlFor="le-bp-sys" className="block text-sm font-medium text-gray-700 mb-1">Maternal BP Sys</label>
          <input id="le-bp-sys" type="number" name="maternal_bp_systolic" value={form.maternal_bp_systolic}
            onChange={handleChange} min="60" max="260"
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="le-bp-dia" className="block text-sm font-medium text-gray-700 mb-1">Maternal BP Dia</label>
          <input id="le-bp-dia" type="number" name="maternal_bp_diastolic" value={form.maternal_bp_diastolic}
            onChange={handleChange} min="30" max="180"
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="le-hr" className="block text-sm font-medium text-gray-700 mb-1">Maternal HR</label>
          <input id="le-hr" type="number" name="maternal_hr" value={form.maternal_hr}
            onChange={handleChange} min="30" max="200"
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="le-temp" className="block text-sm font-medium text-gray-700 mb-1">Temp (C)</label>
          <input id="le-temp" type="number" name="maternal_temp_c" value={form.maternal_temp_c}
            onChange={handleChange} step="0.1" min="34" max="42"
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="le-notes" className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea id="le-notes" name="notes" value={form.notes} onChange={handleChange}
          rows={2} className="w-full border rounded px-3 py-2 text-sm" />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={saving}
          className="bg-pink-600 text-white px-6 py-2 rounded font-medium min-h-[44px] hover:bg-pink-700 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Event'}
        </button>
        <button type="button" onClick={onCancel}
          className="border border-gray-300 text-gray-700 px-6 py-2 rounded font-medium min-h-[44px] hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </form>
  );
};

export default LaborEventForm;
