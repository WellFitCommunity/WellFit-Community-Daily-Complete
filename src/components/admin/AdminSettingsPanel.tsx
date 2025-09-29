import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../../contexts/AdminAuthContext';

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
    enableAuditLogging: boolean;
  };
  display: {
    compactMode: boolean;
    showAdvancedMetrics: boolean;
    defaultDashboardView: 'overview' | 'patients' | 'billing';
  };
  system: {
    autoBackup: boolean;
    backupFrequency: 'daily' | 'weekly' | 'monthly';
    enableBetaFeatures: boolean;
  };
}

const AdminSettingsPanel: React.FC = () => {
  const { adminRole } = useAdminAuth();
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
      enableAuditLogging: true,
    },
    display: {
      compactMode: false,
      showAdvancedMetrics: true,
      defaultDashboardView: 'overview',
    },
    system: {
      autoBackup: true,
      backupFrequency: 'daily',
      enableBetaFeatures: false,
    },
  });

  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Settings are session-only for compliance

  // Apply theme changes (session only)
  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (settings.theme === 'light') {
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
  }, [settings.theme]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      // Settings applied immediately - session only for compliance
      setLastSaved(new Date());
      console.log('Settings applied for current session:', settings);

      // Simulate brief processing
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.error('Failed to apply settings:', error);
      alert('Failed to apply settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (section: keyof AdminSettings, key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
      },
    }));
  };

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
          enableAuditLogging: true,
        },
        display: {
          compactMode: false,
          showAdvancedMetrics: true,
          defaultDashboardView: 'overview',
        },
        system: {
          autoBackup: true,
          backupFrequency: 'daily',
          enableBetaFeatures: false,
        },
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
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
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {saving ? 'Applying...' : 'Apply Settings'}
            </button>
          </div>
        </div>
      </div>

      {/* Theme Settings */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <span className="mr-2">🎨</span>
          Appearance
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Theme</label>
            <div className="grid grid-cols-3 gap-3">
              {(['light', 'dark', 'auto'] as const).map((theme) => (
                <button
                  key={theme}
                  onClick={() => updateSetting('theme', 'theme', theme)}
                  className={`p-3 border rounded-lg text-sm font-medium capitalize transition-colors ${
                    settings.theme === theme
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {theme === 'light' && '☀️'} {theme === 'dark' && '🌙'} {theme === 'auto' && '🔄'} {theme}
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
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Compact mode</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.display.showAdvancedMetrics}
                onChange={(e) => updateSetting('display', 'showAdvancedMetrics', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Show advanced metrics</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Default Dashboard View</label>
            <select
              value={settings.display.defaultDashboardView}
              onChange={(e) => updateSetting('display', 'defaultDashboardView', e.target.value)}
              className="block w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="overview">Overview</option>
              <option value="patients">Patients</option>
              <option value="billing">Billing</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
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
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
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
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
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
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              disabled
            />
          </label>
        </div>
      </div>

      {/* Security */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
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
              className="block w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
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
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </label>

          <label className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-700">Enable audit logging</span>
              <p className="text-xs text-gray-500">Log all admin actions (recommended)</p>
            </div>
            <input
              type="checkbox"
              checked={settings.security.enableAuditLogging}
              onChange={(e) => updateSetting('security', 'enableAuditLogging', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </label>
        </div>
      </div>

      {/* System Settings (Super Admin Only) */}
      {adminRole === 'super_admin' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <span className="mr-2">⚙️</span>
            System Settings
            <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">Super Admin</span>
          </h2>
          <div className="space-y-4">
            <label className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-700">Auto backup</span>
                <p className="text-xs text-gray-500">Automatically backup system data</p>
              </div>
              <input
                type="checkbox"
                checked={settings.system.autoBackup}
                onChange={(e) => updateSetting('system', 'autoBackup', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </label>

            {settings.system.autoBackup && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Backup frequency
                </label>
                <select
                  value={settings.system.backupFrequency}
                  onChange={(e) => updateSetting('system', 'backupFrequency', e.target.value)}
                  className="block w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            )}

            <label className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-700">Enable beta features</span>
                <p className="text-xs text-gray-500">Access experimental features (may be unstable)</p>
              </div>
              <input
                type="checkbox"
                checked={settings.system.enableBetaFeatures}
                onChange={(e) => updateSetting('system', 'enableBetaFeatures', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSettingsPanel;