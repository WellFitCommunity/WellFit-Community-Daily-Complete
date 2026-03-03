/**
 * PriorAuthCreateForm — Form for creating a new prior authorization request
 *
 * Handles patient ID, payer info, service/diagnosis codes, urgency, and clinical notes.
 * Used by: PriorAuthDashboard (in 'create' view mode)
 */

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Plus, FileText, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import type { CreateFormState } from './types';
import { PubMedEvidencePanel } from '../PubMedEvidencePanel';
import { priorAuthMCP } from '../../../services/mcp/mcpPriorAuthClient';
import type { PriorAuthRequiredCheck } from '../../../services/mcp/mcpPriorAuthClient';

interface PriorAuthCreateFormProps {
  form: CreateFormState;
  setForm: React.Dispatch<React.SetStateAction<CreateFormState>>;
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
}

export const PriorAuthCreateForm: React.FC<PriorAuthCreateFormProps> = ({
  form,
  setForm,
  onSubmit,
  submitting,
}) => {
  const updateField = (field: keyof CreateFormState, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  // PA-required auto-check when payer + service codes are both filled
  const [paRequiredCheck, setPaRequiredCheck] = useState<PriorAuthRequiredCheck | null>(null);
  const [paCheckLoading, setPaCheckLoading] = useState(false);
  const lastCheckRef = useRef('');

  useEffect(() => {
    const payerId = form.payer_id.trim();
    const serviceCodes = form.service_codes.split(',').map(c => c.trim()).filter(Boolean);
    const checkKey = `${payerId}|${serviceCodes.join(',')}`;

    if (!payerId || serviceCodes.length === 0 || checkKey === lastCheckRef.current) return;

    const timer = setTimeout(async () => {
      lastCheckRef.current = checkKey;
      setPaCheckLoading(true);
      const result = await priorAuthMCP.checkPriorAuthRequired(payerId, serviceCodes);
      if (result.success && result.data) {
        setPaRequiredCheck(result.data);
      }
      setPaCheckLoading(false);
    }, 800);

    return () => clearTimeout(timer);
  }, [form.payer_id, form.service_codes]);

  // Derive a search term from diagnosis codes for PubMed literature search
  const evidenceCondition = useMemo(() => {
    const codes = form.diagnosis_codes.trim();
    if (!codes) return '';
    // Use the raw ICD-10 codes as the search term — PubMed handles code-based queries
    return codes.split(',').map(c => c.trim()).filter(Boolean).join(' ');
  }, [form.diagnosis_codes]);

  return (
    <form onSubmit={onSubmit} className="bg-white rounded-xl border p-6 space-y-5">
      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
        <Plus className="w-5 h-5 text-indigo-600" /> New Prior Authorization Request
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="pa-patient-id" className="block text-sm font-medium text-gray-700 mb-1">Patient ID *</label>
          <input
            id="pa-patient-id"
            type="text" required value={form.patient_id}
            onChange={e => updateField('patient_id', e.target.value)}
            className="w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-base p-2.5 border"
            placeholder="Patient UUID"
          />
        </div>
        <div>
          <label htmlFor="pa-payer-id" className="block text-sm font-medium text-gray-700 mb-1">Payer ID *</label>
          <input
            id="pa-payer-id"
            type="text" required value={form.payer_id}
            onChange={e => updateField('payer_id', e.target.value)}
            className="w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-base p-2.5 border"
            placeholder="Payer identifier"
          />
        </div>
        <div>
          <label htmlFor="pa-payer-name" className="block text-sm font-medium text-gray-700 mb-1">Payer Name</label>
          <input
            id="pa-payer-name"
            type="text" value={form.payer_name}
            onChange={e => updateField('payer_name', e.target.value)}
            className="w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-base p-2.5 border"
            placeholder="e.g. Blue Cross Blue Shield"
          />
        </div>
        <div>
          <label htmlFor="pa-date-of-service" className="block text-sm font-medium text-gray-700 mb-1">Date of Service</label>
          <input
            id="pa-date-of-service"
            type="date" value={form.date_of_service}
            onChange={e => updateField('date_of_service', e.target.value)}
            className="w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-base p-2.5 border"
          />
        </div>
        <div>
          <label htmlFor="pa-service-codes" className="block text-sm font-medium text-gray-700 mb-1">Service Codes (CPT) *</label>
          <input
            id="pa-service-codes"
            type="text" required value={form.service_codes}
            onChange={e => updateField('service_codes', e.target.value)}
            className="w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-base p-2.5 border"
            placeholder="99213, 99214 (comma-separated)"
          />
        </div>
        <div>
          <label htmlFor="pa-diagnosis-codes" className="block text-sm font-medium text-gray-700 mb-1">Diagnosis Codes (ICD-10) *</label>
          <input
            id="pa-diagnosis-codes"
            type="text" required value={form.diagnosis_codes}
            onChange={e => updateField('diagnosis_codes', e.target.value)}
            className="w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-base p-2.5 border"
            placeholder="E11.9, I50.9 (comma-separated)"
          />
        </div>
        <div>
          <label htmlFor="pa-urgency" className="block text-sm font-medium text-gray-700 mb-1">Urgency</label>
          <select
            id="pa-urgency"
            value={form.urgency}
            onChange={e => updateField('urgency', e.target.value)}
            className="w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-base p-2.5 border"
          >
            <option value="routine">Routine (7 days)</option>
            <option value="urgent">Urgent (72 hours)</option>
            <option value="stat">STAT (4 hours)</option>
          </select>
        </div>
      </div>
      {/* PA Required Check Status */}
      {(paCheckLoading || paRequiredCheck) && (
        <div className={`flex items-center gap-2 p-3 rounded-lg border text-sm ${
          paCheckLoading
            ? 'bg-gray-50 border-gray-200 text-gray-600'
            : paRequiredCheck?.required
              ? 'bg-amber-50 border-amber-200 text-amber-700'
              : 'bg-green-50 border-green-200 text-green-700'
        }`}>
          {paCheckLoading ? (
            <><Loader2 className="w-4 h-4 animate-spin shrink-0" /> Checking if prior authorization is required...</>
          ) : paRequiredCheck?.required ? (
            <><AlertCircle className="w-4 h-4 shrink-0" /> Prior authorization required{paRequiredCheck.reason && `: ${paRequiredCheck.reason}`}</>
          ) : (
            <><CheckCircle className="w-4 h-4 shrink-0" /> Prior authorization may not be required for these service codes</>
          )}
        </div>
      )}
      <div>
        <label htmlFor="pa-clinical-notes" className="block text-sm font-medium text-gray-700 mb-1">Clinical Notes</label>
        <textarea
          id="pa-clinical-notes"
          value={form.clinical_notes}
          onChange={e => updateField('clinical_notes', e.target.value)}
          rows={3}
          className="w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-base p-2.5 border"
          placeholder="Clinical justification for the requested services..."
        />
      </div>
      {/* PubMed literature support — appears when diagnosis codes are entered */}
      {evidenceCondition && (
        <PubMedEvidencePanel
          condition={evidenceCondition}
          maxResults={5}
        />
      )}
      <div className="flex justify-end">
        <button
          type="submit" disabled={submitting}
          className="inline-flex items-center gap-2 px-6 py-3 text-base font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 min-h-[44px]"
        >
          {submitting ? 'Creating...' : <><FileText className="w-5 h-5" /> Create Draft</>}
        </button>
      </div>
    </form>
  );
};
