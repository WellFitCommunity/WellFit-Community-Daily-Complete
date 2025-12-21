// src/pages/DemographicsPage/steps/SocialSupportStep.tsx
// Social Support & SDOH step - transportation, food security, social isolation, tech comfort
import React from 'react';
import { StepProps } from '../types';

export const SocialSupportStep: React.FC<StepProps> = ({ formData, onInputChange }) => {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold mb-4">Social Support & Resources</h2>

      {/* Transportation */}
      <div>
        <label className="block text-lg font-medium text-gray-700 mb-2">
          How do you usually get around?
        </label>
        <select
          value={formData.transportation_access}
          onChange={(e) => onInputChange('transportation_access', e.target.value)}
          className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
        >
          <option value="">Please select</option>
          <option value="own-car">I drive my own car</option>
          <option value="family-drives">Family/friends drive me</option>
          <option value="public-transport">Public transportation</option>
          <option value="rideshare">Uber/Lyft/Taxi</option>
          <option value="medical-transport">Medical transport</option>
          <option value="walk">I walk most places</option>
          <option value="limited">Limited transportation</option>
        </select>
      </div>

      {/* Food Security */}
      <div>
        <label className="block text-lg font-medium text-gray-700 mb-2">
          Do you ever worry about having enough food?
        </label>
        <select
          value={formData.food_security}
          onChange={(e) => onInputChange('food_security', e.target.value)}
          className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
        >
          <option value="">Please select</option>
          <option value="never">Never</option>
          <option value="rarely">Rarely</option>
          <option value="sometimes">Sometimes</option>
          <option value="often">Often</option>
        </select>
      </div>

      {/* Social Isolation */}
      <div>
        <label className="block text-lg font-medium text-gray-700 mb-2">
          How often do you feel lonely or isolated?
        </label>
        <select
          value={formData.social_support}
          onChange={(e) => onInputChange('social_support', e.target.value)}
          className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
        >
          <option value="">Please select</option>
          <option value="never">Never</option>
          <option value="rarely">Rarely</option>
          <option value="sometimes">Sometimes</option>
          <option value="often">Often</option>
          <option value="always">Most of the time</option>
        </select>
      </div>

      {/* Tech Comfort */}
      <div>
        <label className="block text-lg font-medium text-gray-700 mb-2">
          How comfortable are you with technology?
        </label>
        <select
          value={formData.tech_comfort_level}
          onChange={(e) => onInputChange('tech_comfort_level', e.target.value)}
          className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
        >
          <option value="">Please select</option>
          <option value="very-comfortable">Very comfortable</option>
          <option value="somewhat-comfortable">Somewhat comfortable</option>
          <option value="not-very-comfortable">Not very comfortable</option>
          <option value="not-comfortable">Not comfortable at all</option>
        </select>
      </div>
    </div>
  );
};

export default SocialSupportStep;
