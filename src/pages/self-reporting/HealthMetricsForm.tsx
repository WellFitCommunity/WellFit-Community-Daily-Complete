/**
 * Self Reporting — Health Metrics Form Section
 *
 * Mood, blood pressure, blood sugar, blood oxygen (with pulse oximeter), weight.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import React from 'react';
import { Heart } from 'lucide-react';
import { MOOD_OPTIONS } from './types';

interface HealthMetricsFormProps {
  mood: string;
  setMood: (v: string) => void;
  bloodPressureSystolic: string;
  setBloodPressureSystolic: (v: string) => void;
  bloodPressureDiastolic: string;
  setBloodPressureDiastolic: (v: string) => void;
  bloodSugar: string;
  setBloodSugar: (v: string) => void;
  bloodOxygen: string;
  setBloodOxygen: (v: string) => void;
  weight: string;
  setWeight: (v: string) => void;
  isLoading: boolean;
  onShowPulseOximeter: () => void;
}

const HealthMetricsForm: React.FC<HealthMetricsFormProps> = ({
  mood, setMood,
  bloodPressureSystolic, setBloodPressureSystolic,
  bloodPressureDiastolic, setBloodPressureDiastolic,
  bloodSugar, setBloodSugar,
  bloodOxygen, setBloodOxygen,
  weight, setWeight,
  isLoading,
  onShowPulseOximeter,
}) => {
  return (
    <div className="border-b border-gray-200 pb-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">📈 Today&apos;s Health Numbers</h2>

      {/* Mood */}
      <div className="mb-4">
        <label htmlFor="mood" className="block text-lg font-medium text-gray-700 mb-2">
          😊 How are you feeling today?
        </label>
        <select
          id="mood"
          value={mood}
          onChange={(e) => setMood(e.target.value)}
          disabled={isLoading}
          aria-required="true"
          className="mt-1 block w-full py-3 px-4 text-lg border-2 border-gray-300 bg-white rounded-lg shadow-xs focus:outline-hidden focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100 text-gray-900 placeholder-gray-400"
          style={{ minHeight: '48px', fontSize: '16px' }}
        >
          <option value="" disabled className="text-gray-500 bg-gray-50">
            Select your mood...
          </option>
          {MOOD_OPTIONS.map((option) => (
            <option key={option} value={option} className="text-gray-900 bg-white">
              {option}
            </option>
          ))}
        </select>
      </div>

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
              value={bloodPressureSystolic}
              onChange={(e) => setBloodPressureSystolic(e.target.value)}
              className="w-full py-3 px-4 text-lg border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500 text-gray-900 placeholder-gray-400 bg-white"
              min={70}
              max={250}
            />
            <span className="text-sm text-gray-600">Systolic (top)</span>
          </div>
          <div>
            <input
              type="number"
              placeholder="Bottom number"
              value={bloodPressureDiastolic}
              onChange={(e) => setBloodPressureDiastolic(e.target.value)}
              className="w-full py-3 px-4 text-lg border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500 text-gray-900 placeholder-gray-400 bg-white"
              min={40}
              max={150}
            />
            <span className="text-sm text-gray-600">Diastolic (bottom)</span>
          </div>
        </div>
      </div>

      {/* Blood Sugar */}
      <div className="mb-4">
        <label className="block text-lg font-medium text-gray-700 mb-2">
          🍯 Blood Sugar (if you checked it)
        </label>
        <input
          type="number"
          placeholder="mg/dL"
          value={bloodSugar}
          onChange={(e) => setBloodSugar(e.target.value)}
          className="w-full py-3 px-4 text-lg border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500 text-gray-900 placeholder-gray-400 bg-white"
          min={50}
          max={500}
        />
        <span className="text-sm text-gray-600">Enter number only (like 120)</span>
      </div>

      {/* Blood Oxygen with Pulse Oximeter */}
      <div className="mb-4">
        <label className="block text-lg font-medium text-gray-700 mb-2">
          🫁 Blood Oxygen Level (if you measured it)
        </label>
        <div className="flex gap-2 mb-2">
          <input
            type="number"
            placeholder="% (like 98)"
            value={bloodOxygen}
            onChange={(e) => setBloodOxygen(e.target.value)}
            className="flex-1 py-3 px-4 text-lg border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500 text-gray-900 placeholder-gray-400 bg-white"
            min={70}
            max={100}
          />
          <button
            type="button"
            onClick={onShowPulseOximeter}
            className="px-4 py-3 bg-linear-to-r from-red-500 to-pink-500 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 whitespace-nowrap"
            title="Measure with your camera"
          >
            <Heart size={20} />
            <span className="hidden sm:inline">Measure Now</span>
            <span className="sm:hidden">Measure</span>
          </button>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
          <p className="text-sm text-gray-700">
            <strong>📱 New!</strong> Use your phone camera to measure your pulse and blood oxygen.
            Tap &ldquo;Measure Now&rdquo; to get started!
          </p>
        </div>
        <span className="text-sm text-gray-600">Percentage (normal is 95–100%)</span>
      </div>

      {/* Weight */}
      <div className="mb-4">
        <label className="block text-lg font-medium text-gray-700 mb-2">
          ⚖️ Weight (if you weighed yourself)
        </label>
        <input
          type="number"
          step="0.1"
          placeholder="pounds"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          className="w-full py-3 px-4 text-lg border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500 text-gray-900 placeholder-gray-400 bg-white"
          min={50}
          max={500}
        />
        <span className="text-sm text-gray-600">Enter your weight in pounds</span>
      </div>
    </div>
  );
};

export default HealthMetricsForm;
