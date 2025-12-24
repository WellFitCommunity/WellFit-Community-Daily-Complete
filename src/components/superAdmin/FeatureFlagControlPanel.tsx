import React, { useState, useEffect } from 'react';
import { SuperAdminService } from '../../services/superAdminService';
import { SystemFeatureFlag, SuperAdminUser } from '../../types/superAdmin';
import { Settings, AlertTriangle, Power, Shield, CheckCircle, XCircle, Zap } from 'lucide-react';
import { auditLogger } from '../../services/auditLogger';

const FeatureFlagControlPanel: React.FC = () => {
  const [features, setFeatures] = useState<SystemFeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [superAdmin, setSuperAdmin] = useState<SuperAdminUser | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showKillSwitchDialog, setShowKillSwitchDialog] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<SystemFeatureFlag | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [featuresData, adminData] = await Promise.all([
        SuperAdminService.getAllFeatureFlags(),
        SuperAdminService.getCurrentSuperAdmin()
      ]);
      setFeatures(featuresData);
      setSuperAdmin(adminData);
    } catch (err: unknown) {
      await auditLogger.error('SUPER_ADMIN_FEATURE_FLAGS_LOAD_FAILED', err as Error, {
        category: 'ADMINISTRATIVE'
      });
      setError('Failed to load feature flags');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFeature = async (feature: SystemFeatureFlag) => {
    if (!superAdmin) return;

    try {
      setActionLoading(feature.featureKey);
      await SuperAdminService.updateFeatureFlag({
        featureKey: feature.featureKey,
        isEnabled: !feature.isEnabled,
        superAdminId: superAdmin.id
      });
      await loadData();
    } catch (err: unknown) {
      await auditLogger.error('SUPER_ADMIN_FEATURE_TOGGLE_FAILED', err as Error, {
        category: 'SECURITY_EVENT',
        featureKey: feature.featureKey,
        newState: !feature.isEnabled
      });
      setError('Failed to toggle feature');
    } finally {
      setActionLoading(null);
    }
  };

  const handleKillSwitch = (feature: SystemFeatureFlag) => {
    setSelectedFeature(feature);
    setShowKillSwitchDialog(true);
  };

  const confirmKillSwitch = async () => {
    if (!selectedFeature || !superAdmin) return;

    try {
      setActionLoading(selectedFeature.featureKey);
      setShowKillSwitchDialog(false);
      await SuperAdminService.emergencyDisableFeature({
        featureKey: selectedFeature.featureKey,
        reason: `Emergency kill switch activated by ${superAdmin.displayName}`,
        superAdminId: superAdmin.id
      });
      await loadData();
    } catch (err: unknown) {
      await auditLogger.error('SUPER_ADMIN_KILL_SWITCH_FAILED', err as Error, {
        category: 'SECURITY_EVENT',
        featureKey: selectedFeature.featureKey,
        severity: 'critical'
      });
      setError('Failed to activate kill switch');
    } finally {
      setActionLoading(null);
      setSelectedFeature(null);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'core':
        return <Settings className="w-5 h-5" />;
      case 'healthcare':
        return <Shield className="w-5 h-5" />;
      case 'law_enforcement':
        return <AlertTriangle className="w-5 h-5" />;
      case 'billing':
        return <Power className="w-5 h-5" />;
      default:
        return <Settings className="w-5 h-5" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'core':
        return 'blue';
      case 'healthcare':
        return 'green';
      case 'law_enforcement':
        return 'purple';
      case 'billing':
        return 'orange';
      default:
        return 'gray';
    }
  };

  const uniqueCategories = new Set(features.map(f => f.category).filter(c => c !== undefined) as string[]);
  const categories = ['all', ...Array.from(uniqueCategories)];
  const filteredFeatures = filterCategory === 'all'
    ? features
    : features.filter(f => f.category === filterCategory);

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded-sm w-1/3"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-200 rounded-sm"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="flex items-center gap-3 text-red-600">
          <AlertTriangle className="w-6 h-6" />
          <p>{error}</p>
        </div>
        <button
          onClick={loadData}
          className="mt-4 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors shadow-xs"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Feature Flag Control</h2>
            <p className="text-sm text-gray-600 mt-1">
              Manage system-wide feature flags and emergency kill switches
            </p>
          </div>
          <button
            onClick={loadData}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors shadow-xs"
          >
            Refresh
          </button>
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm font-medium text-gray-700">Filter:</span>
          {categories.map((cat) => cat && (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors shadow-xs ${
                filterCategory === cat
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {cat.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="font-semibold text-green-900">Enabled</span>
            </div>
            <div className="text-2xl font-bold text-green-900">
              {features.filter(f => f.isEnabled && !f.forceDisabled).length}
            </div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-5 h-5 text-gray-600" />
              <span className="font-semibold text-gray-900">Disabled</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {features.filter(f => !f.isEnabled && !f.forceDisabled).length}
            </div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-red-600" />
              <span className="font-semibold text-red-900">Kill Switch Active</span>
            </div>
            <div className="text-2xl font-bold text-red-900">
              {features.filter(f => f.forceDisabled).length}
            </div>
          </div>
        </div>
      </div>

      {/* Feature List */}
      <div className="space-y-4">
        {filteredFeatures.map((feature) => {
          const category = feature.category || 'uncategorized';
          const color = getCategoryColor(category);
          const isLoading = actionLoading === feature.featureKey;

          return (
            <div
              key={feature.featureKey}
              className={`bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow ${
                feature.forceDisabled ? 'border-2 border-red-500' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <div className={`p-3 rounded-lg bg-${color}-50`}>
                    {getCategoryIcon(category)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-gray-900">{feature.featureName}</h3>
                      <span className={`px-2 py-1 rounded-sm text-xs font-medium bg-${color}-100 text-${color}-800 capitalize`}>
                        {category.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{feature.featureKey}</p>

                    {/* Status Badges */}
                    <div className="flex items-center gap-2">
                      {feature.forceDisabled ? (
                        <span className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                          <Zap className="w-3 h-3" />
                          KILL SWITCH ACTIVE
                        </span>
                      ) : feature.isEnabled ? (
                        <span className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                          <CheckCircle className="w-3 h-3" />
                          Enabled
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">
                          <XCircle className="w-3 h-3" />
                          Disabled
                        </span>
                      )}
                      {feature.enabledForNewTenants && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                          New tenant default
                        </span>
                      )}
                      {feature.requiresLicense && (
                        <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                          License required
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 ml-4">
                  {!feature.forceDisabled && (
                    <button
                      onClick={() => handleToggleFeature(feature)}
                      disabled={isLoading}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        feature.isEnabled
                          ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {isLoading ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>
                      ) : (
                        <span>{feature.isEnabled ? 'Disable' : 'Enable'}</span>
                      )}
                    </button>
                  )}
                  {!feature.forceDisabled && feature.category !== 'core' && (
                    <button
                      onClick={() => handleKillSwitch(feature)}
                      disabled={isLoading}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
                      title="Emergency Kill Switch - Force disable across all tenants"
                    >
                      <Zap className="w-4 h-4" />
                      Kill Switch
                    </button>
                  )}
                  {feature.forceDisabled && (
                    <div className="text-sm text-red-600 font-medium">
                      Emergency disabled - Contact system admin
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Kill Switch Confirmation Dialog */}
      {showKillSwitchDialog && selectedFeature && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-100 rounded-lg">
                <Zap className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">
                Emergency Kill Switch
              </h3>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-900 font-medium mb-2">⚠️ Critical Action Warning</p>
              <p className="text-sm text-red-800">
                You are about to activate the emergency kill switch for:
              </p>
              <p className="text-sm font-bold text-red-900 mt-2">
                {selectedFeature.featureName}
              </p>
            </div>

            <div className="space-y-3 mb-6 text-sm text-gray-700">
              <p>This action will:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Immediately force-disable this feature across ALL tenants</li>
                <li>Override all tenant-level settings</li>
                <li>Prevent re-enabling until kill switch is manually cleared</li>
                <li>Log this action in the security audit trail</li>
              </ul>
              <p className="font-medium text-red-600 mt-4">
                This is an emergency measure for critical security issues or system failures.
              </p>
            </div>

            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => {
                  setShowKillSwitchDialog(false);
                  setSelectedFeature(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmKillSwitch}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center gap-2"
              >
                <Zap className="w-4 h-4" />
                Activate Kill Switch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeatureFlagControlPanel;
