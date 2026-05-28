// src/pages/DemographicsPage/steps/BasicDemographicsStep.tsx
import React from 'react';
import { StepProps } from '../types';
import {
  OMB_RACE_PRIMARY,
  OMB_RACE_LABELS,
  OMB_ETHNICITY_LABELS,
  type OmbRaceCategory,
} from '../../../constants/omb-demographics';

export const BasicDemographicsStep: React.FC<StepProps> = ({ formData, onInputChange }) => {
  const toggleRace = (code: OmbRaceCategory) => {
    const current = formData.race_omb;
    const next = current.includes(code)
      ? current.filter((c) => c !== code)
      : [...current, code];
    onInputChange('race_omb', next);
  };

  const declineRace = formData.race_omb.includes('asked-declined');

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold mb-4">Basic Information</h2>

      {/* Date of Birth */}
      <div>
        <label htmlFor="demographics-dob" className="block text-lg font-medium text-gray-700 mb-2">
          Date of Birth
        </label>
        <input
          id="demographics-dob"
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
        <label htmlFor="demographics-gender" className="block text-lg font-medium text-gray-700 mb-2">
          How do you identify your gender?
        </label>
        <select
          id="demographics-gender"
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

      {/* Race — OMB 1997 multi-select per ONC 170.315(a)(5) / USCDI v3 */}
      <fieldset className="border border-gray-200 rounded-lg p-4">
        <legend className="text-lg font-medium text-gray-700 px-2">
          What is your race? (Select all that apply)
        </legend>
        <p className="text-sm text-gray-500 mb-3">You may choose more than one.</p>
        <div className="space-y-2">
          {OMB_RACE_PRIMARY.map((code) => {
            const inputId = `demographics-race-${code}`;
            return (
              <div key={code} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  id={inputId}
                  checked={formData.race_omb.includes(code)}
                  disabled={declineRace}
                  onChange={() => toggleRace(code)}
                  className="w-5 h-5 text-green-600 border-gray-300 rounded-sm focus:ring-green-500"
                />
                <label htmlFor={inputId} className="text-base text-gray-700">
                  {OMB_RACE_LABELS[code]}
                </label>
              </div>
            );
          })}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg mt-2 border-t border-gray-200">
            <input
              type="checkbox"
              id="demographics-race-decline"
              checked={declineRace}
              onChange={() => {
                onInputChange('race_omb', declineRace ? [] : ['asked-declined']);
              }}
              className="w-5 h-5 text-gray-600 border-gray-300 rounded-sm focus:ring-gray-500"
            />
            <label htmlFor="demographics-race-decline" className="text-base text-gray-700">
              Prefer not to say
            </label>
          </div>
        </div>
      </fieldset>

      {/* Ethnicity — OMB 1997 single per ONC 170.315(a)(5) / USCDI v3 */}
      <div>
        <label htmlFor="demographics-ethnicity-omb" className="block text-lg font-medium text-gray-700 mb-2">
          Are you Hispanic or Latino?
        </label>
        <p className="text-sm text-gray-500 mb-2">
          Hispanic/Latino is asked separately from race, per federal health
          reporting standards.
        </p>
        <select
          id="demographics-ethnicity-omb"
          value={formData.ethnicity_omb}
          onChange={(e) => onInputChange('ethnicity_omb', e.target.value)}
          className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
        >
          <option value="">Please select</option>
          <option value="hispanic-or-latino">{OMB_ETHNICITY_LABELS['hispanic-or-latino']}</option>
          <option value="not-hispanic-or-latino">{OMB_ETHNICITY_LABELS['not-hispanic-or-latino']}</option>
          <option value="asked-declined">{OMB_ETHNICITY_LABELS['asked-declined']}</option>
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
              className="w-5 h-5 text-blue-600 border-gray-300 rounded-sm focus:ring-blue-500"
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
            className="w-5 h-5 text-green-600 border-gray-300 rounded-sm focus:ring-green-500"
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
