/**
 * LabOrderForm — ONC 170.315(a)(2) CPOE for laboratory orders.
 *
 * Sister form to MedicationOrderForm (ONC-1). Both follow the same
 * architecture: form → FHIR service → audit log → callback. The lab form
 * persists a FHIR ServiceRequest with category=['laboratory']; imaging
 * (ONC-3) will use the SAME ServiceRequest table with category=['imaging'].
 */

import React, { useCallback, useState } from 'react';
import { ServiceRequestService } from '../../../../services/fhir/ServiceRequestService';
import { auditLogger } from '../../../../services/auditLogger';
import { useOrderingProvider } from '../../../../hooks/useOrderingProvider';
import {
  ORDER_PRIORITIES,
  SPECIMEN_TYPES,
} from '../../../../constants/cpoe';
import type { CreateServiceRequest } from '../../../../types/fhir';
import {
  INITIAL_LAB_FORM_DATA,
  type LabOrderFormData,
  type LabOrderFormProps,
  type LabOrderSubmitError,
} from './LabOrderForm.types';

function validate(data: LabOrderFormData): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!data.test_display.trim()) {
    errors.test_display = 'Test or panel name is required.';
  }
  if (!data.specimen_code) {
    errors.specimen_code = 'Specimen type is required.';
  }
  if (!data.indication.trim()) {
    errors.indication = 'Clinical indication is required.';
  }
  return errors;
}

export const LabOrderForm: React.FC<LabOrderFormProps> = ({
  patientId,
  encounterId,
  onSubmitted,
  onCancel,
}) => {
  const [formData, setFormData] = useState<LabOrderFormData>(INITIAL_LAB_FORM_DATA);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<LabOrderSubmitError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const provider = useOrderingProvider();

  const setField = useCallback(
    <K extends keyof LabOrderFormData>(field: K, value: LabOrderFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => {
        if (!prev[field]) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
      setSubmitError(null);
    },
    []
  );

  const handleSpecimenChange = useCallback((code: string) => {
    const specimen = SPECIMEN_TYPES.find((s) => s.code === code);
    setFormData((prev) => ({
      ...prev,
      specimen_code: code,
      specimen_display: specimen?.label ?? '',
    }));
    setErrors((prev) => {
      if (!prev.specimen_code) return prev;
      const next = { ...prev };
      delete next.specimen_code;
      return next;
    });
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitError(null);

      const validationErrors = validate(formData);
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }

      if (!provider.tenant_id || !provider.user_id) {
        setSubmitError({
          message:
            provider.error ??
            'Cannot place order — ordering-provider identity is not loaded yet. Try again in a moment.',
        });
        return;
      }

      const request: CreateServiceRequest = {
        patient_id: patientId,
        status: 'active',
        intent: 'order',
        category: ['laboratory'],
        code: formData.test_code || formData.test_display,
        code_system: formData.test_code_system,
        code_display: formData.test_display.trim(),
        priority: formData.priority,
        specimen_type: formData.specimen_display || undefined,
        fasting_required: formData.fasting_required,
        reason_code: [formData.indication.trim()],
        patient_instruction: formData.patient_instruction.trim() || undefined,
        note: formData.note.trim() || undefined,
        authored_on: new Date().toISOString(),
        encounter_id: encounterId,
        tenant_id: provider.tenant_id,
        requester_id: provider.user_id,
        requester_display: provider.display_name ?? undefined,
        requester_practitioner_id: provider.practitioner_id ?? undefined,
      };

      setSubmitting(true);
      try {
        const result = await ServiceRequestService.create(request);
        if (!result.success || !result.data) {
          setSubmitError({
            message: result.error || 'Could not create the lab order.',
          });
          return;
        }
        onSubmitted?.(result.data.id ?? '');
      } catch (err: unknown) {
        await auditLogger.error(
          'LAB_ORDER_FORM_SUBMIT_FAILED',
          err instanceof Error ? err : new Error(String(err)),
          { patientId, test: formData.test_display }
        );
        setSubmitError({
          message: 'An unexpected error occurred. Please try again.',
        });
      } finally {
        setSubmitting(false);
      }
    },
    [formData, patientId, encounterId, onSubmitted, provider]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6" aria-label="Lab order">
      <h2 className="text-xl font-semibold">New Lab Order</h2>

      {/* Test / panel */}
      <div>
        <label htmlFor="cpoe-lab-test" className="block text-lg font-medium text-gray-700 mb-2">
          Test or panel
        </label>
        <input
          id="cpoe-lab-test"
          type="text"
          value={formData.test_display}
          onChange={(e) => setField('test_display', e.target.value)}
          placeholder="e.g., Comprehensive Metabolic Panel"
          className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          aria-invalid={!!errors.test_display}
          aria-describedby={errors.test_display ? 'cpoe-lab-test-error' : undefined}
        />
        {errors.test_display && (
          <p id="cpoe-lab-test-error" className="text-red-700 text-sm mt-1">
            {errors.test_display}
          </p>
        )}
        <details className="mt-2">
          <summary className="text-sm text-gray-600 cursor-pointer">LOINC code (optional)</summary>
          <input
            id="cpoe-lab-code"
            type="text"
            value={formData.test_code}
            onChange={(e) => setField('test_code', e.target.value)}
            placeholder="e.g., 24323-8"
            className="mt-2 w-full p-2 text-base border border-gray-300 rounded-lg"
          />
        </details>
      </div>

      {/* Specimen type */}
      <div>
        <label htmlFor="cpoe-lab-specimen" className="block text-lg font-medium text-gray-700 mb-2">
          Specimen type
        </label>
        <select
          id="cpoe-lab-specimen"
          value={formData.specimen_code}
          onChange={(e) => handleSpecimenChange(e.target.value)}
          className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          aria-invalid={!!errors.specimen_code}
          aria-describedby={errors.specimen_code ? 'cpoe-lab-specimen-error' : undefined}
        >
          <option value="">Please select</option>
          {SPECIMEN_TYPES.map((s) => (
            <option key={s.code} value={s.code}>
              {s.label}
            </option>
          ))}
        </select>
        {errors.specimen_code && (
          <p id="cpoe-lab-specimen-error" className="text-red-700 text-sm mt-1">
            {errors.specimen_code}
          </p>
        )}
      </div>

      {/* Fasting */}
      <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
        <input
          type="checkbox"
          id="cpoe-lab-fasting"
          checked={formData.fasting_required}
          onChange={(e) => setField('fasting_required', e.target.checked)}
          className="mt-1 w-5 h-5 text-green-600 border-gray-300 rounded-sm focus:ring-green-500"
        />
        <label htmlFor="cpoe-lab-fasting" className="text-base text-gray-700">
          <span className="font-medium">Fasting required</span>
          <span className="block text-sm text-gray-500">
            Check if the patient must fast (typically 8–12 hours) before collection.
          </span>
        </label>
      </div>

      {/* Indication */}
      <div>
        <label htmlFor="cpoe-lab-indication" className="block text-lg font-medium text-gray-700 mb-2">
          Clinical indication
        </label>
        <input
          id="cpoe-lab-indication"
          type="text"
          value={formData.indication}
          onChange={(e) => setField('indication', e.target.value)}
          placeholder="e.g., Type 2 diabetes monitoring (ICD-10: E11.9)"
          className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          aria-invalid={!!errors.indication}
          aria-describedby={errors.indication ? 'cpoe-lab-indication-error' : undefined}
        />
        {errors.indication && (
          <p id="cpoe-lab-indication-error" className="text-red-700 text-sm mt-1">
            {errors.indication}
          </p>
        )}
      </div>

      {/* Priority */}
      <fieldset className="border border-gray-200 rounded-lg p-4">
        <legend className="text-lg font-medium text-gray-700 px-2">Priority</legend>
        <div className="space-y-2 mt-2">
          {ORDER_PRIORITIES.map((p) => {
            const id = `cpoe-lab-priority-${p.value}`;
            return (
              <div key={p.value} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <input
                  type="radio"
                  id={id}
                  name="cpoe-lab-priority"
                  value={p.value}
                  checked={formData.priority === p.value}
                  onChange={() => setField('priority', p.value)}
                  className="mt-1 w-5 h-5 text-green-600 border-gray-300 focus:ring-green-500"
                />
                <label htmlFor={id} className="text-base text-gray-700">
                  <span className="font-medium">{p.label}</span>
                  <span className="block text-sm text-gray-500">{p.description}</span>
                </label>
              </div>
            );
          })}
        </div>
      </fieldset>

      {/* Patient instructions */}
      <div>
        <label
          htmlFor="cpoe-lab-patient-instruction"
          className="block text-lg font-medium text-gray-700 mb-2"
        >
          Patient instructions
        </label>
        <input
          id="cpoe-lab-patient-instruction"
          type="text"
          value={formData.patient_instruction}
          onChange={(e) => setField('patient_instruction', e.target.value)}
          placeholder="e.g., Report to lab at 7:00 AM, do not eat after midnight"
          className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="cpoe-lab-note" className="block text-lg font-medium text-gray-700 mb-2">
          Clinical notes (provider-only)
        </label>
        <textarea
          id="cpoe-lab-note"
          value={formData.note}
          onChange={(e) => setField('note', e.target.value)}
          rows={3}
          className="w-full p-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* Provider identity error */}
      {!provider.loading && provider.error && !submitError && (
        <div role="status" className="p-4 rounded-lg border bg-yellow-50 border-yellow-300 text-yellow-900">
          <p className="font-medium">Ordering provider not loaded</p>
          <p className="text-sm mt-1">{provider.error}</p>
        </div>
      )}

      {/* Submit error */}
      {submitError && (
        <div role="alert" className="p-4 rounded-lg border bg-yellow-50 border-yellow-300 text-yellow-900">
          <p className="font-medium">{submitError.message}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting || provider.loading || !provider.tenant_id}
          className="min-h-[44px] px-6 text-lg font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Submitting…' : provider.loading ? 'Loading…' : 'Submit Order'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="min-h-[44px] px-6 text-lg font-medium bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 focus:ring-2 focus:ring-gray-400 disabled:opacity-50"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
};

export default LabOrderForm;
