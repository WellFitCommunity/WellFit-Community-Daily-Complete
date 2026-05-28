/**
 * ImagingOrderForm — ONC 170.315(a)(3) CPOE for imaging orders.
 *
 * Sister form to LabOrderForm (ONC-2). Both persist a FHIR ServiceRequest;
 * category=['imaging'] vs ['laboratory'] discriminates the order type so
 * the same table and service code path serves both. The imaging-specific
 * fields (body_site, body_site_laterality, contrast_required) already exist
 * on fhir_service_requests from the lab migration.
 */

import React, { useCallback, useState } from 'react';
import { ServiceRequestService } from '../../../../services/fhir/ServiceRequestService';
import { auditLogger } from '../../../../services/auditLogger';
import { useOrderingProvider } from '../../../../hooks/useOrderingProvider';
import {
  BODY_SITES,
  IMAGING_MODALITIES,
  LATERALITY_OPTIONS,
  ORDER_PRIORITIES,
} from '../../../../constants/cpoe';
import type {
  CreateServiceRequest,
  ServiceRequestLaterality,
} from '../../../../types/fhir';
import {
  INITIAL_IMAGING_FORM_DATA,
  type ImagingOrderFormData,
  type ImagingOrderFormProps,
  type ImagingOrderSubmitError,
} from './ImagingOrderForm.types';

function validate(data: ImagingOrderFormData): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!data.modality_code) {
    errors.modality_code = 'Modality is required.';
  }
  if (!data.study_description.trim()) {
    errors.study_description = 'Study description is required.';
  }
  if (!data.body_site_code) {
    errors.body_site_code = 'Body site is required.';
  }
  if (!data.indication.trim()) {
    errors.indication = 'Clinical indication is required.';
  }
  return errors;
}

function mapLaterality(value: ImagingOrderFormData['laterality']): ServiceRequestLaterality | undefined {
  return value === 'na' ? undefined : value;
}

export const ImagingOrderForm: React.FC<ImagingOrderFormProps> = ({
  patientId,
  encounterId,
  onSubmitted,
  onCancel,
}) => {
  const [formData, setFormData] = useState<ImagingOrderFormData>(INITIAL_IMAGING_FORM_DATA);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<ImagingOrderSubmitError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const provider = useOrderingProvider();

  const setField = useCallback(
    <K extends keyof ImagingOrderFormData>(field: K, value: ImagingOrderFormData[K]) => {
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

  const handleModalityChange = useCallback((code: string) => {
    const modality = IMAGING_MODALITIES.find((m) => m.code === code);
    setFormData((prev) => ({
      ...prev,
      modality_code: code,
      modality_display: modality?.display ?? '',
    }));
    setErrors((prev) => {
      if (!prev.modality_code) return prev;
      const next = { ...prev };
      delete next.modality_code;
      return next;
    });
  }, []);

  const handleBodySiteChange = useCallback((code: string) => {
    const site = BODY_SITES.find((s) => s.code === code);
    setFormData((prev) => ({
      ...prev,
      body_site_code: code,
      body_site_display: site?.label ?? '',
    }));
    setErrors((prev) => {
      if (!prev.body_site_code) return prev;
      const next = { ...prev };
      delete next.body_site_code;
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

      const usingCpt = formData.cpt_code.trim().length > 0;
      const codeDisplay = `${formData.modality_display}: ${formData.study_description.trim()}`;

      const request: CreateServiceRequest = {
        patient_id: patientId,
        status: 'active',
        intent: 'order',
        category: ['imaging'],
        code: usingCpt ? formData.cpt_code.trim() : formData.modality_code,
        code_system: usingCpt
          ? 'http://www.ama-assn.org/go/cpt'
          : 'http://dicom.nema.org/resources/ontology/DCM',
        code_display: codeDisplay,
        priority: formData.priority,
        body_site: formData.body_site_display || undefined,
        body_site_laterality: mapLaterality(formData.laterality),
        contrast_required: formData.contrast_required,
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
            message: result.error || 'Could not create the imaging order.',
          });
          return;
        }
        onSubmitted?.(result.data.id ?? '');
      } catch (err: unknown) {
        await auditLogger.error(
          'IMAGING_ORDER_FORM_SUBMIT_FAILED',
          err instanceof Error ? err : new Error(String(err)),
          { patientId, study: formData.study_description }
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
    <form onSubmit={handleSubmit} className="space-y-6" aria-label="Imaging order">
      <h2 className="text-xl font-semibold">New Imaging Order</h2>

      {/* Modality */}
      <div>
        <label htmlFor="cpoe-img-modality" className="block text-lg font-medium text-gray-700 mb-2">
          Modality
        </label>
        <select
          id="cpoe-img-modality"
          value={formData.modality_code}
          onChange={(e) => handleModalityChange(e.target.value)}
          className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          aria-invalid={!!errors.modality_code}
          aria-describedby={errors.modality_code ? 'cpoe-img-modality-error' : undefined}
        >
          <option value="">Please select</option>
          {IMAGING_MODALITIES.map((m) => (
            <option key={m.code} value={m.code}>
              {m.label}
            </option>
          ))}
        </select>
        {errors.modality_code && (
          <p id="cpoe-img-modality-error" className="text-red-700 text-sm mt-1">
            {errors.modality_code}
          </p>
        )}
      </div>

      {/* Study description */}
      <div>
        <label htmlFor="cpoe-img-study" className="block text-lg font-medium text-gray-700 mb-2">
          Study description
        </label>
        <input
          id="cpoe-img-study"
          type="text"
          value={formData.study_description}
          onChange={(e) => setField('study_description', e.target.value)}
          placeholder="e.g., Chest with IV contrast"
          className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          aria-invalid={!!errors.study_description}
          aria-describedby={errors.study_description ? 'cpoe-img-study-error' : undefined}
        />
        {errors.study_description && (
          <p id="cpoe-img-study-error" className="text-red-700 text-sm mt-1">
            {errors.study_description}
          </p>
        )}
        <details className="mt-2">
          <summary className="text-sm text-gray-600 cursor-pointer">CPT code (optional)</summary>
          <input
            id="cpoe-img-cpt"
            type="text"
            value={formData.cpt_code}
            onChange={(e) => setField('cpt_code', e.target.value)}
            placeholder="e.g., 71260"
            className="mt-2 w-full p-2 text-base border border-gray-300 rounded-lg"
          />
        </details>
      </div>

      {/* Body site */}
      <div>
        <label htmlFor="cpoe-img-body-site" className="block text-lg font-medium text-gray-700 mb-2">
          Body site
        </label>
        <select
          id="cpoe-img-body-site"
          value={formData.body_site_code}
          onChange={(e) => handleBodySiteChange(e.target.value)}
          className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          aria-invalid={!!errors.body_site_code}
          aria-describedby={errors.body_site_code ? 'cpoe-img-body-site-error' : undefined}
        >
          <option value="">Please select</option>
          {BODY_SITES.map((s) => (
            <option key={s.code} value={s.code}>
              {s.label}
            </option>
          ))}
        </select>
        {errors.body_site_code && (
          <p id="cpoe-img-body-site-error" className="text-red-700 text-sm mt-1">
            {errors.body_site_code}
          </p>
        )}
      </div>

      {/* Laterality */}
      <fieldset className="border border-gray-200 rounded-lg p-4">
        <legend className="text-lg font-medium text-gray-700 px-2">Laterality</legend>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
          {LATERALITY_OPTIONS.map((opt) => {
            const id = `cpoe-img-laterality-${opt.value}`;
            return (
              <div key={opt.value} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <input
                  type="radio"
                  id={id}
                  name="cpoe-img-laterality"
                  value={opt.value}
                  checked={formData.laterality === opt.value}
                  onChange={() => setField('laterality', opt.value)}
                  className="w-5 h-5 text-green-600 border-gray-300 focus:ring-green-500"
                />
                <label htmlFor={id} className="text-base text-gray-700">
                  {opt.label}
                </label>
              </div>
            );
          })}
        </div>
      </fieldset>

      {/* Contrast required */}
      <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
        <input
          type="checkbox"
          id="cpoe-img-contrast"
          checked={formData.contrast_required}
          onChange={(e) => setField('contrast_required', e.target.checked)}
          className="mt-1 w-5 h-5 text-green-600 border-gray-300 rounded-sm focus:ring-green-500"
        />
        <label htmlFor="cpoe-img-contrast" className="text-base text-gray-700">
          <span className="font-medium">Contrast required</span>
          <span className="block text-sm text-gray-500">
            Check if the study requires IV or oral contrast — radiology will confirm renal function and
            allergy clearance before administration.
          </span>
        </label>
      </div>

      {/* Indication */}
      <div>
        <label htmlFor="cpoe-img-indication" className="block text-lg font-medium text-gray-700 mb-2">
          Clinical indication
        </label>
        <input
          id="cpoe-img-indication"
          type="text"
          value={formData.indication}
          onChange={(e) => setField('indication', e.target.value)}
          placeholder="e.g., Rule out pulmonary embolism (ICD-10: I26.99)"
          className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          aria-invalid={!!errors.indication}
          aria-describedby={errors.indication ? 'cpoe-img-indication-error' : undefined}
        />
        {errors.indication && (
          <p id="cpoe-img-indication-error" className="text-red-700 text-sm mt-1">
            {errors.indication}
          </p>
        )}
      </div>

      {/* Priority */}
      <fieldset className="border border-gray-200 rounded-lg p-4">
        <legend className="text-lg font-medium text-gray-700 px-2">Priority</legend>
        <div className="space-y-2 mt-2">
          {ORDER_PRIORITIES.map((p) => {
            const id = `cpoe-img-priority-${p.value}`;
            return (
              <div key={p.value} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <input
                  type="radio"
                  id={id}
                  name="cpoe-img-priority"
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
          htmlFor="cpoe-img-patient-instruction"
          className="block text-lg font-medium text-gray-700 mb-2"
        >
          Patient instructions
        </label>
        <input
          id="cpoe-img-patient-instruction"
          type="text"
          value={formData.patient_instruction}
          onChange={(e) => setField('patient_instruction', e.target.value)}
          placeholder="e.g., NPO 4 hours prior, arrive 30 min early for contrast"
          className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="cpoe-img-note" className="block text-lg font-medium text-gray-700 mb-2">
          Clinical notes (provider-only)
        </label>
        <textarea
          id="cpoe-img-note"
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

export default ImagingOrderForm;
