/**
 * Tenant Module Configuration Panel
 *
 * Admin interface for managing tenant-level module activation.
 * Tenant admins can enable/disable modules WITHIN their entitlements.
 *
 * Two-Tier Control Model:
 * - ENTITLEMENTS (Envision Atlus sets): What the tenant has PAID FOR (ceiling)
 * - ACTIVE STATE (this panel): What the tenant admin has ENABLED
 *
 * A module is only accessible if: entitled=true AND enabled=true
 *
 * @see src/hooks/useTenantModules.ts
 * @see src/services/tenantModuleService.ts
 */

import React, { useState } from 'react';
import { useTenantModules } from '../../hooks/useTenantModules';
import { updateTenantModuleConfig } from '../../services/tenantModuleService';
import {
  MODULE_METADATA,
  type ModuleName,
  type LicenseTier,
  getEntitlementName
} from '../../types/tenantModules';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import {
  Loader2,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Info,
  ChevronDown,
  ChevronUp,
  Settings
} from 'lucide-react';

interface ModuleToggleProps {
  moduleName: ModuleName;
  isEnabled: boolean;
  isEntitled: boolean;
  currentTier: LicenseTier;
  onChange: (moduleName: ModuleName, enabled: boolean) => void;
  disabled?: boolean;
}

function ModuleToggle({ moduleName, isEnabled, isEntitled, currentTier, onChange, disabled }: ModuleToggleProps) {
  const metadata = MODULE_METADATA[moduleName];

  const tierLevel = {
    basic: 1,
    standard: 2,
    premium: 3,
    enterprise: 4,
  };

  const hasRequiredTier = tierLevel[currentTier] >= tierLevel[metadata.requiredTier];

  // Disable toggle if not entitled (SuperAdmin hasn't granted access)
  const isDisabled = disabled || !isEntitled;

  return (
    <div className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${
      !isEntitled ? 'bg-gray-50 opacity-75' : 'hover:bg-gray-50'
    }`}>
      <div className="flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="font-medium text-gray-900">{metadata.name}</h4>
          <Badge
            variant={hasRequiredTier ? 'secondary' : 'destructive'}
            className="text-xs"
          >
            {metadata.requiredTier}
          </Badge>
          {!isEntitled && (
            <Badge variant="outline" className="text-xs bg-gray-100 text-gray-600 flex items-center gap-1">
              <Lock className="w-3 h-3" />
              Not in plan
            </Badge>
          )}
          {isEntitled && isEnabled && (
            <Badge className="text-xs bg-green-100 text-green-700">
              Active
            </Badge>
          )}
        </div>
        <p className="text-sm text-gray-600 mt-1">{metadata.description}</p>
        {!isEntitled && (
          <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
            <Info className="w-3 h-3" />
            Contact Envision Atlus to add this to your plan
          </p>
        )}
        {!hasRequiredTier && isEntitled && (
          <p className="text-xs text-amber-600 mt-1">
            Requires {metadata.requiredTier} tier or higher
          </p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 ml-4">
        {isEntitled ? (
          <>
            <span className="text-xs text-gray-500">
              {isEnabled ? 'Enabled' : 'Disabled'}
            </span>
            <Switch
              checked={isEnabled}
              onCheckedChange={(checked) => onChange(moduleName, checked)}
              disabled={isDisabled || !hasRequiredTier}
            />
          </>
        ) : (
          <Lock className="w-5 h-5 text-gray-400" />
        )}
      </div>
    </div>
  );
}

export function TenantModuleConfigPanel() {
  const { config, loading, error, refresh } = useTenantModules();
  const [pendingChanges, setPendingChanges] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    core: true,
    clinical: true,
    communication: true,
    integration: false,
    advanced: false,
    nurseos: false,
    billing: false,
    security: true,
  });

  const handleModuleChange = (moduleName: ModuleName, enabled: boolean) => {
    setPendingChanges((prev) => ({
      ...prev,
      [moduleName]: enabled,
    }));
    setSaveSuccess(false);
    setSaveError(null);
  };

  const handleSave = async () => {
    if (Object.keys(pendingChanges).length === 0) {
      return;
    }

    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      const result = await updateTenantModuleConfig(pendingChanges);

      if (result) {
        setSaveSuccess(true);
        setPendingChanges({});
        await refresh(); // Reload config
        setTimeout(() => setSaveSuccess(false), 3000); // Hide success message after 3s
      } else {
        setSaveError('Failed to save configuration. Please try again.');
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'An error occurred while saving');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setPendingChanges({});
    setSaveSuccess(false);
    setSaveError(null);
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const hasPendingChanges = Object.keys(pendingChanges).length > 0;

  // Check if module is entitled (SuperAdmin has granted access)
  const isModuleEntitled = (moduleName: ModuleName): boolean => {
    if (!config) return false;
    const entitlementName = getEntitlementName(moduleName);
    return (config as Record<string, boolean>)[entitlementName] ?? false;
  };

  // Get current value (pending or saved)
  const getModuleValue = (moduleName: ModuleName): boolean => {
    if (moduleName in pendingChanges) {
      return pendingChanges[moduleName];
    }
    return config?.[moduleName] ?? false;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  if (error || !config) {
    return (
      <Card>
        <CardContent className="py-8">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {error?.message || 'Failed to load module configuration'}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const currentTier = config.license_tier;

  // Group modules by category
  const modulesByCategory: Record<string, ModuleName[]> = {};
  (Object.keys(MODULE_METADATA) as ModuleName[]).forEach((moduleName) => {
    const category = MODULE_METADATA[moduleName].category;
    if (!modulesByCategory[category]) {
      modulesByCategory[category] = [];
    }
    modulesByCategory[category].push(moduleName);
  });

  const categoryLabels: Record<string, string> = {
    core: 'Core Platform',
    clinical: 'Clinical Modules',
    communication: 'Communication',
    integration: 'Integrations',
    advanced: 'Advanced Features',
    nurseos: 'NurseOS',
    billing: 'Billing & Revenue',
    security: 'Security & Compliance',
  };

  // Count entitled and enabled modules
  const allModules = Object.keys(MODULE_METADATA) as ModuleName[];
  const entitledCount = allModules.filter(m => isModuleEntitled(m)).length;
  const enabledCount = allModules.filter(m => getModuleValue(m) && isModuleEntitled(m)).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-teal-600" />
                Module Configuration
              </CardTitle>
              <CardDescription>
                Enable or disable platform modules for your organization
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-sm">
                License: {currentTier}
              </Badge>
              <Badge variant="outline" className="text-sm bg-teal-50 text-teal-700">
                {entitledCount} entitled
              </Badge>
              <Badge variant="outline" className="text-sm bg-green-50 text-green-700">
                {enabledCount} active
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={refresh}
                disabled={loading}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Info Banner */}
      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          <span className="font-medium">Your Plan</span>: You can enable or disable modules within your current plan.
          Modules marked with <Lock className="w-3 h-3 inline mx-1" /> are not included in your plan.
          Contact Envision Atlus to upgrade your plan for additional modules.
        </AlertDescription>
      </Alert>

      {/* Status Messages */}
      {saveSuccess && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Configuration saved successfully!
          </AlertDescription>
        </Alert>
      )}

      {saveError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      )}

      {/* Modules by Category */}
      {Object.entries(categoryLabels).map(([category, label]) => {
        const modules = modulesByCategory[category];
        if (!modules || modules.length === 0) return null;

        const isExpanded = expandedCategories[category];
        const categoryEntitledCount = modules.filter(m => isModuleEntitled(m)).length;
        const categoryEnabledCount = modules.filter(m => getModuleValue(m) && isModuleEntitled(m)).length;

        return (
          <Card key={category} className="overflow-hidden">
            <button
              onClick={() => toggleCategory(category)}
              className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5 text-teal-600" />
                <CardTitle className="text-lg">{label}</CardTitle>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-teal-100 text-teal-700 text-xs rounded-full font-medium">
                    {categoryEntitledCount}/{modules.length} in plan
                  </span>
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                    {categoryEnabledCount} active
                  </span>
                </div>
              </div>
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>
            {isExpanded && (
              <CardContent className="space-y-3 pt-4">
                {modules.map((moduleName) => {
                  const currentValue = getModuleValue(moduleName);
                  const entitled = isModuleEntitled(moduleName);

                  return (
                    <ModuleToggle
                      key={moduleName}
                      moduleName={moduleName}
                      isEnabled={currentValue}
                      isEntitled={entitled}
                      currentTier={currentTier}
                      onChange={handleModuleChange}
                      disabled={saving}
                    />
                  );
                })}
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Save Actions */}
      {hasPendingChanges && (
        <Card className="sticky bottom-4 border-blue-200 bg-blue-50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-blue-900">
                You have unsaved changes to {Object.keys(pendingChanges).length} module
                {Object.keys(pendingChanges).length === 1 ? '' : 's'}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleReset}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-teal-600 hover:bg-teal-700"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
