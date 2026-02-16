/**
 * MedicationAdminForm - Record L&D medication administration
 *
 * Purpose: Clinician data entry for labor-specific medications
 * Used by: LaborDeliveryDashboard Labor & Delivery tab
 */

import React, { useState } from 'react';
import type {
  CreateMedicationAdminRequest,
  LDMedicationIndication,
} from '../../types/laborDelivery';
import { LaborDeliveryService } from '../../services/laborDelivery';
import LDDrugInteractionAlert from './LDDrugInteractionAlert';

interface MedicationAdminFormProps {
  patientId: string;
  tenantId: string;
  pregnancyId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

type MedRoute = 'iv' | 'im' | 'po' | 'epidural' | 'spinal' | 'topical';

interface FormState {
  administered_datetime: string;
  administered_by: string;
  medication_name: string;
  dose: string;
  route: MedRoute;
  indication: LDMedicationIndication;
  notes: string;
}

const INITIAL_STATE: FormState = {
  administered_datetime: new Date().toISOString().slice(0, 16),
  administered_by: '',
  medication_name: '',
  dose: '',
  route: 'iv',
  indication: 'pain_management',
  notes: '',
};

const ROUTE_OPTIONS: { value: MedRoute; label: string }[] = [
  { value: 'iv', label: 'IV' },
  { value: 'im', label: 'IM' },
  { value: 'po', label: 'PO (Oral)' },
  { value: 'epidural', label: 'Epidural' },
  { value: 'spinal', label: 'Spinal' },
  { value: 'topical', label: 'Topical' },
];

const INDICATION_OPTIONS: { value: LDMedicationIndication; label: string }[] = [
  { value: 'labor_induction', label: 'Labor Induction' },
  { value: 'labor_augmentation', label: 'Labor Augmentation' },
  { value: 'pain_management', label: 'Pain Management' },
  { value: 'seizure_prophylaxis', label: 'Seizure Prophylaxis' },
  { value: 'hemorrhage_prevention', label: 'Hemorrhage Prevention' },
  { value: 'hemorrhage_treatment', label: 'Hemorrhage Treatment' },
  { value: 'gbs_prophylaxis', label: 'GBS Prophylaxis' },
  { value: 'rh_prophylaxis', label: 'Rh Prophylaxis' },
  { value: 'tocolysis', label: 'Tocolysis' },
  { value: 'fetal_lung_maturity', label: 'Fetal Lung Maturity' },
];

const COMMON_MEDS: string[] = [
  'Pitocin (Oxytocin)',
  'Magnesium Sulfate',
  'Fentanyl',
  'Epidural Bupivacaine',
  'Penicillin G (GBS)',
  'Misoprostol (Cytotec)',
  'Methylergonovine (Methergine)',
  'Carboprost (Hemabate)',
  'Betamethasone',
  'RhoGAM (Anti-D)',
  'Nifedipine',
  'Terbutaline',
];

const MedicationAdminForm: React.FC<MedicationAdminFormProps> = ({
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

    if (!form.medication_name.trim()) {
      setError('Medication name is required.');
      return;
    }
    if (!form.dose.trim()) {
      setError('Dose is required.');
      return;
    }

    setSaving(true);
    const request: CreateMedicationAdminRequest = {
      patient_id: patientId,
      tenant_id: tenantId,
      pregnancy_id: pregnancyId,
      administered_datetime: new Date(form.administered_datetime).toISOString(),
      administered_by: form.administered_by || undefined,
      medication_name: form.medication_name,
      dose: form.dose,
      route: form.route,
      indication: form.indication,
      notes: form.notes || undefined,
    };

    const result = await LaborDeliveryService.createMedicationAdministration(request);
    setSaving(false);

    if (result.success) {
      onSuccess();
    } else {
      setError(result.error ?? 'Failed to save medication administration.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-6 space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Medication Administration</h3>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded" role="alert">
          {error}
        </div>
      )}

      {/* Row 1: DateTime + Administered By */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="ma-time" className="block text-sm font-medium text-gray-700 mb-1">Date/Time</label>
          <input id="ma-time" type="datetime-local" name="administered_datetime" value={form.administered_datetime}
            onChange={handleChange} required className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="ma-by" className="block text-sm font-medium text-gray-700 mb-1">Administered By</label>
          <input id="ma-by" type="text" name="administered_by" value={form.administered_by}
            onChange={handleChange} placeholder="Nurse/provider name"
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
      </div>

      {/* Row 2: Medication + Dose + Route */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="ma-med" className="block text-sm font-medium text-gray-700 mb-1">Medication</label>
          <input id="ma-med" type="text" name="medication_name" value={form.medication_name}
            onChange={handleChange} list="common-ld-meds" placeholder="Medication name"
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
          <datalist id="common-ld-meds">
            {COMMON_MEDS.map((med) => (
              <option key={med} value={med} />
            ))}
          </datalist>
        </div>
        <div>
          <label htmlFor="ma-dose" className="block text-sm font-medium text-gray-700 mb-1">Dose</label>
          <input id="ma-dose" type="text" name="dose" value={form.dose}
            onChange={handleChange} placeholder="e.g. 20 units/1000mL, 4g loading"
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="ma-route" className="block text-sm font-medium text-gray-700 mb-1">Route</label>
          <select id="ma-route" name="route" value={form.route} onChange={handleChange}
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]">
            {ROUTE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Drug Interaction Check (auto-triggers when medication selected) */}
      {form.medication_name.trim().length > 2 && (
        <LDDrugInteractionAlert
          medicationName={form.medication_name}
          patientId={patientId}
        />
      )}

      {/* Row 3: Indication + Notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="ma-indication" className="block text-sm font-medium text-gray-700 mb-1">Indication</label>
          <select id="ma-indication" name="indication" value={form.indication} onChange={handleChange}
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]">
            {INDICATION_OPTIONS.map((ind) => (
              <option key={ind.value} value={ind.value}>{ind.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ma-notes" className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea id="ma-notes" name="notes" value={form.notes} onChange={handleChange}
            rows={2} placeholder="Rate changes, reactions, etc."
            className="w-full border rounded px-3 py-2 text-sm" />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={saving}
          className="bg-pink-600 text-white px-6 py-2 rounded font-medium min-h-[44px] hover:bg-pink-700 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Medication'}
        </button>
        <button type="button" onClick={onCancel}
          className="border border-gray-300 text-gray-700 px-6 py-2 rounded font-medium min-h-[44px] hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </form>
  );
};

export default MedicationAdminForm;
