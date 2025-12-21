// src/pages/DemographicsPage/steps/LivingSituationStep.tsx
// Step 2 for SENIORS ONLY - Living situation, education, income
import React from 'react';
import { StepProps } from '../types';

export const LivingSituationStep: React.FC<StepProps> = ({ formData, onInputChange }) => {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold mb-4">Your Living Situation</h2>

      {/* Living Situation */}
      <div>
        <label className="block text-lg font-medium text-gray-700 mb-2">
          Who do you live with?
        </label>
        <select
          value={formData.living_situation}
          onChange={(e) => onInputChange('living_situation', e.target.value)}
          className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
        >
          <option value="">Please select</option>
          <option value="alone">I live alone</option>
          <option value="spouse">With my spouse/partner</option>
          <option value="family">With family members</option>
          <option value="roommate">With roommates/friends</option>
          <option value="assisted-living">In assisted living</option>
          <option value="nursing-home">In a nursing home</option>
          <option value="other">Other arrangement</option>
        </select>
      </div>

      {/* Education Level */}
      <div>
        <label className="block text-lg font-medium text-gray-700 mb-2">
          What is your highest level of education?
        </label>
        <select
          value={formData.education_level}
          onChange={(e) => onInputChange('education_level', e.target.value)}
          className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
        >
          <option value="">Please select</option>
          <option value="less-than-high-school">Less than high school</option>
          <option value="high-school">High school diploma or GED</option>
          <option value="some-college">Some college</option>
          <option value="associate">Associate degree</option>
          <option value="bachelor">Bachelor's degree</option>
          <option value="graduate">Graduate degree</option>
        </select>
      </div>

      {/* Income Range */}
      <div>
        <label className="block text-lg font-medium text-gray-700 mb-2">
          What is your household income range? (Optional)
        </label>
        <select
          value={formData.income_range}
          onChange={(e) => onInputChange('income_range', e.target.value)}
          className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
        >
          <option value="">Prefer not to say</option>
          <option value="under-25k">Under $25,000</option>
          <option value="25k-50k">$25,000 - $50,000</option>
          <option value="50k-75k">$50,000 - $75,000</option>
          <option value="75k-100k">$75,000 - $100,000</option>
          <option value="over-100k">Over $100,000</option>
        </select>
      </div>
    </div>
  );
};

export default LivingSituationStep;
