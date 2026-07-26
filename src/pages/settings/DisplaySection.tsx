/**
 * DisplaySection - Appearance (light/dark/auto) + text size controls
 *
 * Purpose: senior Display settings; both controls apply live so the effect is
 * visible before saving. Persistence happens in SettingsPage's save flow.
 * Used by: SettingsPage
 */
import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { applyFontSize, applyTheme, type FontSize, type Theme } from '../../hooks/useTheme';
import { SettingsSectionProps, sectionLabelClass } from './settingsTypes';

const FONT_PREVIEW: Record<FontSize, string> = {
  small: 'text-sm',
  medium: 'text-base',
  large: 'text-lg',
  'extra-large': 'text-xl',
};

export const DisplaySection: React.FC<SettingsSectionProps> = ({ settings, onChange }) => {
  const { t } = useLanguage();

  const themeOptions: Array<{ value: Theme; label: string; icon: string }> = [
    { value: 'light', label: t.settings.sections.display.themeLight, icon: '☀️' },
    { value: 'dark', label: t.settings.sections.display.themeDark, icon: '🌙' },
    { value: 'auto', label: t.settings.sections.display.themeAuto, icon: '🔄' },
  ];

  const sizeOptions: Array<{ value: FontSize; label: string }> = [
    { value: 'small', label: t.settings.sections.display.small },
    { value: 'medium', label: t.settings.sections.display.medium },
    { value: 'large', label: t.settings.sections.display.large },
    { value: 'extra-large', label: t.settings.sections.display.extraLarge },
  ];

  return (
    <div className="space-y-6">
      <div>
        <label className={sectionLabelClass}>{t.settings.sections.display.theme}</label>
        <p className="text-gray-600 dark:text-slate-400 mb-2">
          {t.settings.sections.display.themeDesc}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {themeOptions.map((option) => (
            <button
              key={option.value}
              onClick={(e) => {
                e.stopPropagation();
                onChange({ theme: option.value });
                applyTheme(option.value);
              }}
              className={`p-4 border-2 rounded-lg text-lg font-semibold transition min-h-[44px] ${
                settings.theme === option.value
                  ? 'border-[#8cc63f] bg-[#8cc63f] text-white'
                  : 'border-gray-300 hover:border-[#8cc63f] dark:border-slate-600 dark:text-slate-100'
              }`}
            >
              <span className="mr-2">{option.icon}</span>
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={sectionLabelClass}>{t.settings.sections.display.textSize}</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {sizeOptions.map((option) => (
            <button
              key={option.value}
              onClick={(e) => {
                e.stopPropagation();
                onChange({ font_size: option.value });
                applyFontSize(option.value);
              }}
              className={`p-3 border-2 rounded-lg ${FONT_PREVIEW[option.value]} font-semibold transition min-h-[44px] ${
                settings.font_size === option.value
                  ? 'border-[#8cc63f] bg-[#8cc63f] text-white'
                  : 'border-gray-300 hover:border-[#8cc63f] dark:border-slate-600 dark:text-slate-100'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DisplaySection;
