/**
 * Notification Settings Component
 *
 * Modal for configuring SOC notification preferences.
 * Includes sound settings, browser notifications, and severity filters.
 */

import React, { useState } from 'react';
import {
  SOCNotificationPreferences,
  UpdateNotificationPreferences,
  SoundType,
  SOUND_FILES,
} from '../../types/socDashboard';
import { EAButton } from '../envision-atlus/EAButton';
import { EASwitch } from '../envision-atlus/EASwitch';

interface NotificationSettingsProps {
  preferences: SOCNotificationPreferences;
  onSave: (prefs: UpdateNotificationPreferences) => Promise<void>;
  onClose: () => void;
}

export const NotificationSettings: React.FC<NotificationSettingsProps> = ({
  preferences,
  onSave,
  onClose,
}) => {
  const [saving, setSaving] = useState(false);
  const [localPrefs, setLocalPrefs] = useState<UpdateNotificationPreferences>({
    sound_enabled: preferences.sound_enabled,
    browser_notifications_enabled: preferences.browser_notifications_enabled,
    desktop_notifications_enabled: preferences.desktop_notifications_enabled,
    notify_on_critical: preferences.notify_on_critical,
    notify_on_high: preferences.notify_on_high,
    notify_on_medium: preferences.notify_on_medium,
    notify_on_low: preferences.notify_on_low,
    notify_on_escalation: preferences.notify_on_escalation,
    notify_on_new_message: preferences.notify_on_new_message,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(localPrefs);
    } finally {
      setSaving(false);
    }
  };

  const updatePref = <K extends keyof UpdateNotificationPreferences>(
    key: K,
    value: UpdateNotificationPreferences[K]
  ) => {
    setLocalPrefs((prev) => ({ ...prev, [key]: value }));
  };

  const testSound = (sound: SoundType) => {
    if (sound === 'none' || !SOUND_FILES[sound]) return;
    const audio = new Audio(SOUND_FILES[sound]);
    audio.volume = 0.7;
    audio.play().catch(() => {
      // Silently fail
    });
  };

  const requestNotificationPermission = async () => {
    if (typeof Notification === 'undefined') {
      alert('Browser notifications are not supported in this browser.');
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      updatePref('browser_notifications_enabled', true);
    }
  };

  const notificationPermission =
    typeof Notification !== 'undefined' ? Notification.permission : 'denied';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg w-full max-w-lg border border-slate-700 shadow-xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Notification Settings</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Sound Settings */}
          <section>
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">
              Sound Alerts
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-white">Enable sound alerts</span>
                <EASwitch
                  checked={localPrefs.sound_enabled ?? false}
                  onCheckedChange={(checked) => updatePref('sound_enabled', checked)}
                />
              </div>

              {localPrefs.sound_enabled && (
                <div className="space-y-2 pl-4 border-l-2 border-slate-700">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Critical alerts</span>
                    <button
                      onClick={() => testSound('alarm')}
                      className="text-teal-400 hover:text-teal-300"
                    >
                      Test Sound
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">High alerts</span>
                    <button
                      onClick={() => testSound('alert')}
                      className="text-teal-400 hover:text-teal-300"
                    >
                      Test Sound
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Medium alerts</span>
                    <button
                      onClick={() => testSound('notification')}
                      className="text-teal-400 hover:text-teal-300"
                    >
                      Test Sound
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Low alerts</span>
                    <button
                      onClick={() => testSound('soft')}
                      className="text-teal-400 hover:text-teal-300"
                    >
                      Test Sound
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Browser Notifications */}
          <section>
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">
              Browser Notifications
            </h3>
            <div className="space-y-4">
              {notificationPermission !== 'granted' ? (
                <div className="bg-slate-700 rounded-lg p-4">
                  <p className="text-sm text-slate-300 mb-3">
                    Enable browser notifications to receive alerts even when this tab isn&apos;t
                    focused.
                  </p>
                  <EAButton variant="primary" size="sm" onClick={requestNotificationPermission}>
                    Enable Notifications
                  </EAButton>
                  {notificationPermission === 'denied' && (
                    <p className="text-xs text-red-400 mt-2">
                      Notifications are blocked. Please enable them in your browser settings.
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-white">Enable browser notifications</span>
                    <EASwitch
                      checked={localPrefs.browser_notifications_enabled ?? false}
                      onCheckedChange={(checked) => updatePref('browser_notifications_enabled', checked)}
                    />
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Notification Filters */}
          <section>
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">
              Alert Types
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-red-500">&#x25CF;</span>
                  <span className="text-white">Critical alerts</span>
                </div>
                <EASwitch
                  checked={localPrefs.notify_on_critical ?? false}
                  onCheckedChange={(checked) => updatePref('notify_on_critical', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-orange-500">&#x25CF;</span>
                  <span className="text-white">High alerts</span>
                </div>
                <EASwitch
                  checked={localPrefs.notify_on_high ?? false}
                  onCheckedChange={(checked) => updatePref('notify_on_high', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-yellow-500">&#x25CF;</span>
                  <span className="text-white">Medium alerts</span>
                </div>
                <EASwitch
                  checked={localPrefs.notify_on_medium ?? false}
                  onCheckedChange={(checked) => updatePref('notify_on_medium', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-green-500">&#x25CF;</span>
                  <span className="text-white">Low alerts</span>
                </div>
                <EASwitch
                  checked={localPrefs.notify_on_low ?? false}
                  onCheckedChange={(checked) => updatePref('notify_on_low', checked)}
                />
              </div>
            </div>
          </section>

          {/* Other Notifications */}
          <section>
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">
              Other Notifications
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-white">Alert escalations</span>
                <EASwitch
                  checked={localPrefs.notify_on_escalation ?? false}
                  onCheckedChange={(checked) => updatePref('notify_on_escalation', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white">New team messages</span>
                <EASwitch
                  checked={localPrefs.notify_on_new_message ?? false}
                  onCheckedChange={(checked) => updatePref('notify_on_new_message', checked)}
                />
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700 flex justify-end gap-3">
          <EAButton variant="secondary" onClick={onClose}>
            Cancel
          </EAButton>
          <EAButton variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </EAButton>
        </div>
      </div>
    </div>
  );
};

export default NotificationSettings;
