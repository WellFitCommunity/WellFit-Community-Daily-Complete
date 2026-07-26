/**
 * NotificationsSection - notification toggles + daily reminder time
 *
 * Purpose: senior notification preferences (persisted to profiles on save)
 * Used by: SettingsPage
 */
import React from 'react';
import { SettingsSectionProps, UserSettings, inputClass, sectionLabelClass } from './settingsTypes';

interface ToggleRowProps {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}

const ToggleRow: React.FC<ToggleRowProps> = ({ label, description, enabled, onToggle }) => (
  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
    <div>
      <div className="font-semibold text-[#003865] dark:text-sky-300">{label}</div>
      <div className="text-gray-600 dark:text-slate-400">{description}</div>
    </div>
    <button
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`relative w-16 h-8 rounded-full transition-colors ${
        enabled ? 'bg-[#8cc63f]' : 'bg-gray-300 dark:bg-slate-600'
      }`}
    >
      <div
        className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform ${
          enabled ? 'translate-x-9' : 'translate-x-1'
        }`}
      />
    </button>
  </div>
);

export const NotificationsSection: React.FC<SettingsSectionProps> = ({ settings, onChange }) => {
  const toggles: Array<{ key: keyof UserSettings; label: string; description: string }> = [
    {
      key: 'notifications_enabled',
      label: 'All Notifications',
      description: 'Enable or disable all notifications',
    },
    {
      key: 'care_team_notifications',
      label: 'Care Team Messages',
      description: 'Messages from your care team',
    },
    {
      key: 'community_notifications',
      label: 'Community Updates',
      description: 'New photos and community events',
    },
  ];

  return (
    <div className="space-y-4">
      {toggles.map(({ key, label, description }) => (
        <ToggleRow
          key={key}
          label={label}
          description={description}
          enabled={Boolean(settings[key])}
          onToggle={() => onChange({ [key]: !settings[key] })}
        />
      ))}

      <div>
        <label htmlFor="daily-reminder-time" className={sectionLabelClass}>
          Daily Check-in Reminder Time
        </label>
        <input
          id="daily-reminder-time"
          type="time"
          value={settings.daily_reminder_time}
          onChange={(e) => {
            e.stopPropagation();
            onChange({ daily_reminder_time: e.target.value });
          }}
          onClick={(e) => e.stopPropagation()}
          className={inputClass}
        />
      </div>
    </div>
  );
};

export default NotificationsSection;
