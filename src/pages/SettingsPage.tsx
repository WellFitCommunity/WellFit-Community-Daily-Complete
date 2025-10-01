// src/pages/SettingsPage.tsx - Senior-Friendly Settings
import React, { useState, useEffect } from 'react';
import { useSupabaseClient, useUser } from '../contexts/AuthContext';
import { useBranding } from '../BrandingContext';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/card';
import LanguageSelector from '../components/LanguageSelector';
import { useLanguage } from '../contexts/LanguageContext';
import SmartBackButton from '../components/ui/SmartBackButton';

interface UserSettings {
  font_size: 'small' | 'medium' | 'large' | 'extra-large';
  notifications_enabled: boolean;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  preferred_name: string;
  timezone: string;
  daily_reminder_time: string;
  care_team_notifications: boolean;
  community_notifications: boolean;
}

const SettingsPage: React.FC = () => {
  const { branding } = useBranding();
  const supabase = useSupabaseClient();
  const user = useUser();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [settings, setSettings] = useState<UserSettings>({
    font_size: 'medium',
    notifications_enabled: true,
    emergency_contact_name: '',
    emergency_contact_phone: '',
    preferred_name: '',
    timezone: 'America/New_York',
    daily_reminder_time: '09:00',
    care_team_notifications: true,
    community_notifications: true,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>('display');

  // Load user settings
  useEffect(() => {
    const loadSettings = async () => {
      if (!user?.id) return;

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profile) {
          setSettings({
            font_size: profile.font_size || 'medium',
            notifications_enabled: profile.notifications_enabled ?? true,
            emergency_contact_name: profile.caregiver_first_name + ' ' + profile.caregiver_last_name || '',
            emergency_contact_phone: profile.caregiver_phone || '',
            preferred_name: profile.first_name || '',
            timezone: profile.timezone || 'America/New_York',
            daily_reminder_time: profile.daily_reminder_time || '09:00',
            care_team_notifications: profile.care_team_notifications ?? true,
            community_notifications: profile.community_notifications ?? true,
          });
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [user?.id, supabase]);

  const saveSettings = async () => {
    if (!user?.id) return;

    setSaving(true);
    setMessage(null);

    try {
      const [firstName, ...lastNameParts] = settings.emergency_contact_name.split(' ');
      const lastName = lastNameParts.join(' ');

      const { error } = await supabase
        .from('profiles')
        .update({
          font_size: settings.font_size,
          notifications_enabled: settings.notifications_enabled,
          caregiver_first_name: firstName || '',
          caregiver_last_name: lastName || '',
          caregiver_phone: settings.emergency_contact_phone,
          first_name: settings.preferred_name,
          timezone: settings.timezone,
          daily_reminder_time: settings.daily_reminder_time,
          care_team_notifications: settings.care_team_notifications,
          community_notifications: settings.community_notifications,
        })
        .eq('id', user.id);

      if (error) throw error;

      setMessage({ type: 'success', text: t.settings.saveSuccess });
      
      // Apply font size immediately
      document.documentElement.style.fontSize = 
        settings.font_size === 'small' ? '14px' :
        settings.font_size === 'large' ? '18px' :
        settings.font_size === 'extra-large' ? '22px' : '16px';

    } catch (error: any) {
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
      description: t.settings.sections.language.description
    },
    {
      id: 'display',
      title: t.settings.sections.display.title,
      icon: '🖥️',
      description: t.settings.sections.display.description
    },
    {
      id: 'notifications',
      title: t.settings.sections.notifications.title,
      icon: '📱',
      description: t.settings.sections.notifications.description
    },
    {
      id: 'emergency',
      title: t.settings.sections.emergency.title,
      icon: '📞',
      description: t.settings.sections.emergency.description
    },
    {
      id: 'personal',
      title: t.settings.sections.personal.title,
      icon: '📝',
      description: t.settings.sections.personal.description
    },
    {
      id: 'account',
      title: t.settings.sections.account.title,
      icon: '🛡️',
      description: t.settings.sections.account.description
    }
  ];

  if (loading) {
    return (
      <div
        className="min-h-screen"
        style={{ background: branding.gradient }}
      >
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          <div className="text-center">
            <div className="text-2xl mb-4">⚙️</div>
            <div className="text-xl">{t.actions.loading}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: branding.gradient }}
    >
      <div className="container mx-auto px-4 py-6 max-w-4xl">

        {/* Smart Back Button */}
        <div className="mb-4">
          <SmartBackButton label="Back to Dashboard" />
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#003865] mb-4">
            {t.settings.title}
          </h1>
          <p className="text-lg text-gray-600">
            {t.settings.subtitle}
          </p>
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
            <div className="font-semibold">{saving ? t.settings.saving : t.settings.saveAllSettings}</div>
          </button>
        </div>

        {/* Success/Error Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg text-center font-semibold ${
            message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {message.text}
          </div>
        )}

        {/* Settings Sections */}
        <div className="space-y-4">
          {settingsSections.map((section) => (
            <Card key={section.id}>
              <button
                onClick={() => setActiveSection(activeSection === section.id ? null : section.id)}
                className="w-full p-6 text-left flex items-center justify-between hover:bg-gray-50 transition"
              >
                <div className="flex items-center">
                  <span className="text-3xl mr-4">{section.icon}</span>
                  <div>
                    <h2 className="text-xl font-bold text-[#003865]">{section.title}</h2>
                    <p className="text-gray-600">{section.description}</p>
                  </div>
                </div>
                <span className="text-2xl text-[#8cc63f]">
                  {activeSection === section.id ? '−' : '+'}
                </span>
              </button>
              
              {activeSection === section.id && (
                <div className="px-6 pb-6 space-y-4">

                  {/* Language Settings */}
                  {section.id === 'language' && (
                    <div className="space-y-4">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                        <p className="text-[#003865] font-semibold mb-2">
                          🌍 Select your preferred language / Seleccione su idioma preferido
                        </p>
                        <p className="text-gray-600 text-sm">
                          The app will display in your chosen language. Changes take effect immediately.
                          <br />
                          <em>La aplicación se mostrará en el idioma que elija. Los cambios se aplican inmediatamente.</em>
                        </p>
                      </div>
                      <LanguageSelector showLabel={true} className="justify-center" />
                    </div>
                  )}

                  {/* Display Settings */}
                  {section.id === 'display' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-lg font-semibold text-[#003865] mb-2">
                          Text Size
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {[
                            { value: 'small', label: 'Small', size: 'text-sm' },
                            { value: 'medium', label: 'Medium', size: 'text-base' },
                            { value: 'large', label: 'Large', size: 'text-lg' },
                            { value: 'extra-large', label: 'Extra Large', size: 'text-xl' }
                          ].map((option) => (
                            <button
                              key={option.value}
                              onClick={() => setSettings({ ...settings, font_size: option.value as any })}
                              className={`p-3 border-2 rounded-lg ${option.size} font-semibold transition ${
                                settings.font_size === option.value
                                  ? 'border-[#8cc63f] bg-[#8cc63f] text-white'
                                  : 'border-gray-300 hover:border-[#8cc63f]'
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Notification Settings */}
                  {section.id === 'notifications' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-semibold text-[#003865]">All Notifications</div>
                          <div className="text-gray-600">Enable or disable all notifications</div>
                        </div>
                        <button
                          onClick={() => setSettings({ ...settings, notifications_enabled: !settings.notifications_enabled })}
                          className={`w-16 h-8 rounded-full transition ${
                            settings.notifications_enabled ? 'bg-[#8cc63f]' : 'bg-gray-300'
                          }`}
                        >
                          <div className={`w-6 h-6 bg-white rounded-full transition-transform ${
                            settings.notifications_enabled ? 'translate-x-9' : 'translate-x-1'
                          }`} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-semibold text-[#003865]">Care Team Messages</div>
                          <div className="text-gray-600">Messages from your care team</div>
                        </div>
                        <button
                          onClick={() => setSettings({ ...settings, care_team_notifications: !settings.care_team_notifications })}
                          className={`w-16 h-8 rounded-full transition ${
                            settings.care_team_notifications ? 'bg-[#8cc63f]' : 'bg-gray-300'
                          }`}
                        >
                          <div className={`w-6 h-6 bg-white rounded-full transition-transform ${
                            settings.care_team_notifications ? 'translate-x-9' : 'translate-x-1'
                          }`} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-semibold text-[#003865]">Community Updates</div>
                          <div className="text-gray-600">New photos and community events</div>
                        </div>
                        <button
                          onClick={() => setSettings({ ...settings, community_notifications: !settings.community_notifications })}
                          className={`w-16 h-8 rounded-full transition ${
                            settings.community_notifications ? 'bg-[#8cc63f]' : 'bg-gray-300'
                          }`}
                        >
                          <div className={`w-6 h-6 bg-white rounded-full transition-transform ${
                            settings.community_notifications ? 'translate-x-9' : 'translate-x-1'
                          }`} />
                        </button>
                      </div>

                      <div>
                        <label className="block text-lg font-semibold text-[#003865] mb-2">
                          Daily Check-in Reminder Time
                        </label>
                        <input
                          type="time"
                          value={settings.daily_reminder_time}
                          onChange={(e) => setSettings({ ...settings, daily_reminder_time: e.target.value })}
                          className="w-full p-3 text-lg border-2 border-gray-300 rounded-lg focus:border-[#8cc63f] focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* Emergency Contacts */}
                  {section.id === 'emergency' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-lg font-semibold text-[#003865] mb-2">
                          Emergency Contact Name
                        </label>
                        <input
                          type="text"
                          value={settings.emergency_contact_name}
                          onChange={(e) => setSettings({ ...settings, emergency_contact_name: e.target.value })}
                          className="w-full p-3 text-lg border-2 border-gray-300 rounded-lg focus:border-[#8cc63f] focus:outline-none"
                          placeholder="Full name of your emergency contact"
                        />
                      </div>

                      <div>
                        <label className="block text-lg font-semibold text-[#003865] mb-2">
                          Emergency Contact Phone
                        </label>
                        <input
                          type="tel"
                          value={settings.emergency_contact_phone}
                          onChange={(e) => setSettings({ ...settings, emergency_contact_phone: e.target.value })}
                          className="w-full p-3 text-lg border-2 border-gray-300 rounded-lg focus:border-[#8cc63f] focus:outline-none"
                          placeholder="(555) 123-4567"
                        />
                      </div>
                    </div>
                  )}

                  {/* Personal Information */}
                  {section.id === 'personal' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-lg font-semibold text-[#003865] mb-2">
                          What would you like us to call you?
                        </label>
                        <input
                          type="text"
                          value={settings.preferred_name}
                          onChange={(e) => setSettings({ ...settings, preferred_name: e.target.value })}
                          className="w-full p-3 text-lg border-2 border-gray-300 rounded-lg focus:border-[#8cc63f] focus:outline-none"
                          placeholder="Your preferred name"
                        />
                      </div>

                      <div>
                        <label className="block text-lg font-semibold text-[#003865] mb-2">
                          Time Zone
                        </label>
                        <select
                          value={settings.timezone}
                          onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                          className="w-full p-3 text-lg border-2 border-gray-300 rounded-lg focus:border-[#8cc63f] focus:outline-none"
                        >
                          <option value="America/New_York">Eastern Time</option>
                          <option value="America/Chicago">Central Time</option>
                          <option value="America/Denver">Mountain Time</option>
                          <option value="America/Los_Angeles">Pacific Time</option>
                          <option value="America/Anchorage">Alaska Time</option>
                          <option value="Pacific/Honolulu">Hawaii Time</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Account Security */}
                  {section.id === 'account' && (
                    <div className="space-y-4">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <h3 className="font-semibold text-[#003865] mb-2">Password Security</h3>
                        <p className="text-gray-700 mb-4">
                          Keep your account secure by using a strong password and changing it regularly.
                        </p>
                        <button
                          onClick={() => navigate('/change-password')}
                          className="bg-[#003865] text-white px-6 py-3 rounded-lg hover:bg-[#8cc63f] transition font-semibold"
                        >
                          🔒 Change Password
                        </button>
                      </div>

                      <div className="bg-yellow-50 p-4 rounded-lg">
                        <h3 className="font-semibold text-[#003865] mb-2">Account Information</h3>
                        <p className="text-gray-700 mb-2">
                          <strong>Email:</strong> {user?.email}
                        </p>
                        <p className="text-gray-700 mb-4">
                          <strong>Account Created:</strong> {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
                        </p>
                      </div>

                      <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                        <h3 className="font-semibold text-red-800 mb-2">⚠️ Need Help?</h3>
                        <p className="text-red-700 mb-4">
                          If you're having trouble with your account or need to make changes, our support team is here to help.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <a
                            href="tel:1-800-WELLFIT"
                            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition text-center"
                          >
                            📞 Call Support
                          </a>
                          <button
                            onClick={() => navigate('/help')}
                            className="bg-[#003865] text-white px-4 py-2 rounded-lg hover:bg-[#8cc63f] transition"
                          >
                            📚 View Help Center
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

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
        <div className="mt-8 text-center text-gray-600">
          <p className="mb-2">
            Questions about these settings? Call our support team at{' '}
            <a href="tel:1-800-WELLFIT" className="text-[#8cc63f] font-semibold">1-800-WELLFIT</a>
          </p>
          <p className="text-sm">
            We're here to help Monday through Friday, 8 AM to 6 PM
          </p>
        </div>

      </div>
    </div>
  );
};

export default SettingsPage;