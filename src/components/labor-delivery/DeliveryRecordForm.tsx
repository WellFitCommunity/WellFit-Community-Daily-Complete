/**
 * DeliveryRecordForm - Record a delivery
 *
 * Purpose: Clinician data entry for delivery details
 * Used by: LaborDeliveryDashboard Labor & Delivery tab
 */

import React, { useState } from 'react';
import type {
  CreateDeliveryRecordRequest,
  DeliveryMethod,
  AnesthesiaType,
  CordClampingTime,
} from '../../types/laborDelivery';
import { LaborDeliveryService } from '../../services/laborDelivery';

interface DeliveryRecordFormProps {
  patientId: string;
  tenantId: string;
  pregnancyId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

interface FormState {
  delivery_datetime: string;
  method: DeliveryMethod;
  anesthesia: AnesthesiaType;
  labor_duration_hours: string;
  second_stage_duration_min: string;
  estimated_blood_loss_ml: string;
  episiotomy: boolean;
  laceration_degree: string;
  cord_clamping: CordClampingTime;
  cord_gases_ph: string;
  placenta_intact: boolean;
  complications: string;
  notes: string;
}

const INITIAL_STATE: FormState = {
  delivery_datetime: new Date().toISOString().slice(0, 16),
  method: 'spontaneous_vaginal',
  anesthesia: 'none',
  labor_duration_hours: '',
  second_stage_duration_min: '',
  estimated_blood_loss_ml: '',
  episiotomy: false,
  laceration_degree: '',
  cord_clamping: 'delayed_60s',
  cord_gases_ph: '',
  placenta_intact: true,
  complications: '',
  notes: '',
};

const DELIVERY_METHODS: { value: DeliveryMethod; label: string }[] = [
  { value: 'spontaneous_vaginal', label: 'Spontaneous Vaginal' },
  { value: 'assisted_vacuum', label: 'Vacuum Assisted' },
  { value: 'assisted_forceps', label: 'Forceps Assisted' },
  { value: 'cesarean_planned', label: 'Cesarean (Planned)' },
  { value: 'cesarean_emergent', label: 'Cesarean (Emergent)' },
  { value: 'vbac', label: 'VBAC' },
];

const ANESTHESIA_TYPES: { value: AnesthesiaType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'epidural', label: 'Epidural' },
  { value: 'spinal', label: 'Spinal' },
  { value: 'combined_spinal_epidural', label: 'Combined Spinal-Epidural' },
  { value: 'general', label: 'General' },
  { value: 'local', label: 'Local' },
  { value: 'pudendal', label: 'Pudendal' },
];

const DeliveryRecordForm: React.FC<DeliveryRecordFormProps> = ({
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

    const ebl = parseInt(form.estimated_blood_loss_ml, 10);
    if (isNaN(ebl)) {
      setError('Estimated blood loss is required.');
      return;
    }

    setSaving(true);
    const request: CreateDeliveryRecordRequest = {
      patient_id: patientId,
      tenant_id: tenantId,
      pregnancy_id: pregnancyId,
      delivery_datetime: new Date(form.delivery_datetime).toISOString(),
      method: form.method,
      anesthesia: form.anesthesia,
      labor_duration_hours: form.labor_duration_hours ? parseFloat(form.labor_duration_hours) : undefined,
      second_stage_duration_min: form.second_stage_duration_min ? parseInt(form.second_stage_duration_min, 10) : undefined,
      estimated_blood_loss_ml: ebl,
      episiotomy: form.episiotomy,
      laceration_degree: form.laceration_degree
        ? (parseInt(form.laceration_degree, 10) as 0 | 1 | 2 | 3 | 4)
        : undefined,
      cord_clamping: form.cord_clamping,
      cord_gases_ph: form.cord_gases_ph ? parseFloat(form.cord_gases_ph) : undefined,
      placenta_intact: form.placenta_intact,
      complications: form.complications ? form.complications.split(',').map((c) => c.trim()).filter(Boolean) : [],
      notes: form.notes || undefined,
    };

    const result = await LaborDeliveryService.createDeliveryRecord(request);
    setSaving(false);

    if (result.success) {
      onSuccess();
    } else {
      setError(result.error ?? 'Failed to save delivery record.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-6 space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Record Delivery</h3>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded" role="alert">
          {error}
        </div>
      )}

      {/* Row 1: DateTime + Method + Anesthesia */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="dr-datetime" className="block text-sm font-medium text-gray-700 mb-1">Delivery Date/Time</label>
          <input id="dr-datetime" type="datetime-local" name="delivery_datetime" value={form.delivery_datetime}
            onChange={handleChange} required className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="dr-method" className="block text-sm font-medium text-gray-700 mb-1">Delivery Method</label>
          <select id="dr-method" name="method" value={form.method} onChange={handleChange}
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]">
            {DELIVERY_METHODS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="dr-anesthesia" className="block text-sm font-medium text-gray-700 mb-1">Anesthesia</label>
          <select id="dr-anesthesia" name="anesthesia" value={form.anesthesia} onChange={handleChange}
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]">
            {ANESTHESIA_TYPES.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 2: Durations + EBL */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label htmlFor="dr-labor-hrs" className="block text-sm font-medium text-gray-700 mb-1">Labor Duration (hrs)</label>
          <input id="dr-labor-hrs" type="number" name="labor_duration_hours" value={form.labor_duration_hours}
            onChange={handleChange} step="0.5" min="0" max="72"
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="dr-2nd-stage" className="block text-sm font-medium text-gray-700 mb-1">2nd Stage (min)</label>
          <input id="dr-2nd-stage" type="number" name="second_stage_duration_min" value={form.second_stage_duration_min}
            onChange={handleChange} min="0" max="360"
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="dr-ebl" className="block text-sm font-medium text-gray-700 mb-1">Est. Blood Loss (mL)</label>
          <input id="dr-ebl" type="number" name="estimated_blood_loss_ml" value={form.estimated_blood_loss_ml}
            onChange={handleChange} min="0" max="10000"
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="dr-cord-ph" className="block text-sm font-medium text-gray-700 mb-1">Cord Gas pH</label>
          <input id="dr-cord-ph" type="number" name="cord_gases_ph" value={form.cord_gases_ph}
            onChange={handleChange} step="0.01" min="6.5" max="7.6"
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
      </div>

      {/* Row 3: Perineum + Cord + Placenta */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label htmlFor="dr-laceration" className="block text-sm font-medium text-gray-700 mb-1">Laceration Degree</label>
          <select id="dr-laceration" name="laceration_degree" value={form.laceration_degree} onChange={handleChange}
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]">
            <option value="">None</option>
            <option value="1">1st Degree</option>
            <option value="2">2nd Degree</option>
            <option value="3">3rd Degree</option>
            <option value="4">4th Degree</option>
          </select>
        </div>
        <div>
          <label htmlFor="dr-cord" className="block text-sm font-medium text-gray-700 mb-1">Cord Clamping</label>
          <select id="dr-cord" name="cord_clamping" value={form.cord_clamping} onChange={handleChange}
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]">
            <option value="immediate">Immediate</option>
            <option value="delayed_30s">Delayed 30s</option>
            <option value="delayed_60s">Delayed 60s</option>
            <option value="delayed_3min">Delayed 3min</option>
          </select>
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 min-h-[44px]">
            <input type="checkbox" name="episiotomy" checked={form.episiotomy} onChange={handleChange}
              className="h-5 w-5 rounded border-gray-300" />
            <span className="text-sm font-medium text-gray-700">Episiotomy</span>
          </label>
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 min-h-[44px]">
            <input type="checkbox" name="placenta_intact" checked={form.placenta_intact} onChange={handleChange}
              className="h-5 w-5 rounded border-gray-300" />
            <span className="text-sm font-medium text-gray-700">Placenta Intact</span>
          </label>
        </div>
      </div>

      {/* Complications + Notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="dr-complications" className="block text-sm font-medium text-gray-700 mb-1">
            Complications (comma-separated)
          </label>
          <input id="dr-complications" type="text" name="complications" value={form.complications}
            onChange={handleChange} placeholder="e.g. shoulder dystocia, cord around neck"
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="dr-notes" className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea id="dr-notes" name="notes" value={form.notes} onChange={handleChange}
            rows={2} className="w-full border rounded px-3 py-2 text-sm" />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={saving}
          className="bg-pink-600 text-white px-6 py-2 rounded font-medium min-h-[44px] hover:bg-pink-700 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Delivery Record'}
        </button>
        <button type="button" onClick={onCancel}
          className="border border-gray-300 text-gray-700 px-6 py-2 rounded font-medium min-h-[44px] hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </form>
  );
};

export default DeliveryRecordForm;
