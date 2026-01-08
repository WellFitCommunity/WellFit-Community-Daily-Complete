// ============================================================================
// Physician Daily Check-in - Wellness Tracking
// ============================================================================
// Purpose: Quick daily mood/stress tracker for physicians
// Features: Physician-specific stressors, fun medical order format
// ============================================================================

import React, { useState } from 'react';
import { useUser } from '../../contexts/AuthContext';
import { submitDailyCheckin } from '../../services/resilienceHubService';

interface PhysicianDailyCheckinProps {
  onSuccess: () => void;
  onClose: () => void;
}

export const PhysicianDailyCheckin: React.FC<PhysicianDailyCheckinProps> = ({
  onSuccess,
  onClose,
}) => {
  const user = useUser();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    work_setting: 'office',
    stress_level: 5,
    energy_level: 5,
    mood_rating: 5,
    patients_contacted_today: 0,
    difficult_calls: 0,
    overtime_hours: 0,
    felt_overwhelmed: false,
    felt_supported: true,
    missed_break: false,
    notes: '',
    // Physician-specific fields
    prior_auth_frustration: 5,
    clinical_complexity: 5,
    had_lunch: true,
    charting_burden: 5,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.id) {
      setError('User not authenticated');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Combine notes with physician-specific data
      const combinedNotes = `${formData.notes ? formData.notes + ' | ' : ''}Prior Auth Frustration: ${formData.prior_auth_frustration}/10 | Clinical Complexity: ${formData.clinical_complexity}/10 | Had Lunch: ${formData.had_lunch ? 'Yes' : 'No'} | Charting Burden: ${formData.charting_burden}/10`;

      await submitDailyCheckin({
        work_setting: formData.work_setting as 'office' | 'telehealth' | 'hospital_shift' | 'remote' | 'skilled_nursing',
        product_line: 'clarity', // Default to clarity for physicians
        stress_level: formData.stress_level,
        energy_level: formData.energy_level,
        mood_rating: formData.mood_rating,
        patients_contacted_today: formData.patients_contacted_today,
        difficult_patient_calls: formData.difficult_calls,
        overtime_hours: formData.overtime_hours,
        felt_overwhelmed: formData.felt_overwhelmed,
        felt_supported_by_team: formData.felt_supported,
        missed_break: formData.missed_break,
        notes: combinedNotes,
      });

      onSuccess();
    } catch (err) {

      setError(err instanceof Error ? err.message : 'Failed to submit check-in');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl p-6">
      {/* Header with medical order theme */}
      <div className="border-b-2 border-blue-600 pb-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">📋 Dr's Orders: Daily Wellness Check</h2>
            <p className="text-gray-600 mt-1">Quick 60-second self-assessment</p>
            <p className="text-sm text-blue-600 mt-1">
              Rx: Take 1 minute to check in with yourself, daily, for best results
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Work Setting */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            🏥 Work Setting Today
          </label>
          <select
            value={formData.work_setting}
            onChange={(e) => setFormData({ ...formData, work_setting: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="office">Office/Clinic</option>
            <option value="telehealth">Telehealth</option>
            <option value="hospital_shift">Hospital</option>
            <option value="remote">Remote</option>
            <option value="skilled_nursing">Skilled Nursing</option>
          </select>
        </div>

        {/* Core Vitals Section */}
        <div className="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-500">
          <h3 className="font-semibold text-gray-800 mb-3">📊 Your "Vitals" Today (1-10)</h3>

          <div className="space-y-4">
            {/* Stress Level */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-gray-700">
                  😰 Stress Level
                </label>
                <span className="text-lg font-bold text-blue-700">{formData.stress_level}</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={formData.stress_level}
                onChange={(e) => setFormData({ ...formData, stress_level: parseInt(e.target.value) })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>😌 Zen</span>
                <span>😰 Maxed</span>
              </div>
            </div>

            {/* Energy Level */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-gray-700">
                  ⚡ Energy Level
                </label>
                <span className="text-lg font-bold text-green-700">{formData.energy_level}</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={formData.energy_level}
                onChange={(e) => setFormData({ ...formData, energy_level: parseInt(e.target.value) })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>😴 Exhausted</span>
                <span>⚡ Energized</span>
              </div>
            </div>

            {/* Mood */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-gray-700">
                  😊 Mood Rating
                </label>
                <span className="text-lg font-bold text-purple-700">{formData.mood_rating}</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={formData.mood_rating}
                onChange={(e) => setFormData({ ...formData, mood_rating: parseInt(e.target.value) })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>😢 Low</span>
                <span>😄 Great</span>
              </div>
            </div>
          </div>
        </div>

        {/* Physician-Specific Stressors */}
        <div className="bg-orange-50 rounded-lg p-4 border-l-4 border-orange-500">
          <h3 className="font-semibold text-gray-800 mb-3">🩺 Doctor-Specific Check</h3>

          <div className="space-y-4">
            {/* Prior Auth Frustration */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-gray-700">
                  📄 Prior Auth Frustration Level
                </label>
                <span className="text-lg font-bold text-orange-700">{formData.prior_auth_frustration}</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={formData.prior_auth_frustration}
                onChange={(e) => setFormData({ ...formData, prior_auth_frustration: parseInt(e.target.value) })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>😊 Smooth</span>
                <span>🤬 Nightmare</span>
              </div>
            </div>

            {/* Clinical Complexity */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-gray-700">
                  🧠 Clinical Complexity Today
                </label>
                <span className="text-lg font-bold text-red-700">{formData.clinical_complexity}</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={formData.clinical_complexity}
                onChange={(e) => setFormData({ ...formData, clinical_complexity: parseInt(e.target.value) })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-red-600"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>🟢 Routine</span>
                <span>🔴 Complex</span>
              </div>
            </div>

            {/* Charting Burden */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-gray-700">
                  ✍️ Charting Burden
                </label>
                <span className="text-lg font-bold text-indigo-700">{formData.charting_burden}</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={formData.charting_burden}
                onChange={(e) => setFormData({ ...formData, charting_burden: parseInt(e.target.value) })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>📝 Manageable</span>
                <span>📚 Overwhelming</span>
              </div>
            </div>
          </div>
        </div>

        {/* Workload Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              👥 Patients Seen Today
            </label>
            <input
              type="number"
              min="0"
              value={formData.patients_contacted_today}
              onChange={(e) => setFormData({ ...formData, patients_contacted_today: parseInt(e.target.value) || 0 })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ⏰ Overtime Hours
            </label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={formData.overtime_hours}
              onChange={(e) => setFormData({ ...formData, overtime_hours: parseFloat(e.target.value) || 0 })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Yes/No Questions */}
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-sm font-medium text-gray-700">🍽️ Had time for lunch?</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.had_lunch}
                onChange={(e) => setFormData({ ...formData, had_lunch: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-300 peer-focus:outline-hidden peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-sm font-medium text-gray-700">😰 Felt overwhelmed today?</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.felt_overwhelmed}
                onChange={(e) => setFormData({ ...formData, felt_overwhelmed: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-300 peer-focus:outline-hidden peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-sm font-medium text-gray-700">💚 Felt supported by team?</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.felt_supported}
                onChange={(e) => setFormData({ ...formData, felt_supported: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-300 peer-focus:outline-hidden peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
            </label>
          </div>
        </div>

        {/* Optional Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            📝 Notes (Optional)
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Anything else on your mind today?"
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error}
          </div>
        )}

        {/* Submit Buttons */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 px-6 py-3 bg-linear-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {submitting ? 'Submitting...' : '✓ Submit Check-In'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default PhysicianDailyCheckin;
