// src/pages/DemographicsPage/steps/EmergencyContactStep.tsx
// Emergency contact information step
import React from 'react';
import { StepProps } from '../types';

export const EmergencyContactStep: React.FC<StepProps> = ({ formData, onInputChange }) => {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold mb-4">Emergency Contact</h2>

      {/* Contact Name */}
      <div>
        <label className="block text-lg font-medium text-gray-700 mb-2">
          Emergency contact name
        </label>
        <input
          type="text"
          value={formData.emergency_contact_name}
          onChange={(e) => onInputChange('emergency_contact_name', e.target.value)}
          className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          placeholder="Full name"
        />
      </div>

      {/* Contact Phone */}
      <div>
        <label className="block text-lg font-medium text-gray-700 mb-2">
          Emergency contact phone number
        </label>
        <input
          type="tel"
          value={formData.emergency_contact_phone}
          onChange={(e) => onInputChange('emergency_contact_phone', e.target.value)}
          className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          placeholder="(555) 123-4567"
        />
      </div>

      {/* Relationship */}
      <div>
        <label className="block text-lg font-medium text-gray-700 mb-2">
          Relationship to you
        </label>
        <select
          value={formData.emergency_contact_relationship}
          onChange={(e) => onInputChange('emergency_contact_relationship', e.target.value)}
          className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
        >
          <option value="">Please select</option>
          <option value="spouse">Spouse/Partner</option>
          <option value="child">Child</option>
          <option value="parent">Parent</option>
          <option value="sibling">Brother/Sister</option>
          <option value="friend">Friend</option>
          <option value="neighbor">Neighbor</option>
          <option value="caregiver">Caregiver</option>
          <option value="other">Other</option>
        </select>
      </div>
    </div>
  );
};

export default EmergencyContactStep;
