/**
 * AddDeviceForm — ONC 170.315(a)(14) capture form for an implanted device.
 *
 * One submit persists TWO FHIR resources: a Device (manufacturer, UDI, model,
 * serial, lot, dates) AND its initial active DeviceUseStatement (implant
 * date, body site, reason, recording practitioner). Per the FHIR R4 model
 * the two resources always co-exist for an implant — a Device with no
 * DeviceUseStatement isn't clinically meaningful.
 */

import React, { useCallback, useState } from 'react';
import { DeviceService } from '../../../../services/fhir/DeviceService';
import { DeviceUseStatementService } from '../../../../services/fhir/DeviceUseStatementService';
import { auditLogger } from '../../../../services/auditLogger';
import { useOrderingProvider } from '../../../../hooks/useOrderingProvider';
import {
  BODY_SITES,
  LATERALITY_OPTIONS,
  type FormLaterality,
} from '../../../../constants/cpoe';
import type {
  CreateDevice,
  CreateDeviceUseStatement,
} from '../../../../types/fhir';
import {
  INITIAL_ADD_DEVICE_FORM,
  type AddDeviceFormData,
  type AddDeviceFormProps,
  type AddDeviceSubmitError,
} from './types';

function validate(data: AddDeviceFormData): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!data.device_type_display.trim()) {
    errors.device_type_display = 'Device type is required (e.g., "Coronary stent").';
  }
  if (!data.body_site_code) {
    errors.body_site_code = 'Body site is required.';
  }
  if (!data.implant_date) {
    errors.implant_date = 'Implant date is required.';
  }
  return errors;
}

function isoOrUndefined(d: string): string | undefined {
  return d.trim() ? d : undefined;
}

function lateralityToFhir(value: FormLaterality): 'left' | 'right' | 'bilateral' | undefined {
  return value === 'na' ? undefined : value;
}

export const AddDeviceForm: React.FC<AddDeviceFormProps> = ({
  patientId,
  onSubmitted,
  onCancel,
}) => {
  const [formData, setFormData] = useState<AddDeviceFormData>(INITIAL_ADD_DEVICE_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<AddDeviceSubmitError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const provider = useOrderingProvider();

  const setField = useCallback(
    <K extends keyof AddDeviceFormData>(field: K, value: AddDeviceFormData[K]) => {
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
            'Cannot save device — ordering-provider identity is not loaded yet. Try again in a moment.',
        });
        return;
      }

      // Build the FHIR Device
      const device: CreateDevice = {
        patient_id: patientId,
        status: 'active',
        device_type_display: formData.device_type_display.trim(),
        device_type_code: formData.device_type_code.trim() || undefined,
        udi_carrier_hrf: formData.udi_carrier_hrf.trim() || undefined,
        udi_device_identifier: formData.udi_device_identifier.trim() || undefined,
        manufacturer: formData.manufacturer.trim() || undefined,
        model_number: formData.model_number.trim() || undefined,
        serial_number: formData.serial_number.trim() || undefined,
        lot_number: formData.lot_number.trim() || undefined,
        manufacture_date: isoOrUndefined(formData.manufacture_date),
        expiration_date: isoOrUndefined(formData.expiration_date),
        note: formData.note.trim() || undefined,
        fhir_id: `device-${crypto.randomUUID()}`,
        tenant_id: provider.tenant_id,
      };

      setSubmitting(true);
      try {
        const deviceResult = await DeviceService.create(device);
        if (!deviceResult.success || !deviceResult.data) {
          setSubmitError({
            message: deviceResult.error || 'Could not save the device.',
          });
          return;
        }

        const createdDevice = deviceResult.data;

        // Now the matching active DeviceUseStatement
        const statement: CreateDeviceUseStatement = {
          patient_id: patientId,
          device_id: createdDevice.id ?? '',
          status: 'active',
          recorded_on: new Date().toISOString(),
          timing_datetime: new Date(formData.implant_date).toISOString(),
          source_user_id: provider.user_id,
          source_practitioner_id: provider.practitioner_id ?? undefined,
          source_display: provider.display_name ?? undefined,
          body_site_display: formData.body_site_display,
          body_site_code: formData.body_site_code,
          body_site_system: 'http://snomed.info/sct',
          reason_code: formData.reason.trim() ? [formData.reason.trim()] : undefined,
          note:
            lateralityToFhir(formData.laterality)
              ? `Laterality: ${lateralityToFhir(formData.laterality)}`
              : undefined,
          fhir_id: `dus-${crypto.randomUUID()}`,
          tenant_id: provider.tenant_id,
        };

        const dusResult = await DeviceUseStatementService.create(statement);
        if (!dusResult.success) {
          setSubmitError({
            message:
              (dusResult.error || 'Could not record the device use statement.') +
              ' The device record was saved.',
            partial: true,
          });
          return;
        }

        onSubmitted?.(createdDevice.id ?? '');
      } catch (err: unknown) {
        await auditLogger.error(
          'ADD_DEVICE_FORM_SUBMIT_FAILED',
          err instanceof Error ? err : new Error(String(err)),
          { patientId, device: formData.device_type_display }
        );
        setSubmitError({
          message: 'An unexpected error occurred. Please try again.',
        });
      } finally {
        setSubmitting(false);
      }
    },
    [formData, patientId, onSubmitted, provider]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6" aria-label="Add device">
      <h2 className="text-xl font-semibold">Add Implanted Device</h2>

      {/* Device type */}
      <div>
        <label htmlFor="dev-type" className="block text-lg font-medium text-gray-700 mb-2">
          Device type
        </label>
        <input
          id="dev-type"
          type="text"
          value={formData.device_type_display}
          onChange={(e) => setField('device_type_display', e.target.value)}
          placeholder='e.g., Coronary artery stent'
          className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          aria-invalid={!!errors.device_type_display}
          aria-describedby={errors.device_type_display ? 'dev-type-error' : undefined}
        />
        {errors.device_type_display && (
          <p id="dev-type-error" className="text-red-700 text-sm mt-1">
            {errors.device_type_display}
          </p>
        )}
        <details className="mt-2">
          <summary className="text-sm text-gray-600 cursor-pointer">SNOMED CT code (optional)</summary>
          <input
            id="dev-type-code"
            type="text"
            value={formData.device_type_code}
            onChange={(e) => setField('device_type_code', e.target.value)}
            placeholder="e.g., 65818007"
            className="mt-2 w-full p-2 text-base border border-gray-300 rounded-lg"
          />
        </details>
      </div>

      {/* UDI */}
      <fieldset className="border border-gray-200 rounded-lg p-4">
        <legend className="text-lg font-medium text-gray-700 px-2">Unique Device Identifier (UDI)</legend>
        <p className="text-sm text-gray-500 mb-3">
          FDA UDI Rule — scan or enter the device's barcode. Optional but strongly
          recommended for ONC 170.315(a)(14) compliance.
        </p>
        <div className="space-y-3">
          <div>
            <label htmlFor="dev-udi-hrf" className="block text-base text-gray-700 mb-1">
              UDI (human-readable form)
            </label>
            <input
              id="dev-udi-hrf"
              type="text"
              value={formData.udi_carrier_hrf}
              onChange={(e) => setField('udi_carrier_hrf', e.target.value)}
              placeholder="(01)00643169007009(17)241231(10)A12345(21)B67890"
              className="w-full p-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label htmlFor="dev-udi-di" className="block text-base text-gray-700 mb-1">
              Device Identifier (DI) — catalog number
            </label>
            <input
              id="dev-udi-di"
              type="text"
              value={formData.udi_device_identifier}
              onChange={(e) => setField('udi_device_identifier', e.target.value)}
              placeholder="00643169007009"
              className="w-full p-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>
      </fieldset>

      {/* Manufacturer / model / serial / lot */}
      <fieldset className="border border-gray-200 rounded-lg p-4">
        <legend className="text-lg font-medium text-gray-700 px-2">Device details</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
          <div>
            <label htmlFor="dev-mfr" className="block text-base text-gray-700 mb-1">
              Manufacturer
            </label>
            <input
              id="dev-mfr"
              type="text"
              value={formData.manufacturer}
              onChange={(e) => setField('manufacturer', e.target.value)}
              className="w-full p-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label htmlFor="dev-model" className="block text-base text-gray-700 mb-1">
              Model number
            </label>
            <input
              id="dev-model"
              type="text"
              value={formData.model_number}
              onChange={(e) => setField('model_number', e.target.value)}
              className="w-full p-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label htmlFor="dev-serial" className="block text-base text-gray-700 mb-1">
              Serial number
            </label>
            <input
              id="dev-serial"
              type="text"
              value={formData.serial_number}
              onChange={(e) => setField('serial_number', e.target.value)}
              className="w-full p-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label htmlFor="dev-lot" className="block text-base text-gray-700 mb-1">
              Lot number
            </label>
            <input
              id="dev-lot"
              type="text"
              value={formData.lot_number}
              onChange={(e) => setField('lot_number', e.target.value)}
              className="w-full p-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label htmlFor="dev-mfg-date" className="block text-base text-gray-700 mb-1">
              Manufacture date
            </label>
            <input
              id="dev-mfg-date"
              type="date"
              value={formData.manufacture_date}
              onChange={(e) => setField('manufacture_date', e.target.value)}
              className="w-full p-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label htmlFor="dev-exp-date" className="block text-base text-gray-700 mb-1">
              Expiration date
            </label>
            <input
              id="dev-exp-date"
              type="date"
              value={formData.expiration_date}
              onChange={(e) => setField('expiration_date', e.target.value)}
              className="w-full p-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>
      </fieldset>

      {/* Implant context */}
      <fieldset className="border border-gray-200 rounded-lg p-4">
        <legend className="text-lg font-medium text-gray-700 px-2">Implant context</legend>
        <div className="space-y-4 mt-2">
          <div>
            <label htmlFor="dev-implant-date" className="block text-base text-gray-700 mb-1">
              Implant date
            </label>
            <input
              id="dev-implant-date"
              type="date"
              value={formData.implant_date}
              onChange={(e) => setField('implant_date', e.target.value)}
              className="w-full p-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              aria-invalid={!!errors.implant_date}
              aria-describedby={errors.implant_date ? 'dev-implant-date-error' : undefined}
            />
            {errors.implant_date && (
              <p id="dev-implant-date-error" className="text-red-700 text-sm mt-1">
                {errors.implant_date}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="dev-body-site" className="block text-base text-gray-700 mb-1">
              Body site
            </label>
            <select
              id="dev-body-site"
              value={formData.body_site_code}
              onChange={(e) => handleBodySiteChange(e.target.value)}
              className="w-full p-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              aria-invalid={!!errors.body_site_code}
              aria-describedby={errors.body_site_code ? 'dev-body-site-error' : undefined}
            >
              <option value="">Please select</option>
              {BODY_SITES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.label}
                </option>
              ))}
            </select>
            {errors.body_site_code && (
              <p id="dev-body-site-error" className="text-red-700 text-sm mt-1">
                {errors.body_site_code}
              </p>
            )}
          </div>

          <fieldset className="border border-gray-200 rounded-lg p-3">
            <legend className="text-base text-gray-700 px-2">Laterality</legend>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
              {LATERALITY_OPTIONS.map((opt) => {
                const id = `dev-laterality-${opt.value}`;
                return (
                  <div key={opt.value} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                    <input
                      type="radio"
                      id={id}
                      name="dev-laterality"
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

          <div>
            <label htmlFor="dev-reason" className="block text-base text-gray-700 mb-1">
              Indication for implant
            </label>
            <input
              id="dev-reason"
              type="text"
              value={formData.reason}
              onChange={(e) => setField('reason', e.target.value)}
              placeholder="e.g., Coronary artery disease (ICD-10: I25.10)"
              className="w-full p-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>
      </fieldset>

      {/* Notes */}
      <div>
        <label htmlFor="dev-note" className="block text-lg font-medium text-gray-700 mb-2">
          Clinical notes (provider-only)
        </label>
        <textarea
          id="dev-note"
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
        <div role="alert" className={`p-4 rounded-lg border ${submitError.partial ? 'bg-orange-50 border-orange-300 text-orange-900' : 'bg-yellow-50 border-yellow-300 text-yellow-900'}`}>
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
          {submitting ? 'Saving…' : provider.loading ? 'Loading…' : 'Save Device'}
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

export default AddDeviceForm;
