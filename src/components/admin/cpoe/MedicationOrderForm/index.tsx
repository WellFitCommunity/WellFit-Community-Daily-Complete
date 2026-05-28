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
import {
  FormularyService,
  summarizeFormulary,
  type FormularyStatusSummary,
} from '../../../../services/formularyService';
import { useOrderingProvider } from '../../../../hooks/useOrderingProvider';
import { InteractionAlertModal } from '../InteractionAlertModal';
import {
  DOSAGE_UNITS,
  FREQUENCY_PRESETS,
  ORDER_PRIORITIES,
  ROUTES_OF_ADMINISTRATION,
} from '../../../../constants/cpoe';
import {
  INITIAL_FORM_DATA,
  type MedicationOrderFormData,
  type MedicationOrderFormProps,
} from './MedicationOrderForm.types';
import { useMedicationOrderSubmit } from './useMedicationOrderSubmit';

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

  // ONC 170.315(a)(10) — formulary status surface
  const [formularyStatus, setFormularyStatus] = useState<FormularyStatusSummary | null>(null);
  const [formularyChecking, setFormularyChecking] = useState(false);

  const provider = useOrderingProvider();

  const dosagePreview = useMemo(() => buildDosageText(formData), [formData]);

  // ONC 170.315(a)(1) + (a)(9) — submit pipeline (validate → CDS gate → persist)
  const {
    submitting,
    cdsChecking,
    cdsAlerts,
    submitError,
    handleSubmit,
    handleCdsAcknowledge,
    handleCdsCancel,
    resetSubmitError,
  } = useMedicationOrderSubmit({
    formData,
    patientId,
    encounterId,
    provider,
    dosagePreview,
    validate,
    onSubmitted,
    setErrors,
  });

  const setField = useCallback(
    <K extends keyof MedicationOrderFormData>(field: K, value: MedicationOrderFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => {
        if (!prev[field]) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
      resetSubmitError();
    },
    [resetSubmitError]
  );

  // ONC 170.315(a)(10) — formulary lookup on NDC blur. Reset status when NDC
  // is cleared. Lookup failures degrade gracefully (we just don't show a panel).
  const handleFormularyCheck = useCallback(async (ndc: string) => {
    const trimmed = ndc.trim();
    if (!trimmed) {
      setFormularyStatus(null);
      return;
    }
    setFormularyChecking(true);
    try {
      const result = await FormularyService.lookupByNdc(trimmed);
      if (result.success) {
        setFormularyStatus(summarizeFormulary(result.data ?? null));
      } else {
        // Surface unknown so the provider knows coverage couldn't be verified
        setFormularyStatus(summarizeFormulary(null));
      }
    } finally {
      setFormularyChecking(false);
    }
  }, []);

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
        <details className="mt-2">
          <summary className="text-sm text-gray-600 cursor-pointer">
            NDC code (enables formulary check)
          </summary>
          <label htmlFor="cpoe-med-ndc" className="sr-only">
            National Drug Code
          </label>
          <input
            id="cpoe-med-ndc"
            type="text"
            value={formData.ndc_code}
            onChange={(e) => setField('ndc_code', e.target.value)}
            onBlur={(e) => void handleFormularyCheck(e.target.value)}
            placeholder="e.g., 00071-0156-23"
            className="mt-2 w-full p-2 text-base border border-gray-300 rounded-lg"
          />
          <p className="text-xs text-gray-500 mt-1">
            ONC 170.315(a)(10) — when an NDC is provided we look up tier, copay,
            prior-auth status against the formulary cache before submit.
          </p>
        </details>
      </div>

      {/* Formulary status — ONC 170.315(a)(10) */}
      {formularyChecking && (
        <p role="status" className="text-sm text-gray-600">
          Checking formulary status…
        </p>
      )}
      {formularyStatus && !formularyChecking && (
        <div
          role="status"
          aria-label="Formulary status"
          className={`p-4 rounded-lg border ${
            formularyStatus.level === 'preferred'
              ? 'bg-green-50 border-green-300 text-green-900'
              : formularyStatus.level === 'covered'
                ? 'bg-blue-50 border-blue-300 text-blue-900'
                : formularyStatus.level === 'non_formulary'
                  ? 'bg-orange-50 border-orange-300 text-orange-900'
                  : 'bg-yellow-50 border-yellow-300 text-yellow-900'
          }`}
        >
          <p className="font-medium">Formulary: {formularyStatus.label}</p>
          <p className="text-sm mt-1">{formularyStatus.detail}</p>
          {formularyStatus.preferredAlternatives.length > 0 && (
            <p className="text-sm mt-2">
              <strong>Preferred alternatives:</strong>{' '}
              {formularyStatus.preferredAlternatives.join(', ')}
            </p>
          )}
        </div>
      )}

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
          disabled={submitting || cdsChecking || provider.loading || !provider.tenant_id}
          className="min-h-[44px] px-6 text-lg font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting
            ? 'Submitting…'
            : cdsChecking
              ? 'Checking interactions…'
              : provider.loading
                ? 'Loading…'
                : 'Submit Order'}
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

      {/* ONC 170.315(a)(9) — CDS blocking-alert modal */}
      {cdsAlerts && cdsAlerts.length > 0 && (
        <InteractionAlertModal
          interactions={cdsAlerts}
          onAcknowledge={handleCdsAcknowledge}
          onCancel={handleCdsCancel}
        />
      )}
    </form>
  );
};

export default MedicationOrderForm;
