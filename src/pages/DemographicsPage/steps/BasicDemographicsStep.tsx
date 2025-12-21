// src/pages/DemographicsPage/steps/BasicDemographicsStep.tsx
import React from 'react';
import { StepProps } from '../types';

export const BasicDemographicsStep: React.FC<StepProps> = ({ formData, onInputChange }) => {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold mb-4">Basic Information</h2>

      {/* Date of Birth */}
      <div>
        <label className="block text-lg font-medium text-gray-700 mb-2">
          Date of Birth
        </label>
        <input
          type="date"
          value={formData.dob}
          onChange={(e) => onInputChange('dob', e.target.value)}
          className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          max={new Date().toISOString().split('T')[0]}
        />
        <p className="text-sm text-gray-500 mt-1">This helps us provide age-appropriate services</p>
      </div>

      {/* Gender */}
      <div>
        <label className="block text-lg font-medium text-gray-700 mb-2">
          How do you identify your gender?
        </label>
        <select
          value={formData.gender}
          onChange={(e) => onInputChange('gender', e.target.value)}
          className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
        >
          <option value="">Please select</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="non-binary">Non-binary</option>
          <option value="prefer-not-to-say">Prefer not to say</option>
        </select>
      </div>

      {/* Ethnicity */}
      <div>
        <label className="block text-lg font-medium text-gray-700 mb-2">
          What is your ethnic background?
        </label>
        <select
          value={formData.ethnicity}
          onChange={(e) => onInputChange('ethnicity', e.target.value)}
          className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
        >
          <option value="">Please select</option>
          <option value="white">White</option>
          <option value="black">Black or African American</option>
          <option value="hispanic">Hispanic or Latino</option>
          <option value="asian">Asian</option>
          <option value="native-american">Native American</option>
          <option value="pacific-islander">Pacific Islander</option>
          <option value="mixed">Mixed race</option>
          <option value="other">Other</option>
          <option value="prefer-not-to-say">Prefer not to say</option>
        </select>
      </div>

      {/* Marital Status */}
      <div>
        <label className="block text-lg font-medium text-gray-700 mb-2">
          What is your marital status?
        </label>
        <select
          value={formData.marital_status}
          onChange={(e) => onInputChange('marital_status', e.target.value)}
          className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
        >
          <option value="">Please select</option>
          <option value="single">Single</option>
          <option value="married">Married</option>
          <option value="divorced">Divorced</option>
          <option value="widowed">Widowed</option>
          <option value="separated">Separated</option>
          <option value="domestic-partner">Domestic Partner</option>
        </select>
      </div>

      {/* Language & Accessibility Section */}
      <div className="pt-4 border-t border-gray-200">
        <h3 className="text-lg font-medium text-gray-800 mb-4">Language & Communication</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-lg font-medium text-gray-700 mb-2">
              What language do you prefer?
            </label>
            <select
              value={formData.preferred_language}
              onChange={(e) => onInputChange('preferred_language', e.target.value)}
              className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="en">English</option>
              <option value="es">Spanish / Español</option>
              <option value="zh">Chinese / 中文</option>
              <option value="vi">Vietnamese / Tiếng Việt</option>
              <option value="ko">Korean / 한국어</option>
              <option value="tl">Tagalog</option>
              <option value="ru">Russian / Русский</option>
              <option value="ar">Arabic / العربية</option>
              <option value="fr">French / Français</option>
              <option value="de">German / Deutsch</option>
              <option value="pt">Portuguese / Português</option>
              <option value="ja">Japanese / 日本語</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
            <input
              type="checkbox"
              id="requires_interpreter"
              checked={formData.requires_interpreter}
              onChange={(e) => onInputChange('requires_interpreter', e.target.checked)}
              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="requires_interpreter" className="text-base text-gray-700">
              I need an interpreter for medical appointments
            </label>
          </div>
        </div>
      </div>

      {/* Veteran Status */}
      <div className="pt-4 border-t border-gray-200">
        <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
          <input
            type="checkbox"
            id="veteran_status"
            checked={formData.veteran_status}
            onChange={(e) => onInputChange('veteran_status', e.target.checked)}
            className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500"
          />
          <div>
            <label htmlFor="veteran_status" className="text-base font-medium text-gray-700">
              I am a U.S. Military Veteran
            </label>
            <p className="text-sm text-gray-500">Veterans may qualify for additional benefits and services</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BasicDemographicsStep;
