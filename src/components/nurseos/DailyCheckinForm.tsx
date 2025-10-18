// ============================================================================
// Daily Check-In Form - Emotional Resilience Hub
// ============================================================================
// Purpose: Quick daily stress/mood/workload tracking for nurses
// Features: 5-slider emotional check-in, optional workload metrics
// Products: Supports both Clarity (community) and Shield (hospital)
// ============================================================================

import React, { useState } from 'react';
import { useSupabaseClient, useUser } from '../../contexts/AuthContext';
import { submitDailyCheckin } from '../../services/resilienceHubService';
import type { DailyCheckinFormData, WorkSetting } from '../../types/nurseos';
import { STRESS_LEVEL_LABELS } from '../../types/nurseos';

interface DailyCheckinFormProps {
  onSuccess?: () => void;
  onClose?: () => void;
  productLine?: 'clarity' | 'shield';
}

export const DailyCheckinForm: React.FC<DailyCheckinFormProps> = ({
  onSuccess,
  onClose,
  productLine = 'clarity',
}) => {
  const supabase = useSupabaseClient();
  const user = useUser();

  // Form state
  const [formData, setFormData] = useState<DailyCheckinFormData>({
    work_setting: 'remote',
    product_line: productLine,
    stress_level: 5,
    energy_level: 5,
    mood_rating: 5,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Handle slider changes
  const handleSliderChange = (field: keyof DailyCheckinFormData, value: number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Handle text/select changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else if (type === 'number') {
      setFormData((prev) => ({ ...prev, [name]: value ? Number(value) : undefined }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      await submitDailyCheckin(formData);
      setSuccessMessage('✅ Check-in saved! Thanks for taking care of yourself.');

      // Call success callback after short delay
      setTimeout(() => {
        if (onSuccess) onSuccess();
        if (onClose) onClose();
      }, 1500);
    } catch (err) {
      console.error('DailyCheckinForm submit error:', err);
      setError(err instanceof Error ? err.message : 'Failed to save check-in. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get stress level emoji
  const getStressEmoji = (level: number): string => {
    const labels = STRESS_LEVEL_LABELS as Record<number, string>;
    return labels[level]?.split(' ')[0] || '😐';
  };

  return (
    <div className="daily-checkin-form bg-white rounded-lg shadow-md p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Daily Emotional Check-In</h2>
        <p className="text-gray-600">How are you feeling today? This quick check-in helps track your wellness over time.</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {successMessage}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Work Setting */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Work Setting Today
          </label>
          <select
            name="work_setting"
            value={formData.work_setting}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          >
            <option value="remote">Remote/Telehealth</option>
            <option value="office">Office</option>
            <option value="home_visits">Home Visits</option>
            <option value="telehealth">Telehealth Only</option>
            <option value="skilled_nursing">Skilled Nursing Facility</option>
            {productLine === 'shield' && <option value="hospital_shift">Hospital Shift</option>}
          </select>
        </div>

        {/* Emotional State - Stress Level */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Stress Level <span className="text-3xl ml-2">{getStressEmoji(formData.stress_level)}</span>
          </label>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 min-w-[120px]">😌 Calm (1)</span>
            <input
              type="range"
              min="1"
              max="10"
              value={formData.stress_level}
              onChange={(e) => handleSliderChange('stress_level', Number(e.target.value))}
              className="flex-1 h-2 bg-gradient-to-r from-green-400 via-yellow-400 to-red-500 rounded-lg appearance-none cursor-pointer"
              style={{
                accentColor: formData.stress_level >= 7 ? '#ef4444' : formData.stress_level >= 5 ? '#f59e0b' : '#10b981'
              }}
            />
            <span className="text-sm text-gray-600 min-w-[120px] text-right">🆘 Crisis (10)</span>
            <span className="text-lg font-bold text-gray-800 min-w-[30px] text-center">{formData.stress_level}</span>
          </div>
        </div>

        {/* Energy Level */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Energy Level {formData.energy_level >= 7 ? '⚡' : formData.energy_level >= 4 ? '🔋' : '🪫'}
          </label>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 min-w-[120px]">🪫 Drained (1)</span>
            <input
              type="range"
              min="1"
              max="10"
              value={formData.energy_level}
              onChange={(e) => handleSliderChange('energy_level', Number(e.target.value))}
              className="flex-1 h-2 bg-gradient-to-r from-red-400 via-yellow-400 to-green-500 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-sm text-gray-600 min-w-[120px] text-right">⚡ Energized (10)</span>
            <span className="text-lg font-bold text-gray-800 min-w-[30px] text-center">{formData.energy_level}</span>
          </div>
        </div>

        {/* Mood Rating */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Overall Mood {formData.mood_rating >= 7 ? '😊' : formData.mood_rating >= 4 ? '😐' : '😔'}
          </label>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 min-w-[120px]">😔 Terrible (1)</span>
            <input
              type="range"
              min="1"
              max="10"
              value={formData.mood_rating}
              onChange={(e) => handleSliderChange('mood_rating', Number(e.target.value))}
              className="flex-1 h-2 bg-gradient-to-r from-red-400 via-yellow-400 to-green-500 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-sm text-gray-600 min-w-[120px] text-right">😊 Excellent (10)</span>
            <span className="text-lg font-bold text-gray-800 min-w-[30px] text-center">{formData.mood_rating}</span>
          </div>
        </div>

        {/* Workload Metrics - Clarity Product */}
        {productLine === 'clarity' && (
          <div className="border-t border-gray-200 pt-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Workload (Optional)</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Patients Contacted Today
                </label>
                <input
                  type="number"
                  name="patients_contacted_today"
                  min="0"
                  value={formData.patients_contacted_today || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="# of patients"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Difficult/Draining Calls
                </label>
                <input
                  type="number"
                  name="difficult_patient_calls"
                  min="0"
                  value={formData.difficult_patient_calls || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="# of difficult calls"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prior Auth Denials
                </label>
                <input
                  type="number"
                  name="prior_auth_denials"
                  min="0"
                  value={formData.prior_auth_denials || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="# of denials"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Overtime Hours
                </label>
                <input
                  type="number"
                  name="overtime_hours"
                  min="0"
                  step="0.5"
                  value={formData.overtime_hours || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Hours beyond shift"
                />
              </div>
            </div>
          </div>
        )}

        {/* Support Indicators */}
        <div className="border-t border-gray-200 pt-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Support & Self-Care</h3>

          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="felt_overwhelmed"
                checked={formData.felt_overwhelmed || false}
                onChange={handleChange}
                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-700">I felt overwhelmed today</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="missed_break"
                checked={formData.missed_break || false}
                onChange={handleChange}
                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-700">I skipped lunch or breaks</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="felt_supported_by_team"
                checked={formData.felt_supported_by_team || false}
                onChange={handleChange}
                className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-2 focus:ring-green-500"
              />
              <span className="text-gray-700">I felt supported by my team</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="after_hours_work"
                checked={formData.after_hours_work || false}
                onChange={handleChange}
                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-700">I worked after hours (charting, calls, etc.)</span>
            </label>
          </div>
        </div>

        {/* Optional Notes */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Additional Notes (Optional)
          </label>
          <textarea
            name="notes"
            value={formData.notes || ''}
            onChange={handleChange}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="Anything else on your mind? This is private."
          />
        </div>

        {/* Submit Buttons */}
        <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {isSubmitting ? 'Saving...' : 'Save Check-In'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default DailyCheckinForm;
