/**
 * Shared types for the senior Settings page and its section components.
 */
import type { FontSize, Theme } from '../../hooks/useTheme';

export interface UserSettings {
  font_size: FontSize;
  theme: Theme;
  notifications_enabled: boolean;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  preferred_name: string;
  timezone: string;
  daily_reminder_time: string;
  care_team_notifications: boolean;
  community_notifications: boolean;
}

export interface SettingsSectionProps {
  settings: UserSettings;
  onChange: (patch: Partial<UserSettings>) => void;
}

/** Senior-friendly labeled input styling shared across sections. */
export const inputClass =
  'w-full p-3 text-lg border-2 border-gray-300 rounded-lg focus:border-[#8cc63f] focus:outline-hidden ' +
  'dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100';

export const sectionLabelClass =
  'block text-lg font-semibold text-[#003865] dark:text-sky-300 mb-2';
