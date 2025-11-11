/**
 * Tenant Module Configuration Panel
 *
 * Admin interface for managing tenant-level module feature flags.
 * Allows admins to enable/disable platform modules for their organization.
 *
 * @see src/hooks/useTenantModules.ts
 * @see src/services/tenantModuleService.ts
 */

import React, { useState } from 'react';
import { useTenantModules } from '../../hooks/useTenantModules';
import { updateTenantModuleConfig } from '../../services/tenantModuleService';
import { MODULE_METADATA, type ModuleName, type LicenseTier } from '../../types/tenantModules';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { Loader2, Save, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';

interface ModuleToggleProps {
  moduleName: ModuleName;
  isEnabled: boolean;
  currentTier: LicenseTier;
  onChange: (moduleName: ModuleName, enabled: boolean) => void;
  disabled?: boolean;
}

function ModuleToggle({ moduleName, isEnabled, currentTier, onChange, disabled }: ModuleToggleProps) {
  const metadata = MODULE_METADATA[moduleName];

  const tierLevel = {
    basic: 1,
    standard: 2,
    premium: 3,
    enterprise: 4,
  };

  const hasRequiredTier = tierLevel[currentTier] >= tierLevel[metadata.requiredTier];

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-gray-900">{metadata.name}</h4>
          <Badge
            variant={hasRequiredTier ? 'secondary' : 'destructive'}
            className="text-xs"
          >
            {metadata.requiredTier}
          </Badge>
        </div>
        <p className="text-sm text-gray-600 mt-1">{metadata.description}</p>
        {!hasRequiredTier && (
          <p className="text-xs text-red-600 mt-1">
            Requires {metadata.requiredTier} tier or higher
          </p>
        )}
      </div>
      <Switch
        checked={isEnabled}
        onCheckedChange={(checked) => onChange(moduleName, checked)}
        disabled={disabled || !hasRequiredTier}
        className="ml-4"
      />
    </div>
  );
}

export function TenantModuleConfigPanel() {
  const { config, loading, error, refresh } = useTenantModules();
  const [pendingChanges, setPendingChanges] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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

  const hasPendingChanges = Object.keys(pendingChanges).length > 0;

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

  const categoryLabels = {
    core: 'Core Platform',
    clinical: 'Clinical Modules',
    communication: 'Communication',
    integration: 'Integrations',
    advanced: 'Advanced Features',
    nurseos: 'NurseOS',
    billing: 'Billing & Revenue',
    security: 'Security & Compliance',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Module Configuration</CardTitle>
              <CardDescription>
                Enable or disable platform modules for your organization
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-sm">
                License: {currentTier}
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

        return (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="text-lg">{label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {modules.map((moduleName) => {
                const currentValue = pendingChanges[moduleName] ?? config[moduleName] ?? false;

                return (
                  <ModuleToggle
                    key={moduleName}
                    moduleName={moduleName}
                    isEnabled={currentValue}
                    currentTier={currentTier}
                    onChange={handleModuleChange}
                    disabled={saving}
                  />
                );
              })}
            </CardContent>
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
                  className="bg-blue-600 hover:bg-blue-700"
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
