/**
 * ContactSections - EmergencySection (emergency contact) + PersonalSection
 * (preferred name, timezone)
 *
 * Purpose: senior contact/personal settings (persisted to profiles on save)
 * Used by: SettingsPage
 */
import React from 'react';
import { SettingsSectionProps, inputClass, sectionLabelClass } from './settingsTypes';

export const EmergencySection: React.FC<SettingsSectionProps> = ({ settings, onChange }) => (
  <div className="space-y-4">
    <div>
      <label htmlFor="emergency-contact-name" className={sectionLabelClass}>
        Emergency Contact Name
      </label>
      <input
        id="emergency-contact-name"
        type="text"
        value={settings.emergency_contact_name}
        onChange={(e) => {
          e.stopPropagation();
          onChange({ emergency_contact_name: e.target.value });
        }}
        onClick={(e) => e.stopPropagation()}
        className={inputClass}
        placeholder="Full name of your emergency contact"
      />
    </div>

    <div>
      <label htmlFor="emergency-contact-phone" className={sectionLabelClass}>
        Emergency Contact Phone
      </label>
      <input
        id="emergency-contact-phone"
        type="tel"
        value={settings.emergency_contact_phone}
        onChange={(e) => {
          e.stopPropagation();
          onChange({ emergency_contact_phone: e.target.value });
        }}
        onClick={(e) => e.stopPropagation()}
        className={inputClass}
        placeholder="(555) 123-4567"
      />
    </div>
  </div>
);

const TIMEZONES: Array<{ value: string; label: string }> = [
  { value: 'America/New_York', label: 'Eastern Time' },
  { value: 'America/Chicago', label: 'Central Time' },
  { value: 'America/Denver', label: 'Mountain Time' },
  { value: 'America/Phoenix', label: 'Arizona Time (no DST)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time' },
  { value: 'America/Anchorage', label: 'Alaska Time' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time' },
];

export const PersonalSection: React.FC<SettingsSectionProps> = ({ settings, onChange }) => (
  <div className="space-y-4">
    <div>
      <label htmlFor="preferred-name" className={sectionLabelClass}>
        What would you like us to call you?
      </label>
      <input
        id="preferred-name"
        type="text"
        value={settings.preferred_name}
        onChange={(e) => {
          e.stopPropagation();
          onChange({ preferred_name: e.target.value });
        }}
        onClick={(e) => e.stopPropagation()}
        className={inputClass}
        placeholder="Your preferred name"
      />
    </div>

    <div>
      <label htmlFor="timezone-select" className={sectionLabelClass}>
        Time Zone
      </label>
      <select
        id="timezone-select"
        value={settings.timezone}
        onChange={(e) => {
          e.stopPropagation();
          onChange({ timezone: e.target.value });
        }}
        onClick={(e) => e.stopPropagation()}
        className={inputClass}
      >
        {TIMEZONES.map((tz) => (
          <option key={tz.value} value={tz.value}>
            {tz.label}
          </option>
        ))}
      </select>
    </div>
  </div>
);
