/**
 * PregnancyRegistrationForm - Register a new pregnancy
 *
 * Purpose: Clinician data entry for initial pregnancy registration
 * Used by: LaborDeliveryDashboard Overview tab (when no active pregnancy)
 */

import React, { useState } from 'react';
import type {
  CreatePregnancyRequest,
  BloodType,
  RhFactor,
  GBSStatus,
  PregnancyRiskLevel,
} from '../../types/laborDelivery';
import { RISK_FACTOR_OPTIONS } from '../../types/laborDelivery';
import { LaborDeliveryService } from '../../services/laborDelivery';

interface PregnancyRegistrationFormProps {
  patientId: string;
  tenantId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

interface FormState {
  edd: string;
  lmp: string;
  gravida: string;
  para: string;
  ab: string;
  living: string;
  blood_type: BloodType;
  rh_factor: RhFactor;
  gbs_status: GBSStatus;
  risk_level: PregnancyRiskLevel;
  risk_factors: string[];
  notes: string;
}

const INITIAL_STATE: FormState = {
  edd: '',
  lmp: '',
  gravida: '1',
  para: '0',
  ab: '0',
  living: '0',
  blood_type: 'O+',
  rh_factor: 'positive',
  gbs_status: 'unknown',
  risk_level: 'low',
  risk_factors: [],
  notes: '',
};

const BLOOD_TYPE_OPTIONS: BloodType[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const PregnancyRegistrationForm: React.FC<PregnancyRegistrationFormProps> = ({
  patientId,
  tenantId,
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

  const handleRiskFactorToggle = (factor: string) => {
    setForm((prev) => ({
      ...prev,
      risk_factors: prev.risk_factors.includes(factor)
        ? prev.risk_factors.filter((f) => f !== factor)
        : [...prev.risk_factors, factor],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.edd) {
      setError('Estimated due date is required.');
      return;
    }

    const gravida = parseInt(form.gravida, 10);
    const para = parseInt(form.para, 10);
    if (isNaN(gravida) || isNaN(para)) {
      setError('Gravida and Para are required.');
      return;
    }

    setSaving(true);
    const request: CreatePregnancyRequest = {
      patient_id: patientId,
      tenant_id: tenantId,
      edd: form.edd,
      lmp: form.lmp || undefined,
      gravida,
      para,
      ab: form.ab ? parseInt(form.ab, 10) : undefined,
      living: form.living ? parseInt(form.living, 10) : undefined,
      blood_type: form.blood_type,
      rh_factor: form.rh_factor,
      gbs_status: form.gbs_status,
      risk_level: form.risk_level,
      risk_factors: form.risk_factors,
      notes: form.notes || undefined,
    };

    const result = await LaborDeliveryService.createPregnancy(request);
    setSaving(false);

    if (result.success) {
      onSuccess();
    } else {
      setError(result.error ?? 'Failed to register pregnancy.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-6 space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Register Pregnancy</h3>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded" role="alert">
          {error}
        </div>
      )}

      {/* Row 1: EDD + LMP */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="pr-edd" className="block text-sm font-medium text-gray-700 mb-1">
            Estimated Due Date (EDD)
          </label>
          <input id="pr-edd" type="date" name="edd" value={form.edd}
            onChange={handleChange} className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="pr-lmp" className="block text-sm font-medium text-gray-700 mb-1">
            Last Menstrual Period (LMP)
          </label>
          <input id="pr-lmp" type="date" name="lmp" value={form.lmp}
            onChange={handleChange} className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
      </div>

      {/* Row 2: GPAL */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label htmlFor="pr-gravida" className="block text-sm font-medium text-gray-700 mb-1">Gravida (G)</label>
          <input id="pr-gravida" type="number" name="gravida" value={form.gravida}
            onChange={handleChange} min="1" max="20"
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="pr-para" className="block text-sm font-medium text-gray-700 mb-1">Para (P)</label>
          <input id="pr-para" type="number" name="para" value={form.para}
            onChange={handleChange} min="0" max="20"
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="pr-ab" className="block text-sm font-medium text-gray-700 mb-1">Abortions (A)</label>
          <input id="pr-ab" type="number" name="ab" value={form.ab}
            onChange={handleChange} min="0" max="20"
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
        <div>
          <label htmlFor="pr-living" className="block text-sm font-medium text-gray-700 mb-1">Living (L)</label>
          <input id="pr-living" type="number" name="living" value={form.living}
            onChange={handleChange} min="0" max="20"
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]" />
        </div>
      </div>

      {/* Row 3: Blood Type + Rh + GBS + Risk Level */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label htmlFor="pr-blood" className="block text-sm font-medium text-gray-700 mb-1">Blood Type</label>
          <select id="pr-blood" name="blood_type" value={form.blood_type} onChange={handleChange}
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]">
            {BLOOD_TYPE_OPTIONS.map((bt) => (
              <option key={bt} value={bt}>{bt}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="pr-rh" className="block text-sm font-medium text-gray-700 mb-1">Rh Factor</label>
          <select id="pr-rh" name="rh_factor" value={form.rh_factor} onChange={handleChange}
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]">
            <option value="positive">Positive</option>
            <option value="negative">Negative</option>
          </select>
        </div>
        <div>
          <label htmlFor="pr-gbs" className="block text-sm font-medium text-gray-700 mb-1">GBS Status</label>
          <select id="pr-gbs" name="gbs_status" value={form.gbs_status} onChange={handleChange}
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]">
            <option value="unknown">Unknown</option>
            <option value="pending">Pending</option>
            <option value="negative">Negative</option>
            <option value="positive">Positive</option>
          </select>
        </div>
        <div>
          <label htmlFor="pr-risk" className="block text-sm font-medium text-gray-700 mb-1">Risk Level</label>
          <select id="pr-risk" name="risk_level" value={form.risk_level} onChange={handleChange}
            className="w-full border rounded px-3 py-2 text-sm min-h-[44px]">
            <option value="low">Low</option>
            <option value="moderate">Moderate</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      {/* Risk Factors */}
      <div>
        <span className="block text-sm font-medium text-gray-700 mb-2">Risk Factors</span>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {RISK_FACTOR_OPTIONS.map((factor) => (
            <label key={factor} className="flex items-center gap-2 text-sm min-h-[36px]">
              <input
                type="checkbox"
                checked={form.risk_factors.includes(factor)}
                onChange={() => handleRiskFactorToggle(factor)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className="text-gray-700">{factor}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="pr-notes" className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea id="pr-notes" name="notes" value={form.notes} onChange={handleChange}
          rows={2} className="w-full border rounded px-3 py-2 text-sm" />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={saving}
          className="bg-pink-600 text-white px-6 py-2 rounded font-medium min-h-[44px] hover:bg-pink-700 disabled:opacity-50">
          {saving ? 'Saving...' : 'Register Pregnancy'}
        </button>
        <button type="button" onClick={onCancel}
          className="border border-gray-300 text-gray-700 px-6 py-2 rounded font-medium min-h-[44px] hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </form>
  );
};

export default PregnancyRegistrationForm;
