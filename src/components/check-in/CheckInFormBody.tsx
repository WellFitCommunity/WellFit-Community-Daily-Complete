/**
 * CheckInFormBody — Mood selector, vitals inputs, activity/social, notes with voice, submit + quick buttons.
 */

import React from 'react';
import { Mic, MicOff, Heart } from 'lucide-react';
import { WellnessSuggestions } from '../wellness/WellnessSuggestions';
import {
  MOOD_OPTIONS,
  PHYSICAL_ACTIVITY_OPTIONS,
  SOCIAL_ENGAGEMENT_OPTIONS,
  CHECK_IN_BUTTONS,
} from './CheckIn.types';
import type { CheckInFormBodyProps } from './CheckIn.types';

export const CheckInFormBody: React.FC<CheckInFormBodyProps> = ({
  mood, heartRate, pulseOximeter, bpSystolic, bpDiastolic, glucose, weight,
  physicalActivity, socialEngagement, symptoms, activityNotes,
  isSubmitting, isListening, currentField, infoMessage, feedbackRef, branding,
  onSetMood, onSetHeartRate, onSetPulseOximeter, onSetBpSystolic, onSetBpDiastolic,
  onSetGlucose, onSetWeight, onSetPhysicalActivity, onSetSocialEngagement,
  onSetSymptoms, onSetActivityNotes,
  onStartVoice, onStopVoice, onShowPulseOximeter, onCheckIn,
}) => (
  <div className="space-y-6 p-4 sm:p-6 text-gray-900">
    {/* Mood Section */}
    <div className="border-b border-gray-200 pb-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">😊 How Are You Feeling?</h2>
      <div className="mb-4">
        <label htmlFor="mood" className="block text-lg font-medium text-gray-700 mb-2">
          Select your mood today <span className="text-red-500">*</span>
        </label>
        <select
          id="mood"
          value={mood}
          onChange={(e) => onSetMood(e.target.value)}
          disabled={isSubmitting}
          aria-required="true"
          className="mt-1 block w-full py-3 px-4 text-lg border-2 border-gray-300 bg-white rounded-lg shadow-xs focus:outline-hidden focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100 text-gray-900"
          style={{ minHeight: '48px', fontSize: '16px' }}
        >
          <option value="" disabled className="text-gray-500 bg-gray-50">-- Select your mood --</option>
          {MOOD_OPTIONS.map((option) => (
            <option key={option} value={option} className="text-gray-900 bg-white">{option}</option>
          ))}
        </select>
      </div>
      {mood && (
        <div className="mt-4">
          <WellnessSuggestions mood={mood} />
        </div>
      )}
    </div>

    {/* Health Metrics Section */}
    <div className="border-b border-gray-200 pb-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">📈 Today&apos;s Health Numbers</h2>

      {/* Blood Pressure */}
      <div className="mb-4">
        <label className="block text-lg font-medium text-gray-700 mb-2">
          🩸 Blood Pressure (if you took it today)
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <input
              type="number"
              placeholder="Top number"
              value={bpSystolic}
              onChange={(e) => onSetBpSystolic(e.target.value)}
              disabled={isSubmitting}
              className="w-full py-3 px-4 text-lg border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500 text-gray-900 placeholder-gray-400 bg-white disabled:bg-gray-100"
              min={70}
              max={250}
            />
            <span className="text-sm text-gray-600">Systolic (top)</span>
          </div>
          <div>
            <input
              type="number"
              placeholder="Bottom number"
              value={bpDiastolic}
              onChange={(e) => onSetBpDiastolic(e.target.value)}
              disabled={isSubmitting}
              className="w-full py-3 px-4 text-lg border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500 text-gray-900 placeholder-gray-400 bg-white disabled:bg-gray-100"
              min={40}
              max={150}
            />
            <span className="text-sm text-gray-600">Diastolic (bottom)</span>
          </div>
        </div>
      </div>

      {/* Heart Rate & Blood Oxygen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-lg font-medium text-gray-700 mb-2">❤️ Heart Rate (BPM)</label>
          <input
            type="number"
            placeholder="e.g., 70"
            value={heartRate}
            onChange={(e) => onSetHeartRate(e.target.value)}
            disabled={isSubmitting}
            className="w-full py-3 px-4 text-lg border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500 text-gray-900 placeholder-gray-400 bg-white disabled:bg-gray-100"
            min={30}
            max={220}
          />
        </div>
        <div>
          <label className="block text-lg font-medium text-gray-700 mb-2">🫁 Blood Oxygen (%)</label>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="e.g., 98"
              value={pulseOximeter}
              onChange={(e) => onSetPulseOximeter(e.target.value)}
              disabled={isSubmitting}
              className="flex-1 py-3 px-4 text-lg border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500 text-gray-900 placeholder-gray-400 bg-white disabled:bg-gray-100"
              min={50}
              max={100}
            />
            <button
              type="button"
              onClick={onShowPulseOximeter}
              className="px-3 py-3 bg-linear-to-r from-red-500 to-pink-500 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-1 whitespace-nowrap"
              title="Measure with your camera"
            >
              <Heart size={18} />
              <span className="hidden sm:inline text-sm">Measure</span>
            </button>
          </div>
        </div>
      </div>

      {/* Pulse Oximeter Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
        <p className="text-sm text-gray-700">
          <strong>📱 New!</strong> Use your phone camera to measure your pulse and blood oxygen.
          Tap the <Heart size={14} className="inline text-red-500" /> button to get started!
        </p>
      </div>

      {/* Blood Sugar & Weight */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-lg font-medium text-gray-700 mb-2">🍯 Blood Sugar (mg/dL)</label>
          <input
            type="number"
            placeholder="e.g., 120"
            value={glucose}
            onChange={(e) => onSetGlucose(e.target.value)}
            disabled={isSubmitting}
            className="w-full py-3 px-4 text-lg border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500 text-gray-900 placeholder-gray-400 bg-white disabled:bg-gray-100"
            min={40}
            max={600}
          />
        </div>
        <div>
          <label className="block text-lg font-medium text-gray-700 mb-2">⚖️ Weight (lbs)</label>
          <input
            type="number"
            step="0.1"
            placeholder="e.g., 165"
            value={weight}
            onChange={(e) => onSetWeight(e.target.value)}
            disabled={isSubmitting}
            className="w-full py-3 px-4 text-lg border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500 text-gray-900 placeholder-gray-400 bg-white disabled:bg-gray-100"
            min={50}
            max={500}
          />
        </div>
      </div>
    </div>

    {/* Activity & Social Section */}
    <div className="border-b border-gray-200 pb-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">🏃‍♀️ Today&apos;s Activities</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-lg font-medium text-gray-700 mb-2">🏃‍♀️ Physical Activity</label>
          <select
            value={physicalActivity}
            onChange={(e) => onSetPhysicalActivity(e.target.value)}
            disabled={isSubmitting}
            className="w-full py-3 px-4 text-lg border-2 border-gray-300 bg-white rounded-lg shadow-xs focus:outline-hidden focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 disabled:bg-gray-100"
            style={{ minHeight: '48px', fontSize: '16px' }}
          >
            <option value="" className="text-gray-500 bg-gray-50">Select an activity...</option>
            {PHYSICAL_ACTIVITY_OPTIONS.map((option) => (
              <option key={option} value={option} className="text-gray-900 bg-white">{option}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-lg font-medium text-gray-700 mb-2">👥 Social Connection</label>
          <select
            value={socialEngagement}
            onChange={(e) => onSetSocialEngagement(e.target.value)}
            disabled={isSubmitting}
            className="w-full py-3 px-4 text-lg border-2 border-gray-300 bg-white rounded-lg shadow-xs focus:outline-hidden focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 disabled:bg-gray-100"
            style={{ minHeight: '48px', fontSize: '16px' }}
          >
            <option value="" className="text-gray-500 bg-gray-50">How did you connect?</option>
            {SOCIAL_ENGAGEMENT_OPTIONS.map((option) => (
              <option key={option} value={option} className="text-gray-900 bg-white">{option}</option>
            ))}
          </select>
        </div>
      </div>
    </div>

    {/* Notes Section with Voice */}
    <div className="border-b border-gray-200 pb-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">📝 Additional Notes (Optional)</h2>

      <div className="mb-4">
        <label htmlFor="symptoms" className="block text-lg font-medium text-gray-700 mb-2">
          🤒 Any symptoms you&apos;re experiencing?
        </label>
        <div className="relative">
          <textarea
            id="symptoms"
            value={symptoms}
            onChange={(e) => onSetSymptoms(e.target.value)}
            rows={3}
            disabled={isSubmitting}
            className="w-full py-3 px-4 text-lg border border-gray-300 bg-white rounded-lg shadow-xs focus:outline-hidden focus:ring-green-500 focus:border-green-500 disabled:bg-gray-50 pr-14 text-gray-900 placeholder-gray-400"
            placeholder="e.g., headache, fatigue, feeling dizzy..."
            maxLength={500}
          />
          <button
            type="button"
            onClick={() =>
              isListening && currentField === 'symptoms'
                ? onStopVoice()
                : onStartVoice('symptoms')
            }
            className={`absolute right-3 top-3 p-2 rounded-full transition ${
              isListening && currentField === 'symptoms'
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
            title={isListening && currentField === 'symptoms' ? 'Stop recording' : 'Click to speak'}
          >
            {isListening && currentField === 'symptoms' ? <Mic size={20} /> : <MicOff size={20} />}
          </button>
        </div>
        {isListening && currentField === 'symptoms' && (
          <p className="text-red-600 text-sm mt-1 animate-pulse">🎤 Listening... Speak now!</p>
        )}
      </div>

      <div className="mb-4">
        <label htmlFor="activityNotes" className="block text-lg font-medium text-gray-700 mb-2">
          📓 Tell us more about your day
        </label>
        <div className="relative">
          <textarea
            id="activityNotes"
            value={activityNotes}
            onChange={(e) => onSetActivityNotes(e.target.value)}
            rows={3}
            disabled={isSubmitting}
            className="w-full py-3 px-4 text-lg border border-gray-300 bg-white rounded-lg shadow-xs focus:outline-hidden focus:ring-green-500 focus:border-green-500 disabled:bg-gray-50 pr-14 text-gray-900 placeholder-gray-400"
            placeholder="Tell us about your day, any concerns, or how you're feeling..."
            maxLength={500}
          />
          <button
            type="button"
            onClick={() =>
              isListening && currentField === 'activityNotes'
                ? onStopVoice()
                : onStartVoice('activityNotes')
            }
            className={`absolute right-3 top-3 p-2 rounded-full transition ${
              isListening && currentField === 'activityNotes'
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
            title={isListening && currentField === 'activityNotes' ? 'Stop recording' : 'Click to speak'}
          >
            {isListening && currentField === 'activityNotes' ? <Mic size={20} /> : <MicOff size={20} />}
          </button>
        </div>
        {isListening && currentField === 'activityNotes' && (
          <p className="text-red-600 text-sm mt-1 animate-pulse">🎤 Listening... Speak now!</p>
        )}
      </div>
    </div>

    {/* Submit detailed check-in */}
    <button
      onClick={() => onCheckIn('Daily Self-Report', false)}
      className="w-full text-white font-bold py-4 px-6 rounded-lg text-xl shadow-lg transition-all duration-300 disabled:opacity-50 focus:outline-hidden focus:ring-4 focus:ring-offset-2 focus:ring-white hover:shadow-xl"
      style={{
        background:
          branding.gradient ||
          `linear-gradient(to right, ${branding.primaryColor || '#003865'}, ${branding.secondaryColor || '#8cc63f'})`,
      }}
      disabled={!mood || isSubmitting}
    >
      {isSubmitting ? '📤 Submitting...' : '✅ Save My Health Report'}
    </button>

    {!mood && (
      <p className="text-center text-red-600 font-medium">
        📌 Please select your mood before submitting
      </p>
    )}

    {/* Quick Check-ins */}
    <div className="pt-6 border-t border-gray-200">
      <h3 className="text-lg font-semibold mb-3 text-center text-gray-700">Or Quick Status Update:</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CHECK_IN_BUTTONS.map((label) => (
          <button
            key={label}
            onClick={() => onCheckIn(label, true)}
            className="w-full py-3 px-4 bg-[#8cc63f] border-2 border-[#003865] text-white font-semibold rounded-lg shadow-md hover:bg-[#77aa36] transition disabled:bg-gray-400 disabled:opacity-70 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-[#8cc63f]"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Processing…' : label}
          </button>
        ))}
      </div>
    </div>

    {/* Feedback */}
    {infoMessage?.text && (
      <div
        ref={feedbackRef}
        role="status"
        aria-live={infoMessage.type === 'error' ? 'assertive' : 'polite'}
        className={`p-4 text-white rounded-lg text-center font-medium scroll-mt-4 ${
          infoMessage.type === 'error'
            ? 'bg-red-500'
            : infoMessage.type === 'success'
            ? 'bg-green-500'
            : 'bg-[#003865]'
        }`}
      >
        {infoMessage.text}
      </div>
    )}
  </div>
);

export default CheckInFormBody;
