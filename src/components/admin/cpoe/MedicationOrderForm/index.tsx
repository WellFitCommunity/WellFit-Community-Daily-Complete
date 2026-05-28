/**
 * MedicationOrderForm — ONC 170.315(a)(1) CPOE (Computerized Provider Order
 * Entry) for medications.
 *
 * This is the architectural template for the lab (ONC-2) and imaging (ONC-3)
 * CPOE forms. Pattern: form component → FHIR service → audit log → callback.
 *
 * Safety:
 *   - MedicationRequestService.create() runs a server-side allergy check
 *     before insert. The form surfaces the alert as a blocking error.
 *   - All required FHIR fields are validated client-side before submit so
 *     the user gets clear field-level errors, not a server round-trip.
 *   - Audit logging is delegated to MedicationRequestService (HIPAA
 *     §164.312(b) via auditLogger.phi inside the service).
 */

import React, { useCallback, useMemo, useState } from 'react';
import { MedicationRequestService } from '../../../../services/fhir/MedicationRequestService';
import { auditLogger } from '../../../../services/auditLogger';
import { useOrderingProvider } from '../../../../hooks/useOrderingProvider';
import {
  DOSAGE_UNITS,
  FREQUENCY_PRESETS,
  ORDER_PRIORITIES,
  ROUTES_OF_ADMINISTRATION,
} from '../../../../constants/cpoe';
import type { CreateMedicationRequest } from '../../../../types/fhir/medications';
import {
  INITIAL_FORM_DATA,
  type MedicationOrderFormData,
  type MedicationOrderFormProps,
  type MedicationOrderSubmitError,
} from './MedicationOrderForm.types';

function buildDosageText(data: MedicationOrderFormData): string {
  const preset = FREQUENCY_PRESETS.find((p) => p.label === data.frequency_preset);
  const dose = data.dose_quantity && data.dose_unit ? `${data.dose_quantity} ${data.dose_unit}` : '';
  const route = data.route_display;
  const freq = preset?.label || '';
  return [dose, route, freq].filter(Boolean).join(' • ');
}

function validate(data: MedicationOrderFormData): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!data.medication_display.trim()) {
    errors.medication_display = 'Medication is required.';
  }
  if (!data.dose_quantity.trim()) {
    errors.dose_quantity = 'Dose is required.';
  } else if (Number.isNaN(Number(data.dose_quantity)) || Number(data.dose_quantity) <= 0) {
    errors.dose_quantity = 'Dose must be a positive number.';
  }
  if (!data.dose_unit) {
    errors.dose_unit = 'Dose unit is required.';
  }
  if (!data.route_code) {
    errors.route_code = 'Route of administration is required.';
  }
  if (!data.frequency_preset) {
    errors.frequency_preset = 'Frequency is required.';
  }
  if (!data.indication.trim()) {
    errors.indication = 'Clinical indication is required.';
  }
  return errors;
}

export const MedicationOrderForm: React.FC<MedicationOrderFormProps> = ({
  patientId,
  encounterId,
  onSubmitted,
  onCancel,
}) => {
  const [formData, setFormData] = useState<MedicationOrderFormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<MedicationOrderSubmitError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const provider = useOrderingProvider();

  const dosagePreview = useMemo(() => buildDosageText(formData), [formData]);

  const setField = useCallback(
    <K extends keyof MedicationOrderFormData>(field: K, value: MedicationOrderFormData[K]) => {
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

  const handleRouteChange = useCallback(
    (code: string) => {
      const route = ROUTES_OF_ADMINISTRATION.find((r) => r.code === code);
      setFormData((prev) => ({
        ...prev,
        route_code: code,
        route_display: route?.display ?? '',
      }));
      setErrors((prev) => {
        if (!prev.route_code) return prev;
        const next = { ...prev };
        delete next.route_code;
        return next;
      });
    },
    []
  );

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
          isAllergyAlert: false,
        });
        return;
      }

      const preset = FREQUENCY_PRESETS.find((p) => p.label === formData.frequency_preset);
      const request: CreateMedicationRequest = {
        patient_id: patientId,
        status: 'active',
        intent: 'order',
        medication_code: formData.medication_code || formData.medication_display,
        medication_code_system: formData.medication_code_system,
        medication_display: formData.medication_display.trim(),
        dosage_text: dosagePreview,
        dosage_dose_quantity: Number(formData.dose_quantity),
        dosage_dose_unit: formData.dose_unit,
        dosage_route_code: formData.route_code,
        dosage_route_display: formData.route_display,
        dosage_route: formData.route_display,
        dosage_timing_frequency: preset?.frequency,
        dosage_timing_period: preset?.period,
        dosage_timing_period_unit: preset?.periodUnit,
        dosage_patient_instruction: formData.patient_instruction.trim() || undefined,
        reason_code: [formData.indication.trim()],
        priority: formData.priority,
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
        const result = await MedicationRequestService.create(request);
        if (!result.success || !result.data) {
          const message = result.error || 'Could not create the medication order.';
          setSubmitError({
            message,
            isAllergyAlert: message.toUpperCase().startsWith('ALLERGY ALERT'),
          });
          return;
        }
        onSubmitted?.(result.data.id ?? '');
      } catch (err: unknown) {
        await auditLogger.error(
          'MEDICATION_ORDER_FORM_SUBMIT_FAILED',
          err instanceof Error ? err : new Error(String(err)),
          { patientId, medication: formData.medication_display }
        );
        setSubmitError({
          message: 'An unexpected error occurred. Please try again.',
          isAllergyAlert: false,
        });
      } finally {
        setSubmitting(false);
      }
    },
    [formData, patientId, encounterId, dosagePreview, onSubmitted, provider]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6" aria-label="Medication order">
      <h2 className="text-xl font-semibold">New Medication Order</h2>

      {/* Medication */}
      <div>
        <label htmlFor="cpoe-med-name" className="block text-lg font-medium text-gray-700 mb-2">
          Medication
        </label>
        <input
          id="cpoe-med-name"
          type="text"
          value={formData.medication_display}
          onChange={(e) => setField('medication_display', e.target.value)}
          placeholder="e.g., Lisinopril 10 mg tablet"
          className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          aria-invalid={!!errors.medication_display}
          aria-describedby={errors.medication_display ? 'cpoe-med-name-error' : undefined}
        />
        {errors.medication_display && (
          <p id="cpoe-med-name-error" className="text-red-700 text-sm mt-1">
            {errors.medication_display}
          </p>
        )}
        <details className="mt-2">
          <summary className="text-sm text-gray-600 cursor-pointer">RxNorm code (optional)</summary>
          <input
            id="cpoe-med-code"
            type="text"
            value={formData.medication_code}
            onChange={(e) => setField('medication_code', e.target.value)}
            placeholder="e.g., 314076"
            className="mt-2 w-full p-2 text-base border border-gray-300 rounded-lg"
          />
        </details>
      </div>

      {/* Dose */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="cpoe-dose-qty" className="block text-lg font-medium text-gray-700 mb-2">
            Dose
          </label>
          <input
            id="cpoe-dose-qty"
            type="number"
            min="0"
            step="any"
            value={formData.dose_quantity}
            onChange={(e) => setField('dose_quantity', e.target.value)}
            className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            aria-invalid={!!errors.dose_quantity}
            aria-describedby={errors.dose_quantity ? 'cpoe-dose-qty-error' : undefined}
          />
          {errors.dose_quantity && (
            <p id="cpoe-dose-qty-error" className="text-red-700 text-sm mt-1">
              {errors.dose_quantity}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="cpoe-dose-unit" className="block text-lg font-medium text-gray-700 mb-2">
            Unit
          </label>
          <select
            id="cpoe-dose-unit"
            value={formData.dose_unit}
            onChange={(e) => setField('dose_unit', e.target.value)}
            className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            aria-invalid={!!errors.dose_unit}
            aria-describedby={errors.dose_unit ? 'cpoe-dose-unit-error' : undefined}
          >
            <option value="">Please select</option>
            {DOSAGE_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          {errors.dose_unit && (
            <p id="cpoe-dose-unit-error" className="text-red-700 text-sm mt-1">
              {errors.dose_unit}
            </p>
          )}
        </div>
      </div>

      {/* Route */}
      <div>
        <label htmlFor="cpoe-route" className="block text-lg font-medium text-gray-700 mb-2">
          Route of administration
        </label>
        <select
          id="cpoe-route"
          value={formData.route_code}
          onChange={(e) => handleRouteChange(e.target.value)}
          className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          aria-invalid={!!errors.route_code}
          aria-describedby={errors.route_code ? 'cpoe-route-error' : undefined}
        >
          <option value="">Please select</option>
          {ROUTES_OF_ADMINISTRATION.map((r) => (
            <option key={r.code} value={r.code}>
              {r.label}
            </option>
          ))}
        </select>
        {errors.route_code && (
          <p id="cpoe-route-error" className="text-red-700 text-sm mt-1">
            {errors.route_code}
          </p>
        )}
      </div>

      {/* Frequency */}
      <div>
        <label htmlFor="cpoe-frequency" className="block text-lg font-medium text-gray-700 mb-2">
          Frequency
        </label>
        <select
          id="cpoe-frequency"
          value={formData.frequency_preset}
          onChange={(e) => setField('frequency_preset', e.target.value)}
          className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          aria-invalid={!!errors.frequency_preset}
          aria-describedby={errors.frequency_preset ? 'cpoe-frequency-error' : undefined}
        >
          <option value="">Please select</option>
          {FREQUENCY_PRESETS.map((f) => (
            <option key={f.label} value={f.label}>
              {f.label}
            </option>
          ))}
        </select>
        {errors.frequency_preset && (
          <p id="cpoe-frequency-error" className="text-red-700 text-sm mt-1">
            {errors.frequency_preset}
          </p>
        )}
      </div>

      {/* Patient instructions */}
      <div>
        <label
          htmlFor="cpoe-patient-instruction"
          className="block text-lg font-medium text-gray-700 mb-2"
        >
          Patient instructions (sig)
        </label>
        <input
          id="cpoe-patient-instruction"
          type="text"
          value={formData.patient_instruction}
          onChange={(e) => setField('patient_instruction', e.target.value)}
          placeholder="e.g., Take with food"
          className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* Indication */}
      <div>
        <label htmlFor="cpoe-indication" className="block text-lg font-medium text-gray-700 mb-2">
          Clinical indication
        </label>
        <input
          id="cpoe-indication"
          type="text"
          value={formData.indication}
          onChange={(e) => setField('indication', e.target.value)}
          placeholder="e.g., Hypertension (ICD-10: I10)"
          className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          aria-invalid={!!errors.indication}
          aria-describedby={errors.indication ? 'cpoe-indication-error' : undefined}
        />
        {errors.indication && (
          <p id="cpoe-indication-error" className="text-red-700 text-sm mt-1">
            {errors.indication}
          </p>
        )}
      </div>

      {/* Priority */}
      <fieldset className="border border-gray-200 rounded-lg p-4">
        <legend className="text-lg font-medium text-gray-700 px-2">Priority</legend>
        <div className="space-y-2 mt-2">
          {ORDER_PRIORITIES.map((p) => {
            const id = `cpoe-priority-${p.value}`;
            return (
              <div key={p.value} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <input
                  type="radio"
                  id={id}
                  name="cpoe-priority"
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

      {/* Notes */}
      <div>
        <label htmlFor="cpoe-note" className="block text-lg font-medium text-gray-700 mb-2">
          Clinical notes (provider-only)
        </label>
        <textarea
          id="cpoe-note"
          value={formData.note}
          onChange={(e) => setField('note', e.target.value)}
          rows={3}
          className="w-full p-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* Provider identity error — non-blocking warning */}
      {!provider.loading && provider.error && !submitError && (
        <div role="status" className="p-4 rounded-lg border bg-yellow-50 border-yellow-300 text-yellow-900">
          <p className="font-medium">Ordering provider not loaded</p>
          <p className="text-sm mt-1">{provider.error}</p>
        </div>
      )}

      {/* Submit error */}
      {submitError && (
        <div
          role="alert"
          className={`p-4 rounded-lg border ${
            submitError.isAllergyAlert
              ? 'bg-red-50 border-red-300 text-red-900'
              : 'bg-yellow-50 border-yellow-300 text-yellow-900'
          }`}
        >
          <p className="font-medium">{submitError.message}</p>
          {submitError.isAllergyAlert && (
            <p className="text-sm mt-1">This order was blocked. Review the allergy and choose an alternative agent.</p>
          )}
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

export default MedicationOrderForm;
