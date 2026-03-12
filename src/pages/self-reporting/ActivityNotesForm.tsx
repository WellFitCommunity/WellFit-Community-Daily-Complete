/**
 * Self Reporting — Activity, Social, and Notes Form Sections
 *
 * Physical activity, social engagement dropdowns, and voice-enabled
 * symptom/notes text areas.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import React from 'react';
import { Mic, MicOff } from 'lucide-react';
import { PHYSICAL_ACTIVITY_OPTIONS, SOCIAL_ENGAGEMENT_OPTIONS } from './types';

interface ActivityNotesFormProps {
  physicalActivity: string;
  setPhysicalActivity: (v: string) => void;
  socialEngagement: string;
  setSocialEngagement: (v: string) => void;
  symptoms: string;
  setSymptoms: (v: string) => void;
  activity: string;
  setActivity: (v: string) => void;
  isLoading: boolean;
  isListening: boolean;
  currentField: string | null;
  startVoiceRecognition: (field: string) => void;
  stopVoiceRecognition: () => void;
}

const ActivityNotesForm: React.FC<ActivityNotesFormProps> = ({
  physicalActivity, setPhysicalActivity,
  socialEngagement, setSocialEngagement,
  symptoms, setSymptoms,
  activity, setActivity,
  isLoading,
  isListening, currentField,
  startVoiceRecognition, stopVoiceRecognition,
}) => {
  return (
    <>
      {/* Activity & Social Section */}
      <div className="border-b border-gray-200 pb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">🏃‍♀️ Today&apos;s Activities</h2>

        <div className="mb-4">
          <label className="block text-lg font-medium text-gray-700 mb-2">
            🏃‍♀️ What physical activity did you do today?
          </label>
          <select
            value={physicalActivity}
            onChange={(e) => setPhysicalActivity(e.target.value)}
            className="w-full py-3 px-4 text-lg border-2 border-gray-300 bg-white rounded-lg shadow-xs focus:outline-hidden focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 placeholder-gray-400"
            style={{ minHeight: '48px', fontSize: '16px' }}
          >
            <option value="" className="text-gray-500 bg-gray-50">
              Select an activity...
            </option>
            {PHYSICAL_ACTIVITY_OPTIONS.map((option) => (
              <option key={option} value={option} className="text-gray-900 bg-white">
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-lg font-medium text-gray-700 mb-2">
            👥 How did you connect with others today?
          </label>
          <select
            value={socialEngagement}
            onChange={(e) => setSocialEngagement(e.target.value)}
            className="w-full py-3 px-4 text-lg border-2 border-gray-300 bg-white rounded-lg shadow-xs focus:outline-hidden focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 placeholder-gray-400"
            style={{ minHeight: '48px', fontSize: '16px' }}
          >
            <option value="" className="text-gray-500 bg-gray-50">
              Tell us about your social time...
            </option>
            {SOCIAL_ENGAGEMENT_OPTIONS.map((option) => (
              <option key={option} value={option} className="text-gray-900 bg-white">
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Additional Notes Section */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">📝 Additional Notes (Optional)</h2>

        <div className="mb-4">
          <label htmlFor="symptoms" className="block text-lg font-medium text-gray-700 mb-2">
            🤒 Any symptoms you&apos;re experiencing?
          </label>
          <div className="relative">
            <textarea
              id="symptoms"
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              rows={3}
              disabled={isLoading}
              className="w-full py-3 px-4 text-lg border border-gray-300 bg-white rounded-lg shadow-xs focus:outline-hidden focus:ring-green-500 focus:border-green-500 disabled:bg-gray-50 pr-14 text-gray-900 placeholder-gray-400"
              placeholder="e.g., headache, fatigue, feeling dizzy..."
              maxLength={500}
            />
            <button
              type="button"
              onClick={() =>
                isListening && currentField === 'symptoms'
                  ? stopVoiceRecognition()
                  : startVoiceRecognition('symptoms')
              }
              className={`absolute right-3 top-3 p-2 rounded-full transition ${
                isListening && currentField === 'symptoms'
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
              title={
                isListening && currentField === 'symptoms' ? 'Stop recording' : 'Click to speak'
              }
            >
              {isListening && currentField === 'symptoms' ? <Mic size={20} /> : <MicOff size={20} />}
            </button>
          </div>
          {isListening && currentField === 'symptoms' && (
            <p className="text-red-600 text-sm mt-1 animate-pulse">🎤 Listening... Speak now!</p>
          )}
        </div>

        <div className="mb-4">
          <label htmlFor="activity" className="block text-lg font-medium text-gray-700 mb-2">
            📓 Tell us more about your day
          </label>
          <div className="relative">
            <textarea
              id="activity"
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
              rows={3}
              disabled={isLoading}
              className="w-full py-3 px-4 text-lg border border-gray-300 bg-white rounded-lg shadow-xs focus:outline-hidden focus:ring-green-500 focus:border-green-500 disabled:bg-gray-50 pr-14 text-gray-900 placeholder-gray-400"
              placeholder="Tell us about your day, any concerns, or how you're feeling..."
              maxLength={500}
            />
            <button
              type="button"
              onClick={() =>
                isListening && currentField === 'activity'
                  ? stopVoiceRecognition()
                  : startVoiceRecognition('activity')
              }
              className={`absolute right-3 top-3 p-2 rounded-full transition ${
                isListening && currentField === 'activity'
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
              title={
                isListening && currentField === 'activity' ? 'Stop recording' : 'Click to speak'
              }
            >
              {isListening && currentField === 'activity' ? <Mic size={20} /> : <MicOff size={20} />}
            </button>
          </div>
          {isListening && currentField === 'activity' && (
            <p className="text-red-600 text-sm mt-1 animate-pulse">🎤 Listening... Speak now!</p>
          )}
        </div>
      </div>
    </>
  );
};

export default ActivityNotesForm;
