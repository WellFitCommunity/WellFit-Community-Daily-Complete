// src/pages/SettingsPage.tsx - Senior-Friendly Settings (orchestrator)
// Sections live in src/pages/settings/. Loads/saves profiles display prefs;
// theme + text size apply live via hooks/useTheme appliers.
import React, { useState, useEffect } from 'react';
import { useSupabaseClient, useUser } from '../contexts/AuthContext';
import { useBranding } from '../BrandingContext';
import { useNavigate } from 'react-router';
import { Card } from '../components/ui/card';
import LanguageSelector from '../components/LanguageSelector';
import { useLanguage } from '../contexts/LanguageContext';
import SmartBackButton from '../components/ui/SmartBackButton';
import { auditLogger } from '../services/auditLogger';
import { applyFontSize, applyTheme, type FontSize, type Theme } from '../hooks/useTheme';
import { UserSettings } from './settings/settingsTypes';
import DisplaySection from './settings/DisplaySection';
import NotificationsSection from './settings/NotificationsSection';
import { EmergencySection, PersonalSection } from './settings/ContactSections';
import { AccountSection, PrivacySection, SecuritySection } from './settings/AccountSections';

const DEFAULT_SETTINGS: UserSettings = {
  font_size: 'medium',
  theme: 'light',
  notifications_enabled: true,
  emergency_contact_name: '',
  emergency_contact_phone: '',
  preferred_name: '',
  timezone: 'America/New_York',
  daily_reminder_time: '09:00',
  care_team_notifications: true,
  community_notifications: true,
};

const SettingsPage: React.FC = () => {
  const { branding } = useBranding();
  const supabase = useSupabaseClient();
  const user = useUser();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>('display');

  const patchSettings = (patch: Partial<UserSettings>) =>
    setSettings((prev) => ({ ...prev, ...patch }));

  // Load user settings
  useEffect(() => {
    const loadSettings = async () => {
      if (!user?.id) return;

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select(
            'font_size, theme, notifications_enabled, emergency_contact_name, emergency_contact_phone, first_name, timezone, daily_reminder_time, care_team_notifications, community_notifications'
          )
          .eq('user_id', user.id)
          .single();

        if (error) {
          throw new Error(error.message);
        }

        if (profile) {
          setSettings({
            font_size: (profile.font_size as FontSize | null) || 'medium',
            theme: (profile.theme as Theme | null) || 'light',
            notifications_enabled: profile.notifications_enabled ?? true,
            emergency_contact_name: profile.emergency_contact_name || '',
            emergency_contact_phone: profile.emergency_contact_phone || '',
            preferred_name: profile.first_name || '',
            timezone: (profile.timezone as string | null) || 'America/New_York',
            daily_reminder_time: (profile.daily_reminder_time as string | null) || '09:00',
            care_team_notifications: (profile.care_team_notifications as boolean | null) ?? true,
            community_notifications: (profile.community_notifications as boolean | null) ?? true,
          });
        }
      } catch (err: unknown) {
        await auditLogger.error(
          'SETTINGS_LOAD_FAILED',
          err instanceof Error ? err : new Error(String(err)),
          { userId: user.id }
        );
        setMessage({ type: 'error', text: t.settings.saveFailed });
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [user?.id, supabase, t.settings.saveFailed]);

  const saveSettings = async () => {
    if (!user?.id) return;

    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          font_size: settings.font_size,
          theme: settings.theme,
          notifications_enabled: settings.notifications_enabled,
          emergency_contact_name: settings.emergency_contact_name,
          emergency_contact_phone: settings.emergency_contact_phone,
          first_name: settings.preferred_name,
          timezone: settings.timezone,
          daily_reminder_time: settings.daily_reminder_time,
          care_team_notifications: settings.care_team_notifications,
          community_notifications: settings.community_notifications,
        })
        .eq('user_id', user.id);

      if (error) {
        throw new Error(error.message);
      }

      setMessage({ type: 'success', text: t.settings.saveSuccess });

      // Re-apply display prefs so saved state and DOM agree
      applyTheme(settings.theme);
      applyFontSize(settings.font_size);
    } catch (err: unknown) {
      await auditLogger.error(
        'SETTINGS_SAVE_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { userId: user.id }
      );
      setMessage({ type: 'error', text: t.settings.saveFailed });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const settingsSections = [
    {
      id: 'language',
      title: t.settings.sections.language.title,
      icon: '🗣️',
      description: t.settings.sections.language.description,
    },
    {
      id: 'display',
      title: t.settings.sections.display.title,
      icon: '🖥️',
      description: t.settings.sections.display.description,
    },
    {
      id: 'security',
      title: 'Security & Login',
      icon: '🔐',
      description: 'Manage biometric login, caregiver PIN, and security settings',
    },
    {
      id: 'notifications',
      title: t.settings.sections.notifications.title,
      icon: '📱',
      description: t.settings.sections.notifications.description,
    },
    {
      id: 'emergency',
      title: t.settings.sections.emergency.title,
      icon: '📞',
      description: t.settings.sections.emergency.description,
    },
    {
      id: 'personal',
      title: t.settings.sections.personal.title,
      icon: '📝',
      description: t.settings.sections.personal.description,
    },
    {
      id: 'account',
      title: t.settings.sections.account.title,
      icon: '🛡️',
      description: t.settings.sections.account.description,
    },
    {
      id: 'privacy',
      title: 'Privacy & Data',
      icon: '🔒',
      description: 'Control who can access your health data and download your records',
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: branding.gradient }}>
        <div className="min-h-screen dark:bg-slate-950/95">
          <div className="container mx-auto px-4 py-6 max-w-4xl">
            <div className="text-center">
              <div className="text-2xl mb-4">⚙️</div>
              <div className="text-xl dark:text-slate-100">{t.actions.loading}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: branding.gradient }}>
      <div className="min-h-screen dark:bg-slate-950/95">
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          {/* Smart Back Button */}
          <div className="mb-4">
            <SmartBackButton label="Back to Dashboard" />
          </div>

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-[#003865] dark:text-sky-300 mb-4">
              {t.settings.title}
            </h1>
            <p className="text-lg text-gray-600 dark:text-slate-300">{t.settings.subtitle}</p>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-4 bg-[#8cc63f] text-white rounded-lg hover:bg-[#003865] transition text-center"
            >
              <div className="text-2xl mb-2">🏠</div>
              <div className="font-semibold">{t.settings.backToDashboard}</div>
            </button>

            <button
              onClick={saveSettings}
              disabled={saving}
              className="p-4 bg-[#003865] text-white rounded-lg hover:bg-[#8cc63f] transition text-center disabled:opacity-50"
            >
              <div className="text-2xl mb-2">💾</div>
              <div className="font-semibold">
                {saving ? t.settings.saving : t.settings.saveAllSettings}
              </div>
            </button>
          </div>

          {/* Success/Error Message */}
          {message && (
            <div
              className={`mb-6 p-4 rounded-lg text-center font-semibold ${
                message.type === 'success'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Settings Sections */}
          <div className="space-y-4">
            {settingsSections.map((section) => (
              <Card key={section.id}>
                <button
                  onClick={() =>
                    setActiveSection(activeSection === section.id ? null : section.id)
                  }
                  className="w-full p-6 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-800 transition"
                >
                  <div className="flex items-center">
                    <span className="text-3xl mr-4">{section.icon}</span>
                    <div>
                      <h2 className="text-xl font-bold text-[#003865] dark:text-sky-300">
                        {section.title}
                      </h2>
                      <p className="text-gray-600 dark:text-slate-400">{section.description}</p>
                    </div>
                  </div>
                  <span className="text-2xl text-[#8cc63f]">
                    {activeSection === section.id ? '−' : '+'}
                  </span>
                </button>

                {activeSection === section.id && (
                  <div className="px-6 pb-6 space-y-4">
                    {section.id === 'language' && (
                      <div className="space-y-4">
                        <div className="bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-600 rounded-lg p-4 mb-4">
                          <p className="text-[#003865] dark:text-sky-300 font-semibold mb-2">
                            🌍 Select your preferred language
                          </p>
                          <p className="text-gray-600 dark:text-slate-400 text-sm space-y-1">
                            <span className="block">
                              The app will display in your chosen language. Changes take effect
                              immediately.
                            </span>
                            <span className="block">
                              <em>
                                La aplicacion se mostrara en el idioma que elija. Los cambios se
                                aplican inmediatamente.
                              </em>
                            </span>
                            <span className="block">
                              <em>
                                Ung dung se hien thi bang ngon ngu ban chon. Thay doi co hieu luc
                                ngay lap tuc.
                              </em>
                            </span>
                          </p>
                        </div>
                        <LanguageSelector showLabel={true} className="justify-center" />
                      </div>
                    )}

                    {section.id === 'display' && (
                      <DisplaySection settings={settings} onChange={patchSettings} />
                    )}

                    {section.id === 'security' && user && (
                      <SecuritySection user={user} preferredName={settings.preferred_name} />
                    )}

                    {section.id === 'notifications' && (
                      <NotificationsSection settings={settings} onChange={patchSettings} />
                    )}

                    {section.id === 'emergency' && (
                      <EmergencySection settings={settings} onChange={patchSettings} />
                    )}

                    {section.id === 'personal' && (
                      <PersonalSection settings={settings} onChange={patchSettings} />
                    )}

                    {section.id === 'account' && <AccountSection user={user} />}

                    {section.id === 'privacy' && <PrivacySection />}
                  </div>
                )}
              </Card>
            ))}
          </div>

          {/* Save Button (Bottom) */}
          <div className="mt-8 text-center">
            <button
              onClick={saveSettings}
              disabled={saving}
              className="bg-[#8cc63f] text-white px-8 py-4 text-xl font-bold rounded-lg hover:bg-[#003865] transition disabled:opacity-50 shadow-lg"
            >
              {saving ? '💾 Saving Settings...' : '💾 Save All Settings'}
            </button>
          </div>

          {/* Footer Info */}
          <div className="mt-8 text-center text-gray-600 dark:text-slate-400">
            <p className="mb-2">
              Questions about these settings? Call our support team at{' '}
              <a href="tel:1-800-WELLFIT" className="text-[#8cc63f] font-semibold">
                1-800-WELLFIT
              </a>
            </p>
            <p className="text-sm">We're here to help Monday through Friday, 8 AM to 6 PM</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
