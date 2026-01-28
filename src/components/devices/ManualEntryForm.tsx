/**
 * ManualEntryForm - Inline forms for manually entering vital sign readings
 *
 * Provides validated forms for each vital type with:
 * - Pre-filled current timestamp
 * - Real-time validation feedback
 * - Success confirmation
 * - Integration with DeviceService
 */

import React, { useState } from 'react';

export type VitalType = 'bp' | 'glucose' | 'spo2' | 'weight';

interface ManualEntryFormProps {
  vitalType: VitalType;
  onSave: (data: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>;
  onCancel?: () => void;
  primaryColor?: string;
}

interface FormField {
  name: string;
  label: string;
  type: 'number' | 'select';
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
}

const FORM_CONFIGS: Record<VitalType, { title: string; fields: FormField[] }> = {
  bp: {
    title: 'Blood Pressure Reading',
    fields: [
      { name: 'systolic', label: 'Systolic', type: 'number', placeholder: '120', min: 40, max: 300, unit: 'mmHg', required: true },
      { name: 'diastolic', label: 'Diastolic', type: 'number', placeholder: '80', min: 20, max: 200, unit: 'mmHg', required: true },
      { name: 'pulse', label: 'Pulse', type: 'number', placeholder: '72', min: 20, max: 300, unit: 'bpm', required: true },
    ],
  },
  glucose: {
    title: 'Blood Glucose Reading',
    fields: [
      { name: 'value', label: 'Glucose Level', type: 'number', placeholder: '100', min: 10, max: 800, unit: 'mg/dL', required: true },
      {
        name: 'meal_context',
        label: 'Meal Context',
        type: 'select',
        required: true,
        options: [
          { value: 'fasting', label: 'Fasting' },
          { value: 'before_meal', label: 'Before Meal' },
          { value: 'after_meal', label: 'After Meal' },
          { value: 'bedtime', label: 'Bedtime' },
        ],
      },
    ],
  },
  spo2: {
    title: 'Oxygen Saturation Reading',
    fields: [
      { name: 'spo2', label: 'SpO2', type: 'number', placeholder: '98', min: 0, max: 100, step: 1, unit: '%', required: true },
      { name: 'pulse_rate', label: 'Pulse Rate', type: 'number', placeholder: '72', min: 20, max: 300, unit: 'bpm', required: true },
    ],
  },
  weight: {
    title: 'Weight Measurement',
    fields: [
      { name: 'weight', label: 'Weight', type: 'number', placeholder: '150', min: 1, max: 1500, step: 0.1, unit: 'lbs', required: true },
      { name: 'bmi', label: 'BMI (optional)', type: 'number', placeholder: '24.5', min: 5, max: 100, step: 0.1 },
      { name: 'body_fat', label: 'Body Fat % (optional)', type: 'number', placeholder: '20', min: 1, max: 70, step: 0.1, unit: '%' },
    ],
  },
};

const ManualEntryForm: React.FC<ManualEntryFormProps> = ({
  vitalType,
  onSave,
  onCancel,
  primaryColor = '#00857a',
}) => {
  const config = FORM_CONFIGS[vitalType];
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
    setSubmitError(null);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    config.fields.forEach((field) => {
      const value = formData[field.name];

      if (field.required && (!value || value.trim() === '')) {
        newErrors[field.name] = `${field.label} is required`;
        return;
      }

      if (field.type === 'number' && value) {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
          newErrors[field.name] = `${field.label} must be a number`;
        } else if (field.min !== undefined && numValue < field.min) {
          newErrors[field.name] = `${field.label} must be at least ${field.min}`;
        } else if (field.max !== undefined && numValue > field.max) {
          newErrors[field.name] = `${field.label} cannot exceed ${field.max}`;
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Convert string values to appropriate types
      const data: Record<string, unknown> = {};
      config.fields.forEach((field) => {
        const value = formData[field.name];
        if (value !== undefined && value !== '') {
          if (field.type === 'number') {
            data[field.name] = parseFloat(value);
          } else {
            data[field.name] = value;
          }
        }
      });

      // Add timestamp
      data.measured_at = new Date().toISOString();

      const result = await onSave(data);

      if (result.success) {
        setShowSuccess(true);
        setFormData({});
        // Hide success message after 3 seconds
        setTimeout(() => setShowSuccess(false), 3000);
      } else {
        setSubmitError(result.error || 'Failed to save reading');
      }
    } catch {
      setSubmitError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData({});
    setErrors({});
    setSubmitError(null);
    setShowSuccess(false);
  };

  if (showSuccess) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
        <div className="text-4xl mb-3">✓</div>
        <h3 className="text-xl font-bold text-green-700 mb-2">Reading Saved!</h3>
        <p className="text-green-600 mb-4">Your {config.title.toLowerCase()} has been recorded.</p>
        <button
          onClick={handleReset}
          className="px-4 py-2 text-green-700 hover:bg-green-100 rounded-lg transition-colors"
        >
          Add Another Reading
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-700">{config.title}</h3>

      {submitError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
          {submitError}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {config.fields.map((field) => (
          <div key={field.name} className={field.type === 'select' ? 'sm:col-span-2' : ''}>
            <label
              htmlFor={field.name}
              className="block text-sm font-medium text-gray-600 mb-1"
            >
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>

            {field.type === 'select' ? (
              <select
                id={field.name}
                value={formData[field.name] || ''}
                onChange={(e) => handleChange(field.name, e.target.value)}
                className={`w-full px-4 py-3 rounded-lg border ${
                  errors[field.name]
                    ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                    : 'border-gray-300 focus:ring-2 focus:border-transparent'
                } transition-colors`}
                style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
              >
                <option value="">Select {field.label}</option>
                {field.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <div className="relative">
                <input
                  id={field.name}
                  type="number"
                  value={formData[field.name] || ''}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  placeholder={field.placeholder}
                  min={field.min}
                  max={field.max}
                  step={field.step || 1}
                  className={`w-full px-4 py-3 rounded-lg border ${
                    errors[field.name]
                      ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                      : 'border-gray-300 focus:ring-2 focus:border-transparent'
                  } transition-colors ${field.unit ? 'pr-16' : ''}`}
                  style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                />
                {field.unit && (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                    {field.unit}
                  </span>
                )}
              </div>
            )}

            {errors[field.name] && (
              <p className="mt-1 text-sm text-red-600">{errors[field.name]}</p>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 px-6 py-3 rounded-xl font-semibold text-white transition-all duration-300 hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: primaryColor }}
        >
          {isSubmitting ? 'Saving...' : 'Save Reading'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-3 rounded-xl font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
};

export default ManualEntryForm;
