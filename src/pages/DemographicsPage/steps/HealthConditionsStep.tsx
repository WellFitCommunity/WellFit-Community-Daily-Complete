// src/pages/DemographicsPage/steps/HealthConditionsStep.tsx
// Health Information step - insurance, conditions, mobility
import React from 'react';
import { StepProps } from '../types';

const HEALTH_CONDITIONS = [
  'Diabetes', 'High Blood Pressure', 'Heart Disease', 'Arthritis',
  'Depression', 'Anxiety', 'COPD', 'Osteoporosis',
  'Memory Problems', 'Chronic Pain', 'Kidney Disease', 'Cancer'
];

export const HealthConditionsStep: React.FC<StepProps> = ({
  formData,
  onInputChange,
  onHealthConditionToggle
}) => {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold mb-4">Health Information</h2>

      {/* Insurance Type */}
      <div>
        <label className="block text-lg font-medium text-gray-700 mb-2">
          What type of health insurance do you have?
        </label>
        <select
          value={formData.insurance_type}
          onChange={(e) => onInputChange('insurance_type', e.target.value)}
          className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
        >
          <option value="">Please select</option>
          <option value="medicare">Medicare</option>
          <option value="medicaid">Medicaid</option>
          <option value="private">Private insurance</option>
          <option value="medicare-supplement">Medicare + Supplement</option>
          <option value="va">Veterans Affairs (VA)</option>
          <option value="none">No insurance</option>
          <option value="other">Other</option>
        </select>
      </div>

      {/* Health Conditions */}
      <div>
        <label className="block text-lg font-medium text-gray-700 mb-2">
          Do you have any of these health conditions? (Check all that apply)
        </label>
        <div className="grid grid-cols-2 gap-3">
          {HEALTH_CONDITIONS.map((condition) => (
            <label key={condition} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.health_conditions.includes(condition)}
                onChange={() => onHealthConditionToggle?.(condition)}
                className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500"
              />
              <span className="text-base">{condition}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Mobility Level */}
      <div>
        <label className="block text-lg font-medium text-gray-700 mb-2">
          How would you describe your mobility?
        </label>
        <select
          value={formData.mobility_level}
          onChange={(e) => onInputChange('mobility_level', e.target.value)}
          className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
        >
          <option value="">Please select</option>
          <option value="excellent">I get around very well</option>
          <option value="good">I get around well with minor difficulty</option>
          <option value="fair">I need some help getting around</option>
          <option value="poor">I need a lot of help getting around</option>
        </select>
      </div>
    </div>
  );
};

export default HealthConditionsStep;
