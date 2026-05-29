/**
 * AddFamilyHistoryForm — ONC 170.315(a)(12) capture form for one family member.
 *
 * One submit persists TWO records: a FamilyMemberHistory (relationship, sex,
 * deceased status) AND its initial condition (condition, age at onset, outcome).
 * A family-history entry exists to capture a condition, so the two co-exist —
 * mirroring the Device + DeviceUseStatement pattern (ONC-5).
 */

import React, { useCallback, useState } from 'react';
import { FamilyMemberHistoryService } from '../../../../services/fhir/FamilyMemberHistoryService';
import { FamilyMemberHistoryConditionService } from '../../../../services/fhir/FamilyMemberHistoryConditionService';
import { auditLogger } from '../../../../services/auditLogger';
import { useOrderingProvider } from '../../../../hooks/useOrderingProvider';
import {
  RELATIONSHIP_OPTIONS,
  RELATIONSHIP_SYSTEM,
  SEX_OPTIONS,
} from '../../../../constants/familyHistory';
import type {
  CreateFamilyMemberHistory,
  CreateFamilyMemberHistoryCondition,
  FamilyMemberSex,
} from '../../../../types/fhir';
import {
  INITIAL_ADD_FAMILY_HISTORY_FORM,
  type AddFamilyHistoryFormData,
  type AddFamilyHistoryFormProps,
  type AddFamilyHistorySubmitError,
} from './types';

function validate(data: AddFamilyHistoryFormData): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!data.relationship_code) {
    errors.relationship_code = 'Relationship is required.';
  }
  if (!data.condition_display.trim()) {
    errors.condition_display = 'Condition is required (e.g., "Type 2 diabetes").';
  }
  return errors;
}

export const AddFamilyHistoryForm: React.FC<AddFamilyHistoryFormProps> = ({
  patientId,
  onSubmitted,
  onCancel,
}) => {
  const [formData, setFormData] = useState<AddFamilyHistoryFormData>(
    INITIAL_ADD_FAMILY_HISTORY_FORM
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<AddFamilyHistorySubmitError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const provider = useOrderingProvider();

  const setField = useCallback(
    <K extends keyof AddFamilyHistoryFormData>(field: K, value: AddFamilyHistoryFormData[K]) => {
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

  const handleRelationshipChange = useCallback((code: string) => {
    const rel = RELATIONSHIP_OPTIONS.find((r) => r.code === code);
    setFormData((prev) => ({
      ...prev,
      relationship_code: code,
      relationship_display: rel?.label ?? '',
    }));
    setErrors((prev) => {
      if (!prev.relationship_code) return prev;
      const next = { ...prev };
      delete next.relationship_code;
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
            'Cannot save family history — ordering-provider identity is not loaded yet. Try again in a moment.',
        });
        return;
      }

      const member: CreateFamilyMemberHistory = {
        patient_id: patientId,
        status: 'completed',
        relationship_system: RELATIONSHIP_SYSTEM,
        relationship_code: formData.relationship_code,
        relationship_display: formData.relationship_display,
        name: formData.name.trim() || undefined,
        sex_code: formData.sex_code ? (formData.sex_code as FamilyMemberSex) : undefined,
        sex_display: formData.sex_code
          ? SEX_OPTIONS.find((s) => s.code === formData.sex_code)?.label
          : undefined,
        deceased_boolean: formData.deceased,
        deceased_age_string:
          formData.deceased && formData.deceased_age.trim()
            ? formData.deceased_age.trim()
            : undefined,
        note: formData.note.trim() || undefined,
        fhir_id: `fmh-${crypto.randomUUID()}`,
        tenant_id: provider.tenant_id,
      };

      setSubmitting(true);
      try {
        const memberResult = await FamilyMemberHistoryService.create(member);
        if (!memberResult.success || !memberResult.data) {
          setSubmitError({ message: memberResult.error || 'Could not save the family member.' });
          return;
        }

        const createdMember = memberResult.data;

        const condition: CreateFamilyMemberHistoryCondition = {
          patient_id: patientId,
          family_member_history_id: createdMember.id ?? '',
          condition_display: formData.condition_display.trim(),
          condition_code: formData.condition_code.trim() || undefined,
          onset_age_string: formData.onset_age.trim() || undefined,
          contributed_to_death: formData.contributed_to_death,
          fhir_id: `fmhc-${crypto.randomUUID()}`,
          tenant_id: provider.tenant_id,
        };

        const condResult = await FamilyMemberHistoryConditionService.create(condition);
        if (!condResult.success) {
          setSubmitError({
            message:
              (condResult.error || 'Could not record the condition.') +
              ' The family member record was saved.',
            partial: true,
          });
          return;
        }

        onSubmitted?.(createdMember.id ?? '');
      } catch (err: unknown) {
        await auditLogger.error(
          'ADD_FAMILY_HISTORY_FORM_SUBMIT_FAILED',
          err instanceof Error ? err : new Error(String(err)),
          { patientId, relationship: formData.relationship_display }
        );
        setSubmitError({ message: 'An unexpected error occurred. Please try again.' });
      } finally {
        setSubmitting(false);
      }
    },
    [formData, patientId, onSubmitted, provider]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6" aria-label="Add family member">
      <h2 className="text-xl font-semibold">Add Family Member History</h2>

      {/* Relationship */}
      <div>
        <label htmlFor="fmh-relationship" className="block text-lg font-medium text-gray-700 mb-2">
          Relationship to patient
        </label>
        <select
          id="fmh-relationship"
          value={formData.relationship_code}
          onChange={(e) => handleRelationshipChange(e.target.value)}
          className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          aria-invalid={!!errors.relationship_code}
          aria-describedby={errors.relationship_code ? 'fmh-relationship-error' : undefined}
        >
          <option value="">Please select</option>
          {RELATIONSHIP_OPTIONS.map((r) => (
            <option key={r.code} value={r.code}>
              {r.label}
            </option>
          ))}
        </select>
        {errors.relationship_code && (
          <p id="fmh-relationship-error" className="text-red-700 text-sm mt-1">
            {errors.relationship_code}
          </p>
        )}
      </div>

      {/* Member details */}
      <fieldset className="border border-gray-200 rounded-lg p-4">
        <legend className="text-lg font-medium text-gray-700 px-2">Family member</legend>
        <div className="space-y-4 mt-2">
          <div>
            <label htmlFor="fmh-name" className="block text-base text-gray-700 mb-1">
              Name / label (optional)
            </label>
            <input
              id="fmh-name"
              type="text"
              value={formData.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="e.g., Maternal grandmother"
              className="w-full p-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label htmlFor="fmh-sex" className="block text-base text-gray-700 mb-1">
              Sex
            </label>
            <select
              id="fmh-sex"
              value={formData.sex_code}
              onChange={(e) => setField('sex_code', e.target.value as FamilyMemberSex | '')}
              className="w-full p-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="">Not specified</option>
              {SEX_OPTIONS.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
            <input
              type="checkbox"
              id="fmh-deceased"
              checked={formData.deceased}
              onChange={(e) => setField('deceased', e.target.checked)}
              className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500"
            />
            <label htmlFor="fmh-deceased" className="text-base text-gray-700">
              Family member is deceased
            </label>
          </div>

          {formData.deceased && (
            <div>
              <label htmlFor="fmh-deceased-age" className="block text-base text-gray-700 mb-1">
                Age at death (optional)
              </label>
              <input
                id="fmh-deceased-age"
                type="text"
                value={formData.deceased_age}
                onChange={(e) => setField('deceased_age', e.target.value)}
                placeholder="e.g., 78 yr"
                className="w-full p-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>
          )}
        </div>
      </fieldset>

      {/* Condition */}
      <fieldset className="border border-gray-200 rounded-lg p-4">
        <legend className="text-lg font-medium text-gray-700 px-2">Condition</legend>
        <div className="space-y-4 mt-2">
          <div>
            <label htmlFor="fmh-condition" className="block text-base text-gray-700 mb-1">
              Condition / diagnosis
            </label>
            <input
              id="fmh-condition"
              type="text"
              value={formData.condition_display}
              onChange={(e) => setField('condition_display', e.target.value)}
              placeholder="e.g., Type 2 diabetes mellitus"
              className="w-full p-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              aria-invalid={!!errors.condition_display}
              aria-describedby={errors.condition_display ? 'fmh-condition-error' : undefined}
            />
            {errors.condition_display && (
              <p id="fmh-condition-error" className="text-red-700 text-sm mt-1">
                {errors.condition_display}
              </p>
            )}
            <details className="mt-2">
              <summary className="text-sm text-gray-600 cursor-pointer">
                ICD-10 / SNOMED code (optional)
              </summary>
              <input
                id="fmh-condition-code"
                type="text"
                value={formData.condition_code}
                onChange={(e) => setField('condition_code', e.target.value)}
                placeholder="e.g., E11.9"
                className="mt-2 w-full p-2 text-base border border-gray-300 rounded-lg"
              />
            </details>
          </div>

          <div>
            <label htmlFor="fmh-onset-age" className="block text-base text-gray-700 mb-1">
              Age at onset
            </label>
            <input
              id="fmh-onset-age"
              type="text"
              value={formData.onset_age}
              onChange={(e) => setField('onset_age', e.target.value)}
              placeholder="e.g., 50 yr"
              className="w-full p-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
            <input
              type="checkbox"
              id="fmh-contributed-death"
              checked={formData.contributed_to_death}
              onChange={(e) => setField('contributed_to_death', e.target.checked)}
              className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500"
            />
            <label htmlFor="fmh-contributed-death" className="text-base text-gray-700">
              This condition contributed to the member&apos;s death
            </label>
          </div>
        </div>
      </fieldset>

      {/* Notes */}
      <div>
        <label htmlFor="fmh-note" className="block text-lg font-medium text-gray-700 mb-2">
          Clinical notes (provider-only)
        </label>
        <textarea
          id="fmh-note"
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
        <div
          role="alert"
          className={`p-4 rounded-lg border ${submitError.partial ? 'bg-orange-50 border-orange-300 text-orange-900' : 'bg-yellow-50 border-yellow-300 text-yellow-900'}`}
        >
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
          {submitting ? 'Saving…' : provider.loading ? 'Loading…' : 'Save Family History'}
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

export default AddFamilyHistoryForm;
