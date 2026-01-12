/**
 * ReminderPreferences - User preferences for appointment reminders
 *
 * Purpose: Allow patients to configure their reminder timing and channels
 * Used by: Patient settings, telehealth dashboard
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Bell, MessageSquare, Smartphone, Mail, Clock, Moon } from 'lucide-react';
import {
  AppointmentReminderService,
  type ReminderPreferences as ReminderPrefsType,
  type ReminderPreferencesInput,
} from '../../services/appointmentReminderService';
import { auditLogger } from '../../services/auditLogger';

interface ReminderPreferencesProps {
  userId?: string;
  onSaved?: () => void;
}

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time' },
  { value: 'America/Chicago', label: 'Central Time' },
  { value: 'America/Denver', label: 'Mountain Time' },
  { value: 'America/Los_Angeles', label: 'Pacific Time' },
  { value: 'America/Phoenix', label: 'Arizona Time' },
  { value: 'America/Anchorage', label: 'Alaska Time' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time' },
];

export const ReminderPreferences: React.FC<ReminderPreferencesProps> = ({
  userId,
  onSaved,
}) => {
  const [preferences, setPreferences] = useState<ReminderPrefsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load preferences
  const loadPreferences = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await AppointmentReminderService.getReminderPreferences(userId);
      if (result.success) {
        setPreferences(result.data);
      } else {
        setError(result.error?.message || 'Failed to load preferences');
      }
    } catch (err: unknown) {
      await auditLogger.error(
        'LOAD_REMINDER_PREFERENCES_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { userId }
      );
      setError('Failed to load preferences');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  // Update a single preference
  const updatePreference = async (changes: ReminderPreferencesInput) => {
    if (!preferences) return;

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await AppointmentReminderService.updateReminderPreferences(changes);
      if (result.success) {
        // Update local state
        setPreferences((prev) =>
          prev
            ? {
                ...prev,
                ...Object.fromEntries(
                  Object.entries(changes).filter(([, v]) => v !== undefined)
                ),
              }
            : prev
        );
        setSuccessMessage('Preferences saved');
        setTimeout(() => setSuccessMessage(null), 3000);
        onSaved?.();
      } else {
        setError(result.error?.message || 'Failed to save');
      }
    } catch (err: unknown) {
      await auditLogger.error(
        'UPDATE_REMINDER_PREFERENCES_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { changes }
      );
      setError('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <span className="ml-3 text-gray-600">Loading preferences...</span>
        </div>
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center py-8 text-red-600">
          <p>{error || 'Unable to load preferences'}</p>
          <button
            onClick={loadPreferences}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-3 mb-6">
        <Bell className="w-6 h-6 text-blue-600" />
        <h3 className="text-xl font-bold text-gray-900">Appointment Reminders</h3>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
          {successMessage}
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* Reminder Timing */}
        <div>
          <h4 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            When to Remind Me
          </h4>
          <div className="space-y-3 pl-7">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.reminder24hEnabled}
                onChange={(e) =>
                  updatePreference({ reminder24hEnabled: e.target.checked })
                }
                disabled={saving}
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-gray-700">24 hours before appointment</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.reminder1hEnabled}
                onChange={(e) =>
                  updatePreference({ reminder1hEnabled: e.target.checked })
                }
                disabled={saving}
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-gray-700">1 hour before appointment</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.reminder15mEnabled}
                onChange={(e) =>
                  updatePreference({ reminder15mEnabled: e.target.checked })
                }
                disabled={saving}
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-gray-700">15 minutes before appointment</span>
            </label>
          </div>
        </div>

        {/* Notification Channels */}
        <div>
          <h4 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            How to Notify Me
          </h4>
          <div className="space-y-3 pl-7">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.smsEnabled}
                onChange={(e) => updatePreference({ smsEnabled: e.target.checked })}
                disabled={saving}
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
              />
              <Smartphone className="w-4 h-4 text-gray-500" />
              <span className="text-gray-700">Text message (SMS)</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.pushEnabled}
                onChange={(e) =>
                  updatePreference({ pushEnabled: e.target.checked })
                }
                disabled={saving}
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
              />
              <Bell className="w-4 h-4 text-gray-500" />
              <span className="text-gray-700">Push notification</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.emailEnabled}
                onChange={(e) =>
                  updatePreference({ emailEnabled: e.target.checked })
                }
                disabled={saving}
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
              />
              <Mail className="w-4 h-4 text-gray-500" />
              <span className="text-gray-700">Email</span>
            </label>
          </div>
        </div>

        {/* Do Not Disturb */}
        <div>
          <h4 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Moon className="w-5 h-5" />
            Do Not Disturb
          </h4>
          <p className="text-sm text-gray-600 mb-3 pl-7">
            Set hours when you don't want to receive reminders (e.g., overnight)
          </p>
          <div className="flex items-center gap-4 pl-7">
            <div>
              <label className="block text-sm text-gray-600 mb-1">From</label>
              <input
                type="time"
                value={preferences.dndStartTime || ''}
                onChange={(e) =>
                  updatePreference({ dndStartTime: e.target.value || null })
                }
                disabled={saving}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">To</label>
              <input
                type="time"
                value={preferences.dndEndTime || ''}
                onChange={(e) =>
                  updatePreference({ dndEndTime: e.target.value || null })
                }
                disabled={saving}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            {(preferences.dndStartTime || preferences.dndEndTime) && (
              <button
                onClick={() =>
                  updatePreference({ dndStartTime: null, dndEndTime: null })
                }
                disabled={saving}
                className="mt-6 text-sm text-red-600 hover:text-red-800"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Timezone */}
        <div>
          <h4 className="text-lg font-semibold text-gray-800 mb-3">Timezone</h4>
          <div className="pl-7">
            <select
              value={preferences.timezone}
              onChange={(e) => updatePreference({ timezone: e.target.value })}
              disabled={saving}
              className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Saving indicator */}
      {saving && (
        <div className="mt-4 flex items-center gap-2 text-blue-600">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
          <span className="text-sm">Saving...</span>
        </div>
      )}
    </div>
  );
};

export default ReminderPreferences;
