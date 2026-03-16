import React, { useState, useEffect, memo, useCallback } from 'react';
import { useDashboardTheme } from '../../hooks/useDashboardTheme';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { useSupabaseClient, useUser } from '../../contexts/AuthContext';

interface AdminSettings {
  theme: 'light' | 'dark' | 'auto';
  notifications: {
    email: boolean;
    browser: boolean;
    emergencyAlerts: boolean;
  };
  security: {
    sessionTimeout: number;
    requirePinForSensitive: boolean;
  };
  display: {
    compactMode: boolean;
    showAdvancedMetrics: boolean;
    defaultDashboardView: 'overview' | 'patients' | 'billing';
  };
  system: {
    enableBetaFeatures: boolean;
  };
}

const AdminSettingsPanel: React.FC = memo(() => {
  const { theme } = useDashboardTheme();
  const { adminRole } = useAdminAuth();
  const supabase = useSupabaseClient();
  const user = useUser();

  const [settings, setSettings] = useState<AdminSettings>({
    theme: 'light',
    notifications: {
      email: true,
      browser: true,
      emergencyAlerts: true,
    },
    security: {
      sessionTimeout: 30,
      requirePinForSensitive: true,
    },
    display: {
      compactMode: false,
      showAdvancedMetrics: true,
      defaultDashboardView: 'overview',
    },
    system: {
      enableBetaFeatures: false,
    },
  });

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Load settings from database
  useEffect(() => {
    const loadSettings = async () => {
      if (!user?.id) return;

      try {
        const { data, error } = await supabase
          .from('admin_settings')
          .select('user_id, theme, email_notifications, browser_notifications, emergency_alerts, session_timeout, require_pin_for_sensitive, compact_mode, show_advanced_metrics, default_dashboard_view, enable_beta_features')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          // Log error but continue with defaults
          return;
        }

        if (data) {
          const loadedTheme = data.theme || 'light';

          // Sync database theme to localStorage and apply immediately
          localStorage.setItem('admin_theme', loadedTheme);
          if (loadedTheme === 'dark') {
            document.documentElement.classList.add('dark');
          } else if (loadedTheme === 'light') {
            document.documentElement.classList.remove('dark');
          } else {
            // Auto mode
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (prefersDark) {
              document.documentElement.classList.add('dark');
            } else {
              document.documentElement.classList.remove('dark');
            }
          }
          // Dispatch storage event so AdminHeader syncs
          window.dispatchEvent(new StorageEvent('storage', {
            key: 'admin_theme',
            newValue: loadedTheme,
          }));

          setSettings({
            theme: loadedTheme,
            notifications: {
              email: data.email_notifications ?? true,
              browser: data.browser_notifications ?? true,
              emergencyAlerts: data.emergency_alerts ?? true,
            },
            security: {
              sessionTimeout: data.session_timeout || 30,
              requirePinForSensitive: data.require_pin_for_sensitive ?? true,
            },
            display: {
              compactMode: data.compact_mode ?? false,
              showAdvancedMetrics: data.show_advanced_metrics ?? true,
              defaultDashboardView: data.default_dashboard_view || 'overview',
            },
            system: {
              enableBetaFeatures: data.enable_beta_features ?? false,
            },
          });
        }
      } catch (error: unknown) {

      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [user?.id, supabase]);

  // Apply theme changes and save to localStorage
  useEffect(() => {
    const applyTheme = (theme: string) => {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else if (theme === 'light') {
        document.documentElement.classList.remove('dark');
      } else {
        // Auto mode - check system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
      localStorage.setItem('admin_theme', theme);
      // Dispatch storage event so other components (AdminHeader) sync immediately
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'admin_theme',
        newValue: theme,
      }));
    };

    applyTheme(settings.theme);
  }, [settings.theme]);

  const saveSettings = async () => {
    if (!user?.id) return;

    setSaving(true);
    try {
      // Prepare settings data for database
      const settingsData = {
        user_id: user.id,
        theme: settings.theme,
        email_notifications: settings.notifications.email,
        browser_notifications: settings.notifications.browser,
        emergency_alerts: settings.notifications.emergencyAlerts,
        session_timeout: settings.security.sessionTimeout,
        require_pin_for_sensitive: settings.security.requirePinForSensitive,
        enable_audit_logging: true, // Always on — HIPAA § 164.312(b) requires audit controls
        compact_mode: settings.display.compactMode,
        show_advanced_metrics: settings.display.showAdvancedMetrics,
        default_dashboard_view: settings.display.defaultDashboardView,
        auto_backup: true, // Managed by Supabase Pro — always on
        backup_frequency: 'daily', // Managed by Supabase Pro
        enable_beta_features: settings.system.enableBetaFeatures,
      };

      // Use upsert to insert or update
      const { error } = await supabase
        .from('admin_settings')
        .upsert(settingsData, { onConflict: 'user_id' });

      if (error) {

        alert('Failed to save settings. Please try again.');
        return;
      }

      setLastSaved(new Date());

    } catch (error: unknown) {

      alert('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = useCallback((section: keyof AdminSettings, key: string, value: string | number | boolean) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...(prev[section] as Record<string, string | number | boolean>),
        [key]: value,
      },
    }));
  }, []);

  const resetToDefaults = () => {
    if (window.confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
      setSettings({
        theme: 'light',
        notifications: {
          email: true,
          browser: true,
          emergencyAlerts: true,
        },
        security: {
          sessionTimeout: 30,
          requirePinForSensitive: true,
        },
        display: {
          compactMode: false,
          showAdvancedMetrics: true,
          defaultDashboardView: 'overview',
        },
        system: {
          enableBetaFeatures: false,
        },
      });
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="bg-white rounded-lg shadow-xs border border-gray-200 p-6 text-center">
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6" aria-label="Admin Settings Panel">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-xs border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Settings</h1>
            <p className="text-gray-600 mt-1">Customize your admin panel experience and system preferences</p>
          </div>
          <div className="flex items-center space-x-3">
            {lastSaved && (
              <span className="text-sm text-gray-500">
                Last saved: {lastSaved.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={resetToDefaults}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium"
            >
              Reset to Defaults
            </button>
            <button
              onClick={saveSettings}
              disabled={saving}
              className={`px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium ${theme.buttonPrimary}`}
            >
              {saving ? 'Applying...' : 'Apply Settings'}
            </button>
          </div>
        </div>
      </div>

      {/* Theme Settings */}
      <div className="bg-white rounded-lg shadow-xs border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <span className="mr-2">🎨</span>
          Appearance
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Theme</label>
            <div className="grid grid-cols-3 gap-3">
              {(['light', 'dark', 'auto'] as const).map((themeOption) => (
                <button
                  key={themeOption}
                  onClick={() => setSettings(prev => ({ ...prev, theme: themeOption }))}
                  className={`p-3 border rounded-lg text-sm font-medium capitalize transition-colors ${
                    settings.theme === themeOption
                      ? 'border-[var(--ea-primary,#00857a)] bg-[var(--ea-primary,#00857a)]/5 text-[var(--ea-primary,#00857a)]'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {themeOption === 'light' && '☀️'} {themeOption === 'dark' && '🌙'} {themeOption === 'auto' && '🔄'} {themeOption}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.display.compactMode}
                onChange={(e) => updateSetting('display', 'compactMode', e.target.checked)}
                className="rounded-sm border-gray-300 text-[var(--ea-primary,#00857a)] focus-visible:ring-[var(--ea-primary,#00857a)]"
              />
              <span className="ml-2 text-sm text-gray-700">Compact mode</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.display.showAdvancedMetrics}
                onChange={(e) => updateSetting('display', 'showAdvancedMetrics', e.target.checked)}
                className="rounded-sm border-gray-300 text-[var(--ea-primary,#00857a)] focus-visible:ring-[var(--ea-primary,#00857a)]"
              />
              <span className="ml-2 text-sm text-gray-700">Show advanced metrics</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Default Dashboard View</label>
            <select
              value={settings.display.defaultDashboardView}
              onChange={(e) => updateSetting('display', 'defaultDashboardView', e.target.value)}
              className="block w-full border-gray-300 rounded-md focus-visible:ring-[var(--ea-primary,#00857a)] focus-visible:border-[var(--ea-primary,#00857a)]"
            >
              <option value="overview">Overview</option>
              <option value="patients">Patients</option>
              <option value="billing">Billing</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-white rounded-lg shadow-xs border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <span className="mr-2">🔔</span>
          Notifications
        </h2>
        <div className="space-y-4">
          <label className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-700">Email notifications</span>
              <p className="text-xs text-gray-500">Receive admin alerts via email</p>
            </div>
            <input
              type="checkbox"
              checked={settings.notifications.email}
              onChange={(e) => updateSetting('notifications', 'email', e.target.checked)}
              className="rounded-sm border-gray-300 text-[var(--ea-primary,#00857a)] focus-visible:ring-[var(--ea-primary,#00857a)]"
            />
          </label>

          <label className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-700">Browser notifications</span>
              <p className="text-xs text-gray-500">Show desktop notifications</p>
            </div>
            <input
              type="checkbox"
              checked={settings.notifications.browser}
              onChange={(e) => updateSetting('notifications', 'browser', e.target.checked)}
              className="rounded-sm border-gray-300 text-[var(--ea-primary,#00857a)] focus-visible:ring-[var(--ea-primary,#00857a)]"
            />
          </label>

          <label className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-700">Emergency alerts</span>
              <p className="text-xs text-gray-500">Critical patient alerts (always enabled)</p>
            </div>
            <input
              type="checkbox"
              checked={settings.notifications.emergencyAlerts}
              onChange={(e) => updateSetting('notifications', 'emergencyAlerts', e.target.checked)}
              className="rounded-sm border-gray-300 text-[var(--ea-primary,#00857a)] focus-visible:ring-[var(--ea-primary,#00857a)]"
              disabled
            />
          </label>
        </div>
      </div>

      {/* Security */}
      <div className="bg-white rounded-lg shadow-xs border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <span className="mr-2">🔒</span>
          Security
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Session timeout (minutes)
            </label>
            <select
              value={settings.security.sessionTimeout}
              onChange={(e) => updateSetting('security', 'sessionTimeout', parseInt(e.target.value))}
              className="block w-full border-gray-300 rounded-md focus-visible:ring-[var(--ea-primary,#00857a)] focus-visible:border-[var(--ea-primary,#00857a)]"
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
              <option value={120}>2 hours</option>
            </select>
          </div>

          <label className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-700">Require PIN for sensitive actions</span>
              <p className="text-xs text-gray-500">Ask for PIN before accessing patient data</p>
            </div>
            <input
              type="checkbox"
              checked={settings.security.requirePinForSensitive}
              onChange={(e) => updateSetting('security', 'requirePinForSensitive', e.target.checked)}
              className="rounded-sm border-gray-300 text-[var(--ea-primary,#00857a)] focus-visible:ring-[var(--ea-primary,#00857a)]"
            />
          </label>

          <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-md px-4 py-3">
            <div>
              <span className="text-sm font-medium text-green-800">Audit logging</span>
              <p className="text-xs text-green-700">Always enabled per HIPAA § 164.312(b) audit control requirements</p>
            </div>
            <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-1 rounded">MANDATORY</span>
          </div>
        </div>
      </div>

      {/* System Settings (Super Admin Only) */}
      {adminRole === 'super_admin' && (
        <div className="bg-white rounded-lg shadow-xs border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <span className="mr-2">⚙️</span>
            System Settings
            <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">Super Admin</span>
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-[var(--ea-primary,#00857a)]/5 border border-[var(--ea-primary,#00857a)]/20 rounded-md px-4 py-3">
              <div>
                <span className="text-sm font-medium text-[var(--ea-primary,#00857a)]">Database backups</span>
                <p className="text-xs text-[var(--ea-primary,#00857a)]/80">Managed by Supabase Pro plan — daily automated backups with point-in-time recovery</p>
              </div>
              <span className="text-xs font-semibold text-[var(--ea-primary,#00857a)] bg-[var(--ea-primary,#00857a)]/10 px-2 py-1 rounded">MANAGED</span>
            </div>

            <label className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-700">Enable beta features</span>
                <p className="text-xs text-gray-500">Access experimental features (may be unstable)</p>
              </div>
              <input
                type="checkbox"
                checked={settings.system.enableBetaFeatures}
                onChange={(e) => updateSetting('system', 'enableBetaFeatures', e.target.checked)}
                className="rounded-sm border-gray-300 text-[var(--ea-primary,#00857a)] focus-visible:ring-[var(--ea-primary,#00857a)]"
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
});

AdminSettingsPanel.displayName = 'AdminSettingsPanel';

export default AdminSettingsPanel;