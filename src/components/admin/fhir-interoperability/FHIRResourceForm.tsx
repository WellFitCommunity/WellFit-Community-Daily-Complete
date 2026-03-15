/**
 * FHIRResourceForm — Create/Edit FHIR resources with pre-save validation
 *
 * Purpose: Form for creating and editing FHIR resources (Conditions, Medications, Observations)
 * Used by: ResourcesTab in FHIRInteroperabilityDashboard
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Save, X, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import type { FHIRResourceType, ValidationResult } from '../../../services/mcp/mcpFHIRClient';
import { auditLogger } from '../../../services/auditLogger';

interface ResourceFieldDef {
  key: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'number';
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
}

const RESOURCE_FIELDS: Record<string, ResourceFieldDef[]> = {
  Condition: [
    { key: 'patient_id', label: 'Patient ID', type: 'text', required: true, placeholder: 'UUID of the patient' },
    { key: 'code', label: 'ICD-10 Code', type: 'text', required: true, placeholder: 'e.g. E11.9' },
    { key: 'code_display', label: 'Display Name', type: 'text', required: true, placeholder: 'e.g. Type 2 diabetes mellitus' },
    { key: 'code_system', label: 'Code System', type: 'text', required: true, placeholder: 'http://hl7.org/fhir/sid/icd-10-cm' },
    {
      key: 'clinical_status', label: 'Clinical Status', type: 'select', required: true,
      options: [
        { value: 'active', label: 'Active' },
        { value: 'recurrence', label: 'Recurrence' },
        { value: 'relapse', label: 'Relapse' },
        { value: 'inactive', label: 'Inactive' },
        { value: 'remission', label: 'Remission' },
        { value: 'resolved', label: 'Resolved' },
      ],
    },
    {
      key: 'verification_status', label: 'Verification Status', type: 'select', required: true,
      options: [
        { value: 'confirmed', label: 'Confirmed' },
        { value: 'provisional', label: 'Provisional' },
        { value: 'differential', label: 'Differential' },
        { value: 'unconfirmed', label: 'Unconfirmed' },
        { value: 'refuted', label: 'Refuted' },
      ],
    },
    { key: 'onset_date', label: 'Onset Date', type: 'date' },
    { key: 'note', label: 'Clinical Note', type: 'text', placeholder: 'Optional clinical note' },
  ],
  MedicationRequest: [
    { key: 'patient_id', label: 'Patient ID', type: 'text', required: true, placeholder: 'UUID of the patient' },
    { key: 'medication_name', label: 'Medication Name', type: 'text', required: true, placeholder: 'e.g. Metformin 500mg' },
    { key: 'dosage_instructions', label: 'Dosage Instructions', type: 'text', required: true, placeholder: 'e.g. Take 1 tablet twice daily' },
    { key: 'frequency', label: 'Frequency', type: 'text', placeholder: 'e.g. BID, TID, QD' },
    { key: 'route', label: 'Route', type: 'text', placeholder: 'e.g. oral, IV, topical' },
    { key: 'requester_id', label: 'Prescriber ID', type: 'text', placeholder: 'UUID of prescribing provider' },
    { key: 'requester_display', label: 'Prescriber Name', type: 'text', placeholder: 'e.g. Dr. Test Provider Alpha' },
    {
      key: 'status', label: 'Status', type: 'select', required: true,
      options: [
        { value: 'active', label: 'Active' },
        { value: 'completed', label: 'Completed' },
        { value: 'stopped', label: 'Stopped' },
        { value: 'on-hold', label: 'On Hold' },
        { value: 'draft', label: 'Draft' },
      ],
    },
  ],
  Observation: [
    { key: 'patient_id', label: 'Patient ID', type: 'text', required: true, placeholder: 'UUID of the patient' },
    { key: 'code', label: 'LOINC Code', type: 'text', required: true, placeholder: 'e.g. 8480-6 (Systolic BP)' },
    { key: 'code_display', label: 'Display Name', type: 'text', required: true, placeholder: 'e.g. Systolic blood pressure' },
    { key: 'value', label: 'Value', type: 'number', required: true, placeholder: 'Numeric value' },
    { key: 'unit', label: 'Unit', type: 'text', required: true, placeholder: 'e.g. mmHg, mg/dL, kg' },
    {
      key: 'category', label: 'Category', type: 'select', required: true,
      options: [
        { value: 'vital-signs', label: 'Vital Signs' },
        { value: 'laboratory', label: 'Laboratory' },
        { value: 'social-history', label: 'Social History' },
        { value: 'survey', label: 'Survey' },
      ],
    },
    { key: 'effective_date', label: 'Effective Date', type: 'date' },
  ],
  AllergyIntolerance: [
    { key: 'patient_id', label: 'Patient ID', type: 'text', required: true, placeholder: 'UUID of the patient' },
    { key: 'code', label: 'Allergy Code', type: 'text', required: true, placeholder: 'e.g. RxNorm or SNOMED code' },
    { key: 'code_display', label: 'Substance Name', type: 'text', required: true, placeholder: 'e.g. Penicillin' },
    {
      key: 'clinical_status', label: 'Clinical Status', type: 'select', required: true,
      options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
        { value: 'resolved', label: 'Resolved' },
      ],
    },
    {
      key: 'type', label: 'Type', type: 'select',
      options: [
        { value: 'allergy', label: 'Allergy' },
        { value: 'intolerance', label: 'Intolerance' },
      ],
    },
    {
      key: 'criticality', label: 'Criticality', type: 'select',
      options: [
        { value: 'low', label: 'Low' },
        { value: 'high', label: 'High' },
        { value: 'unable-to-assess', label: 'Unable to Assess' },
      ],
    },
  ],
};

const SUPPORTED_RESOURCE_TYPES: FHIRResourceType[] = [
  'Condition', 'MedicationRequest', 'Observation', 'AllergyIntolerance',
];

interface FHIRResourceFormProps {
  mode: 'create' | 'edit';
  initialResourceType?: FHIRResourceType;
  initialData?: Record<string, string>;
  resourceId?: string;
  onSave: (resourceType: FHIRResourceType, data: Record<string, string>, patientId: string) => Promise<void>;
  onValidate: (resourceType: FHIRResourceType, data: Record<string, unknown>) => Promise<ValidationResult>;
  onCancel: () => void;
  saving?: boolean;
}

export const FHIRResourceForm: React.FC<FHIRResourceFormProps> = ({
  mode,
  initialResourceType,
  initialData,
  resourceId,
  onSave,
  onValidate,
  onCancel,
  saving = false,
}) => {
  const [resourceType, setResourceType] = useState<FHIRResourceType>(
    initialResourceType || 'Condition'
  );
  const [formData, setFormData] = useState<Record<string, string>>(initialData || {});
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  const fields = useMemo(() => RESOURCE_FIELDS[resourceType] || [], [resourceType]);

  const handleFieldChange = useCallback((key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setValidation(null);
    setFormErrors([]);
  }, []);

  const handleResourceTypeChange = useCallback((newType: FHIRResourceType) => {
    setResourceType(newType);
    setFormData({});
    setValidation(null);
    setFormErrors([]);
  }, []);

  const validateRequired = useCallback((): string[] => {
    const errors: string[] = [];
    for (const field of fields) {
      if (field.required && !formData[field.key]?.trim()) {
        errors.push(`${field.label} is required`);
      }
    }
    return errors;
  }, [fields, formData]);

  const handleValidate = useCallback(async () => {
    const requiredErrors = validateRequired();
    if (requiredErrors.length > 0) {
      setFormErrors(requiredErrors);
      return;
    }

    setValidating(true);
    setFormErrors([]);
    try {
      const dataToValidate: Record<string, unknown> = { ...formData };
      if (formData.value) {
        dataToValidate.value_quantity = { value: parseFloat(formData.value), unit: formData.unit };
        delete dataToValidate.value;
        delete dataToValidate.unit;
      }
      const result = await onValidate(resourceType, dataToValidate);
      setValidation(result);
    } catch (err: unknown) {
      await auditLogger.error(
        'FHIR_RESOURCE_VALIDATE_ERROR',
        err instanceof Error ? err : new Error(String(err)),
        { resourceType }
      );
      setValidation({ valid: false, errors: ['Validation service unavailable'] });
    } finally {
      setValidating(false);
    }
  }, [formData, resourceType, onValidate, validateRequired]);

  const handleSave = useCallback(async () => {
    const requiredErrors = validateRequired();
    if (requiredErrors.length > 0) {
      setFormErrors(requiredErrors);
      return;
    }

    const patientId = formData.patient_id || '';
    if (!patientId) {
      setFormErrors(['Patient ID is required']);
      return;
    }

    await onSave(resourceType, formData, patientId);
  }, [formData, resourceType, onSave, validateRequired]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">
          {mode === 'create' ? 'Create FHIR Resource' : `Edit ${resourceType} ${resourceId || ''}`}
        </h3>
        <button
          onClick={onCancel}
          className="p-2 text-gray-400 hover:text-gray-600 transition"
          aria-label="Cancel"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Resource Type Selector (create mode only) */}
      {mode === 'create' && (
        <div className="mb-6">
          <label htmlFor="resource-type-select" className="block text-sm font-medium text-gray-700 mb-2">
            Resource Type
          </label>
          <select
            id="resource-type-select"
            value={resourceType}
            onChange={(e) => handleResourceTypeChange(e.target.value as FHIRResourceType)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base focus:ring-2 focus:ring-[var(--ea-primary)] focus:border-[var(--ea-primary)]"
          >
            {SUPPORTED_RESOURCE_TYPES.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
      )}

      {/* Dynamic Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {fields.map(field => (
          <div key={field.key}>
            <label htmlFor={`field-${field.key}`} className="block text-sm font-medium text-gray-700 mb-1">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {field.type === 'select' && field.options ? (
              <select
                id={`field-${field.key}`}
                value={formData[field.key] || ''}
                onChange={(e) => handleFieldChange(field.key, e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base focus:ring-2 focus:ring-[var(--ea-primary)] focus:border-[var(--ea-primary)]"
              >
                <option value="">Select...</option>
                {field.options.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : (
              <input
                id={`field-${field.key}`}
                type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                value={formData[field.key] || ''}
                onChange={(e) => handleFieldChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base focus:ring-2 focus:ring-[var(--ea-primary)] focus:border-[var(--ea-primary)]"
              />
            )}
          </div>
        ))}
      </div>

      {/* Validation Errors */}
      {formErrors.length > 0 && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4" role="alert">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900">Required fields missing</p>
              <ul className="list-disc list-inside text-red-700 mt-1">
                {formErrors.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Validation Result */}
      {validation && (
        <div
          className={`mb-4 border rounded-lg p-4 ${
            validation.valid
              ? 'bg-green-50 border-green-200'
              : 'bg-yellow-50 border-yellow-200'
          }`}
          role="status"
        >
          <div className="flex items-start gap-2">
            {validation.valid ? (
              <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className={`font-semibold ${validation.valid ? 'text-green-900' : 'text-yellow-900'}`}>
                {validation.valid ? 'Resource is valid' : 'Validation issues found'}
              </p>
              {validation.errors.length > 0 && (
                <ul className="list-disc list-inside text-yellow-700 mt-1">
                  {validation.errors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
        <button
          onClick={handleValidate}
          disabled={validating}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition disabled:opacity-50 min-h-[44px]"
        >
          {validating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle className="w-4 h-4" />
          )}
          Validate
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--ea-primary)] text-white rounded-lg hover:bg-[var(--ea-primary-hover)] transition disabled:opacity-50 min-h-[44px]"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {mode === 'create' ? 'Create Resource' : 'Save Changes'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 hover:text-gray-900 transition min-h-[44px]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default FHIRResourceForm;
