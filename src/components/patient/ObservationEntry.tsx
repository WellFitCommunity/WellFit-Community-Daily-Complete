import React, { useState } from 'react';
import FHIRService from '../../services/fhirResourceService';
import type { CreateObservation } from '../../types/fhir';

interface ObservationEntryProps {
  userId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

// Common LOINC codes for observations
const OBSERVATION_TEMPLATES = {
  vitals: [
    { code: '8867-4', display: 'Heart rate', unit: '/min', category: 'vital-signs' },
    { code: '8480-6', display: 'Systolic blood pressure', unit: 'mmHg', category: 'vital-signs' },
    { code: '8462-4', display: 'Diastolic blood pressure', unit: 'mmHg', category: 'vital-signs' },
    { code: '2708-6', display: 'Oxygen saturation', unit: '%', category: 'vital-signs' },
    { code: '8310-5', display: 'Body temperature', unit: 'degF', category: 'vital-signs' },
    { code: '29463-7', display: 'Body weight', unit: 'lb', category: 'vital-signs' },
    { code: '8302-2', display: 'Body height', unit: 'in', category: 'vital-signs' },
    { code: '2339-0', display: 'Glucose', unit: 'mg/dL', category: 'vital-signs' },
  ],
  labs: [
    { code: '718-7', display: 'Hemoglobin', unit: 'g/dL', category: 'laboratory' },
    { code: '789-8', display: 'Erythrocytes', unit: '10*6/uL', category: 'laboratory' },
    { code: '6690-2', display: 'Leukocytes', unit: '10*3/uL', category: 'laboratory' },
    { code: '2345-7', display: 'Glucose (Lab)', unit: 'mg/dL', category: 'laboratory' },
    { code: '2160-0', display: 'Creatinine', unit: 'mg/dL', category: 'laboratory' },
    { code: '3094-0', display: 'Blood Urea Nitrogen', unit: 'mg/dL', category: 'laboratory' },
    { code: '2951-2', display: 'Sodium', unit: 'mmol/L', category: 'laboratory' },
    { code: '2823-3', display: 'Potassium', unit: 'mmol/L', category: 'laboratory' },
  ],
  social: [
    { code: '72166-2', display: 'Tobacco smoking status', unit: '', category: 'social-history' },
    { code: '11331-6', display: 'Alcohol use status', unit: '', category: 'social-history' },
    { code: '82810-3', display: 'Pregnancy status', unit: '', category: 'social-history' },
    { code: '63513-6', display: 'Housing status', unit: '', category: 'social-history' },
  ],
};

const ObservationEntry: React.FC<ObservationEntryProps> = ({ userId, onSuccess, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryTab, setCategoryTab] = useState<'vitals' | 'labs' | 'social' | 'custom'>('vitals');
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);

  const [formData, setFormData] = useState<{
    code: string;
    code_display: string;
    category: string[];
    value_quantity_value?: number;
    value_quantity_unit?: string;
    value_string?: string;
    value_codeable_concept_display?: string;
    interpretation_display?: string[];
    reference_range_low?: number;
    reference_range_high?: number;
    note?: string;
    effective_datetime: string;
    status: 'preliminary' | 'final';
  }>({
    code: '',
    code_display: '',
    category: ['vital-signs'],
    status: 'final',
    effective_datetime: new Date().toISOString().slice(0, 16),
  });

  const handleTemplateSelect = (template: any) => {
    setSelectedTemplate(template);
    setFormData({
      ...formData,
      code: template.code,
      code_display: template.display,
      category: [template.category],
      value_quantity_unit: template.unit,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const observation: CreateObservation = {
        patient_id: userId,
        status: formData.status,
        category: formData.category,
        code: formData.code,
        code_display: formData.code_display,
        code_system: 'http://loinc.org',
        effective_datetime: formData.effective_datetime,
        issued: new Date().toISOString(),
      };

      // Add value based on type
      if (formData.value_quantity_value !== undefined) {
        observation.value_quantity_value = formData.value_quantity_value;
        observation.value_quantity_unit = formData.value_quantity_unit;
        observation.value_quantity_system = 'http://unitsofmeasure.org';
      } else if (formData.value_string) {
        observation.value_string = formData.value_string;
      } else if (formData.value_codeable_concept_display) {
        observation.value_codeable_concept_display = formData.value_codeable_concept_display;
      }

      // Add interpretation if provided
      if (formData.interpretation_display && formData.interpretation_display.length > 0) {
        observation.interpretation_display = formData.interpretation_display;
      }

      // Add reference range if provided
      if (formData.reference_range_low !== undefined) {
        observation.reference_range_low = formData.reference_range_low;
      }
      if (formData.reference_range_high !== undefined) {
        observation.reference_range_high = formData.reference_range_high;
      }

      // Add note if provided
      if (formData.note) {
        observation.note = formData.note;
      }

      const response = await FHIRService.Observation.create(observation);

      if (response.success) {
        onSuccess();
      } else {
        setError(response.error || 'Failed to create observation');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-xs border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">Add New Observation</h3>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Category Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex -mb-px">
          {[
            { id: 'vitals' as const, label: 'Vital Signs', icon: '💓' },
            { id: 'labs' as const, label: 'Lab Results', icon: '🔬' },
            { id: 'social' as const, label: 'Social History', icon: '📋' },
            { id: 'custom' as const, label: 'Custom', icon: '✏️' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setCategoryTab(tab.id);
                setSelectedTemplate(null);
                if (tab.id !== 'custom') {
                  setFormData({
                    ...formData,
                    category: [tab.id === 'vitals' ? 'vital-signs' : tab.id === 'labs' ? 'laboratory' : 'social-history'],
                  });
                }
              }}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                categoryTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Template Selection */}
        {categoryTab !== 'custom' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Observation Type
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {OBSERVATION_TEMPLATES[categoryTab].map((template) => (
                <button
                  key={template.code}
                  type="button"
                  onClick={() => handleTemplateSelect(template)}
                  className={`text-left p-4 rounded-lg border-2 transition-all ${
                    selectedTemplate?.code === template.code
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-semibold text-gray-900 text-sm">{template.display}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    LOINC: {template.code} • {template.unit || 'Text value'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Custom Fields */}
        {categoryTab === 'custom' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                LOINC Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                placeholder="e.g., 8867-4"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Display Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.code_display}
                onChange={(e) => setFormData({ ...formData, code_display: e.target.value })}
                className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                placeholder="e.g., Heart rate"
                required
              />
            </div>
          </div>
        )}

        {/* Value Input (only show if template selected or custom) */}
        {(selectedTemplate || categoryTab === 'custom') && (
          <>
            {/* Numeric Value */}
            {(categoryTab === 'vitals' || categoryTab === 'labs' || (categoryTab === 'custom' && !formData.value_string)) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Value <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.value_quantity_value || ''}
                    onChange={(e) => setFormData({ ...formData, value_quantity_value: parseFloat(e.target.value) })}
                    className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="Enter measurement value"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <input
                    type="text"
                    value={formData.value_quantity_unit || ''}
                    onChange={(e) => setFormData({ ...formData, value_quantity_unit: e.target.value })}
                    className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="e.g., mmHg, mg/dL"
                  />
                </div>
              </div>
            )}

            {/* Text Value (for social history) */}
            {categoryTab === 'social' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Value <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.value_codeable_concept_display || formData.value_string || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    value_codeable_concept_display: e.target.value,
                    value_string: e.target.value
                  })}
                  className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="Enter value (e.g., 'Former smoker', 'Occasional drinker')"
                  required
                />
              </div>
            )}

            {/* Date/Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date & Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={formData.effective_datetime}
                  onChange={(e) => setFormData({ ...formData, effective_datetime: e.target.value })}
                  className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'preliminary' | 'final' })}
                  className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="final">Final</option>
                  <option value="preliminary">Preliminary</option>
                </select>
              </div>
            </div>

            {/* Interpretation */}
            {(categoryTab === 'vitals' || categoryTab === 'labs') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Interpretation (Optional)</label>
                <select
                  value={formData.interpretation_display?.[0] || ''}
                  onChange={(e) => setFormData({ ...formData, interpretation_display: e.target.value ? [e.target.value] : undefined })}
                  className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="">Select interpretation</option>
                  <option value="Normal">Normal</option>
                  <option value="High">High</option>
                  <option value="Low">Low</option>
                  <option value="Critical High">Critical High</option>
                  <option value="Critical Low">Critical Low</option>
                </select>
              </div>
            )}

            {/* Reference Range */}
            {(categoryTab === 'vitals' || categoryTab === 'labs') && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reference Range Low (Optional)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.reference_range_low || ''}
                    onChange={(e) => setFormData({ ...formData, reference_range_low: e.target.value ? parseFloat(e.target.value) : undefined })}
                    className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="Normal range minimum"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reference Range High (Optional)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.reference_range_high || ''}
                    onChange={(e) => setFormData({ ...formData, reference_range_high: e.target.value ? parseFloat(e.target.value) : undefined })}
                    className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="Normal range maximum"
                  />
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
              <textarea
                value={formData.note || ''}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                rows={3}
                className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                placeholder="Additional notes or context..."
              />
            </div>
          </>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading || (!selectedTemplate && categoryTab !== 'custom')}
          >
            {loading ? 'Saving...' : 'Save Observation'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ObservationEntry;
