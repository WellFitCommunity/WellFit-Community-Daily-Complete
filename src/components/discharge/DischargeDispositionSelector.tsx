/**
 * DischargeDispositionSelector Component
 *
 * A reusable selector for discharge disposition values.
 * Joint Commission compliant discharge destination selection.
 *
 * Used in:
 * - DischargePlanningChecklist
 * - BedManagementPanel
 * - DischargedPatientDashboard
 *
 * @module DischargeDispositionSelector
 */

import React from 'react';
import { Home, Building2, HeartPulse, Bed, Clock as _Clock, AlertTriangle, Hospital, X } from 'lucide-react';
import type { DischargeDisposition } from '../../types/dischargePlanning';

interface DischargeDispositionOption {
  value: DischargeDisposition;
  label: string;
  description: string;
  icon: React.ReactNode;
  category: 'home' | 'facility' | 'other';
}

const DISPOSITION_OPTIONS: DischargeDispositionOption[] = [
  {
    value: 'home',
    label: 'Home',
    description: 'Patient discharged to home without additional services',
    icon: <Home className="w-5 h-5" />,
    category: 'home'
  },
  {
    value: 'home_with_home_health',
    label: 'Home with Home Health',
    description: 'Patient discharged to home with home health agency services',
    icon: <Home className="w-5 h-5" />,
    category: 'home'
  },
  {
    value: 'skilled_nursing',
    label: 'Skilled Nursing Facility',
    description: 'Transfer to SNF for continued skilled nursing care',
    icon: <Building2 className="w-5 h-5" />,
    category: 'facility'
  },
  {
    value: 'inpatient_rehab',
    label: 'Inpatient Rehabilitation',
    description: 'Transfer to IRF for intensive rehabilitation therapy',
    icon: <HeartPulse className="w-5 h-5" />,
    category: 'facility'
  },
  {
    value: 'long_term_acute_care',
    label: 'Long-Term Acute Care',
    description: 'Transfer to LTACH for extended acute care needs',
    icon: <Bed className="w-5 h-5" />,
    category: 'facility'
  },
  {
    value: 'hospice',
    label: 'Hospice',
    description: 'Transfer to hospice care for end-of-life comfort care',
    icon: <HeartPulse className="w-5 h-5" />,
    category: 'facility'
  },
  {
    value: 'hospital_transfer',
    label: 'Hospital Transfer',
    description: 'Transfer to another hospital for specialized care',
    icon: <Hospital className="w-5 h-5" />,
    category: 'other'
  },
  {
    value: 'left_ama',
    label: 'Left Against Medical Advice',
    description: 'Patient left hospital against medical advice',
    icon: <AlertTriangle className="w-5 h-5" />,
    category: 'other'
  },
  {
    value: 'expired',
    label: 'Expired',
    description: 'Patient expired during hospitalization',
    icon: <X className="w-5 h-5" />,
    category: 'other'
  }
];

interface DischargeDispositionSelectorProps {
  value: DischargeDisposition | null;
  onChange: (value: DischargeDisposition) => void;
  disabled?: boolean;
  error?: string;
  required?: boolean;
  variant?: 'dropdown' | 'cards' | 'radio';
  showDescriptions?: boolean;
  className?: string;
}

export const DischargeDispositionSelector: React.FC<DischargeDispositionSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  error,
  required = false,
  variant = 'dropdown',
  showDescriptions = false,
  className = ''
}) => {
  if (variant === 'dropdown') {
    return (
      <div className={className}>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Discharge Disposition
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value as DischargeDisposition)}
          disabled={disabled}
          className={`w-full px-3 py-2 border rounded-lg shadow-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            error ? 'border-red-300' : 'border-gray-300'
          } ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
        >
          <option value="">Select discharge disposition...</option>
          <optgroup label="Home Discharge">
            {DISPOSITION_OPTIONS.filter(opt => opt.category === 'home').map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Facility Transfer">
            {DISPOSITION_OPTIONS.filter(opt => opt.category === 'facility').map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Other">
            {DISPOSITION_OPTIONS.filter(opt => opt.category === 'other').map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </optgroup>
        </select>
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        {showDescriptions && value && (
          <p className="mt-1 text-sm text-gray-500">
            {DISPOSITION_OPTIONS.find(opt => opt.value === value)?.description}
          </p>
        )}
      </div>
    );
  }

  if (variant === 'cards') {
    return (
      <div className={className}>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Discharge Disposition
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>

        {/* Home Options */}
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Home Discharge
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {DISPOSITION_OPTIONS.filter(opt => opt.category === 'home').map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => !disabled && onChange(opt.value)}
                disabled={disabled}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  value === opt.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`${value === opt.value ? 'text-blue-600' : 'text-gray-400'}`}>
                    {opt.icon}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{opt.label}</div>
                    {showDescriptions && (
                      <div className="text-xs text-gray-500 mt-1">{opt.description}</div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Facility Options */}
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Facility Transfer
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {DISPOSITION_OPTIONS.filter(opt => opt.category === 'facility').map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => !disabled && onChange(opt.value)}
                disabled={disabled}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  value === opt.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`${value === opt.value ? 'text-blue-600' : 'text-gray-400'}`}>
                    {opt.icon}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{opt.label}</div>
                    {showDescriptions && (
                      <div className="text-xs text-gray-500 mt-1">{opt.description}</div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Other Options */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Other
          </h4>
          <div className="grid grid-cols-3 gap-3">
            {DISPOSITION_OPTIONS.filter(opt => opt.category === 'other').map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => !disabled && onChange(opt.value)}
                disabled={disabled}
                className={`p-3 rounded-lg border-2 text-left transition-all ${
                  value === opt.value
                    ? opt.value === 'left_ama' || opt.value === 'expired'
                      ? 'border-red-500 bg-red-50'
                      : 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="flex items-center gap-2">
                  <div className={`${
                    value === opt.value
                      ? opt.value === 'left_ama' || opt.value === 'expired'
                        ? 'text-red-600'
                        : 'text-blue-600'
                      : 'text-gray-400'
                  }`}>
                    {opt.icon}
                  </div>
                  <div className="font-medium text-gray-900 text-sm">{opt.label}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  // Radio variant
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-3">
        Discharge Disposition
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="space-y-2">
        {DISPOSITION_OPTIONS.map(opt => (
          <label
            key={opt.value}
            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
              value === opt.value
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <input
              type="radio"
              name="discharge-disposition"
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              disabled={disabled}
              className="mt-1"
            />
            <div className="flex items-center gap-3 flex-1">
              <div className={`${value === opt.value ? 'text-blue-600' : 'text-gray-400'}`}>
                {opt.icon}
              </div>
              <div>
                <div className="font-medium text-gray-900">{opt.label}</div>
                {showDescriptions && (
                  <div className="text-sm text-gray-500">{opt.description}</div>
                )}
              </div>
            </div>
          </label>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
};

// Export the options for use elsewhere
export { DISPOSITION_OPTIONS };
export type { DischargeDispositionOption };

// Utility to get label for a disposition value
export const getDispositionLabel = (value: DischargeDisposition): string => {
  return DISPOSITION_OPTIONS.find(opt => opt.value === value)?.label || value;
};

// Utility to get description for a disposition value
export const getDispositionDescription = (value: DischargeDisposition): string => {
  return DISPOSITION_OPTIONS.find(opt => opt.value === value)?.description || '';
};
