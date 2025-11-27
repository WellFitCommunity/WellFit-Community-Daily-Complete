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
import {
  EACard,
  EACardHeader,
  EACardContent,
  EAButton,
  EABadge,
  EAAlert,
  EASwitch,
} from '../envision-atlus';
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
    <div className={`flex items-center justify-between p-4 border border-slate-700 rounded-lg transition-colors ${
      !isEntitled ? 'bg-slate-800/30 opacity-75' : 'bg-slate-800/50 hover:bg-slate-800'
    }`}>
      <div className="flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="font-medium text-white">{metadata.name}</h4>
          <EABadge
            variant={hasRequiredTier ? 'info' : 'critical'}
          >
            {metadata.requiredTier}
          </EABadge>
          {!isEntitled && (
            <EABadge variant="elevated" className="flex items-center gap-1">
              <Lock className="w-3 h-3" />
              Not in plan
            </EABadge>
          )}
          {isEntitled && isEnabled && (
            <EABadge variant="normal">
              Active
            </EABadge>
          )}
        </div>
        <p className="text-sm text-slate-400 mt-1">{metadata.description}</p>
        {!isEntitled && (
          <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
            <Info className="w-3 h-3" />
            Contact Envision Atlus to add this to your plan
          </p>
        )}
        {!hasRequiredTier && isEntitled && (
          <p className="text-xs text-amber-400 mt-1">
            Requires {metadata.requiredTier} tier or higher
          </p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 ml-4">
        {isEntitled ? (
          <>
            <span className="text-xs text-slate-500">
              {isEnabled ? 'Enabled' : 'Disabled'}
            </span>
            <EASwitch
              checked={isEnabled}
              onCheckedChange={(checked) => onChange(moduleName, checked)}
              disabled={isDisabled || !hasRequiredTier}
            />
          </>
        ) : (
          <Lock className="w-5 h-5 text-slate-500" />
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
    return (config as unknown as Record<string, boolean>)[entitlementName] ?? false;
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
      <EACard>
        <EACardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </EACardContent>
      </EACard>
    );
  }

  if (error || !config) {
    return (
      <EACard>
        <EACardContent className="py-8">
          <EAAlert variant="critical">
            <AlertTriangle className="h-4 w-4" />
            <span>{error?.message || 'Failed to load module configuration'}</span>
          </EAAlert>
        </EACardContent>
      </EACard>
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
      <EACard>
        <EACardHeader icon={<Settings className="w-5 h-5 text-[#00857a]" />}>
          <div className="flex items-center justify-between w-full">
            <div>
              <h2 className="text-lg font-semibold text-white">Module Configuration</h2>
              <p className="text-sm text-slate-400">
                Enable or disable platform modules for your organization
              </p>
            </div>
            <div className="flex items-center gap-2">
              <EABadge variant="info">
                License: {currentTier}
              </EABadge>
              <EABadge variant="info">
                {entitledCount} entitled
              </EABadge>
              <EABadge variant="normal">
                {enabledCount} active
              </EABadge>
              <EAButton
                variant="secondary"
                size="sm"
                onClick={refresh}
                disabled={loading}
                icon={<RefreshCw className="h-4 w-4" />}
              >
                Refresh
              </EAButton>
            </div>
          </div>
        </EACardHeader>
      </EACard>

      {/* Info Banner */}
      <EAAlert variant="info">
        <Info className="h-4 w-4" />
        <span>
          <span className="font-medium">Your Plan</span>: You can enable or disable modules within your current plan.
          Modules marked with <Lock className="w-3 h-3 inline mx-1" /> are not included in your plan.
          Contact Envision Atlus to upgrade your plan for additional modules.
        </span>
      </EAAlert>

      {/* Status Messages */}
      {saveSuccess && (
        <EAAlert variant="success">
          <CheckCircle2 className="h-4 w-4" />
          <span>Configuration saved successfully!</span>
        </EAAlert>
      )}

      {saveError && (
        <EAAlert variant="critical">
          <AlertTriangle className="h-4 w-4" />
          <span>{saveError}</span>
        </EAAlert>
      )}

      {/* Modules by Category */}
      {Object.entries(categoryLabels).map(([category, label]) => {
        const modules = modulesByCategory[category];
        if (!modules || modules.length === 0) return null;

        const isExpanded = expandedCategories[category];
        const categoryEntitledCount = modules.filter(m => isModuleEntitled(m)).length;
        const categoryEnabledCount = modules.filter(m => getModuleValue(m) && isModuleEntitled(m)).length;

        return (
          <EACard key={category} className="overflow-hidden">
            <button
              onClick={() => toggleCategory(category)}
              className="w-full flex items-center justify-between p-4 bg-slate-800/50 hover:bg-slate-800 transition-colors text-left border-b border-slate-700"
            >
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5 text-[#00857a]" />
                <h3 className="text-lg font-semibold text-white">{label}</h3>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-[#00857a]/20 text-[#33bfb7] text-xs rounded-full font-medium">
                    {categoryEntitledCount}/{modules.length} in plan
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full font-medium">
                    {categoryEnabledCount} active
                  </span>
                </div>
              </div>
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-slate-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              )}
            </button>
            {isExpanded && (
              <EACardContent className="space-y-3 pt-4">
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
              </EACardContent>
            )}
          </EACard>
        );
      })}

      {/* Save Actions */}
      {hasPendingChanges && (
        <EACard className="sticky bottom-4 border-[#00857a]/50 bg-[#00857a]/10">
          <EACardContent className="py-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#33bfb7]">
                You have unsaved changes to {Object.keys(pendingChanges).length} module
                {Object.keys(pendingChanges).length === 1 ? '' : 's'}
              </p>
              <div className="flex gap-2">
                <EAButton
                  variant="secondary"
                  onClick={handleReset}
                  disabled={saving}
                >
                  Cancel
                </EAButton>
                <EAButton
                  variant="primary"
                  onClick={handleSave}
                  disabled={saving}
                  loading={saving}
                  icon={saving ? undefined : <Save className="h-4 w-4" />}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </EAButton>
              </div>
            </div>
          </EACardContent>
        </EACard>
      )}
    </div>
  );
}
