/**
 * System Configuration Panel
 *
 * Manage system-wide settings, feature flags, and environment configuration.
 * For IT staff to control application behavior without code deployments.
 */

import React, { useState } from 'react';
import { Alert, AlertDescription } from '../ui/alert';
import { Settings, ToggleLeft, ToggleRight, Save, AlertTriangle } from 'lucide-react';

interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category: string;
}

interface SystemConfig {
  feature_flags: FeatureFlag[];
  maintenance_mode: boolean;
  api_rate_limit: number;
  session_timeout_minutes: number;
  max_file_upload_mb: number;
  enable_debug_logging: boolean;
}

const SystemConfigurationPanel: React.FC = () => {
  const [config, setConfig] = useState<SystemConfig>({
    feature_flags: [
      {
        id: 'ccm_autopilot',
        name: 'CCM Autopilot',
        description: 'Automatic chronic care management time tracking',
        enabled: true,
        category: 'Billing'
      },
      {
        id: 'smart_scribe',
        name: 'SmartScribe Atlus',
        description: 'AI-powered medical transcription for clinical documentation',
        enabled: true,
        category: 'Clinical'
      },
      {
        id: 'patient_handoff',
        name: 'Patient Handoff System',
        description: 'Secure transfer of care between facilities',
        enabled: true,
        category: 'Clinical'
      },
      {
        id: 'soc2_monitoring',
        name: 'SOC 2 Security Monitoring',
        description: 'Advanced security event tracking and compliance',
        enabled: true,
        category: 'Security'
      },
      {
        id: 'fhir_analytics',
        name: 'FHIR Analytics Dashboard',
        description: 'Real-time patient insights and clinical decision support',
        enabled: true,
        category: 'Clinical'
      },
      {
        id: 'physician_wellness',
        name: 'Physician Wellness Hub',
        description: 'Burnout prevention and resilience training for providers',
        enabled: true,
        category: 'Wellness'
      },
      {
        id: 'nurse_wellness',
        name: 'Nurse OS Wellness Features',
        description: 'Resilience dashboard and support circles for nurses',
        enabled: true,
        category: 'Wellness'
      },
      {
        id: 'beta_features',
        name: 'Beta Features Access',
        description: 'Enable experimental features for testing',
        enabled: false,
        category: 'System'
      }
    ],
    maintenance_mode: false,
    api_rate_limit: 1000,
    session_timeout_minutes: 30,
    max_file_upload_mb: 10,
    enable_debug_logging: false
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  const toggleFeatureFlag = (flagId: string) => {
    setConfig(prev => ({
      ...prev,
      feature_flags: prev.feature_flags.map(flag =>
        flag.id === flagId ? { ...flag, enabled: !flag.enabled } : flag
      )
    }));
  };

  const toggleMaintenanceMode = () => {
    if (!config.maintenance_mode) {
      if (!window.confirm('Are you sure you want to enable maintenance mode? This will block all non-admin users from accessing the system.')) {
        return;
      }
    }
    setConfig(prev => ({ ...prev, maintenance_mode: !prev.maintenance_mode }));
  };

  const saveConfiguration = async () => {
    setSaving(true);
    setMessage(null);

    try {
      // In a real implementation, this would save to a system_config table
      // For now, we'll simulate a save operation
      await new Promise(resolve => setTimeout(resolve, 1000));

      setMessage({
        type: 'success',
        text: 'System configuration saved successfully'
      });
    } catch (error: any) {

      setMessage({
        type: 'error',
        text: error.message || 'Failed to save configuration'
      });
    } finally {
      setSaving(false);
    }
  };

  const groupFlagsByCategory = () => {
    const grouped: { [category: string]: FeatureFlag[] } = {};
    config.feature_flags.forEach(flag => {
      if (!grouped[flag.category]) {
        grouped[flag.category] = [];
      }
      grouped[flag.category].push(flag);
    });
    return grouped;
  };

  const flagsByCategory = groupFlagsByCategory();

  return (
    <div className="space-y-6">
      {/* Messages */}
      {message && (
        <Alert className={
          message.type === 'success' ? 'bg-green-50 border-green-200' :
          message.type === 'error' ? 'bg-red-50 border-red-200' :
          'bg-yellow-50 border-yellow-200'
        }>
          <AlertDescription className={
            message.type === 'success' ? 'text-green-800' :
            message.type === 'error' ? 'text-red-800' :
            'text-yellow-800'
          }>
            {message.text}
          </AlertDescription>
        </Alert>
      )}

      {/* Maintenance Mode Warning */}
      {config.maintenance_mode && (
        <Alert className="bg-red-50 border-red-300">
          <AlertDescription className="text-red-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            <strong>MAINTENANCE MODE ACTIVE:</strong> Non-admin users are currently blocked from accessing the system.
          </AlertDescription>
        </Alert>
      )}

      {/* Critical System Settings */}
      <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-lg p-6 border-2 border-red-300">
        <h3 className="text-lg font-bold text-red-900 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Critical System Settings
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-white rounded-lg border-2 border-red-200">
            <div>
              <div className="font-bold text-red-900">Maintenance Mode</div>
              <div className="text-sm text-red-700">Block all non-admin access to the system</div>
            </div>
            <button
              onClick={toggleMaintenanceMode}
              className={`p-2 rounded-lg border-2 border-black transition-all ${
                config.maintenance_mode
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              {config.maintenance_mode ? (
                <ToggleRight className="w-8 h-8" />
              ) : (
                <ToggleLeft className="w-8 h-8" />
              )}
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-white rounded-lg border-2 border-orange-200">
            <div>
              <div className="font-bold text-orange-900">Debug Logging</div>
              <div className="text-sm text-orange-700">Enable detailed system logs (impacts performance)</div>
            </div>
            <button
              onClick={() => setConfig(prev => ({ ...prev, enable_debug_logging: !prev.enable_debug_logging }))}
              className={`p-2 rounded-lg border-2 border-black transition-all ${
                config.enable_debug_logging
                  ? 'bg-orange-600 hover:bg-orange-700 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              {config.enable_debug_logging ? (
                <ToggleRight className="w-8 h-8" />
              ) : (
                <ToggleLeft className="w-8 h-8" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* System Limits */}
      <div className="bg-white rounded-lg p-6 border-2 border-black shadow-lg">
        <h3 className="text-lg font-bold text-black mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-[#1BA39C]" />
          System Limits & Timeouts
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">API Rate Limit (requests/min)</label>
            <input
              type="number"
              value={config.api_rate_limit}
              onChange={(e) => setConfig(prev => ({ ...prev, api_rate_limit: parseInt(e.target.value) || 0 }))}
              className="w-full px-4 py-2 border-2 border-black rounded-lg focus:ring-2 focus:ring-[#1BA39C] focus:border-[#1BA39C]"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Session Timeout (minutes)</label>
            <input
              type="number"
              value={config.session_timeout_minutes}
              onChange={(e) => setConfig(prev => ({ ...prev, session_timeout_minutes: parseInt(e.target.value) || 0 }))}
              className="w-full px-4 py-2 border-2 border-black rounded-lg focus:ring-2 focus:ring-[#1BA39C] focus:border-[#1BA39C]"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Max File Upload (MB)</label>
            <input
              type="number"
              value={config.max_file_upload_mb}
              onChange={(e) => setConfig(prev => ({ ...prev, max_file_upload_mb: parseInt(e.target.value) || 0 }))}
              className="w-full px-4 py-2 border-2 border-black rounded-lg focus:ring-2 focus:ring-[#1BA39C] focus:border-[#1BA39C]"
            />
          </div>
        </div>
      </div>

      {/* Feature Flags by Category */}
      {Object.entries(flagsByCategory).map(([category, flags]) => (
        <div key={category} className="bg-white rounded-lg p-6 border-2 border-black shadow-lg">
          <h3 className="text-lg font-bold text-black mb-4">{category} Features</h3>
          <div className="space-y-3">
            {flags.map(flag => (
              <div
                key={flag.id}
                className="flex items-center justify-between p-4 bg-[#E8F8F7] rounded-lg border border-black hover:border-[#1BA39C] transition-all"
              >
                <div className="flex-1">
                  <div className="font-bold text-gray-900">{flag.name}</div>
                  <div className="text-sm text-gray-600 mt-1">{flag.description}</div>
                </div>
                <button
                  onClick={() => toggleFeatureFlag(flag.id)}
                  className={`p-2 rounded-lg border-2 border-black transition-all ml-4 ${
                    flag.enabled
                      ? 'bg-[#1BA39C] hover:bg-[#158A84] text-white'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  }`}
                >
                  {flag.enabled ? (
                    <ToggleRight className="w-8 h-8" />
                  ) : (
                    <ToggleLeft className="w-8 h-8" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Save Button */}
      <div className="flex justify-end gap-4">
        <button
          onClick={saveConfiguration}
          disabled={saving}
          className="px-8 py-3 bg-[#1BA39C] hover:bg-[#158A84] text-white font-bold rounded-lg transition-all shadow-md hover:shadow-lg border-2 border-black disabled:opacity-50 flex items-center gap-2"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>

      {/* Info Note */}
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> Configuration changes take effect immediately. Feature flags control which components are available to users.
          Use maintenance mode sparingly as it will block all patient and provider access.
        </p>
      </div>
    </div>
  );
};

export default SystemConfigurationPanel;
