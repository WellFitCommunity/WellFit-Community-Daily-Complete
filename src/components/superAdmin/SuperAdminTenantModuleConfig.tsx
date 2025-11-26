/**
 * SuperAdmin Tenant Module Configuration
 *
 * Allows Envision SuperAdmin to configure modules for any specific tenant.
 * This is different from TenantModuleConfigPanel which is for tenant admins
 * to configure their OWN tenant.
 *
 * Features:
 * - Select any tenant and configure their modules
 * - Override license tier restrictions (super admin power)
 * - Audit trail for all changes
 * - Per-tenant granular control
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { TenantWithStatus } from '../../types/superAdmin';
import { MODULE_METADATA, type ModuleName, type LicenseTier, type TenantModuleConfig } from '../../types/tenantModules';
import { SuperAdminService } from '../../services/superAdminService';
import { auditLogger } from '../../services/auditLogger';
import {
  Settings,
  Save,
  X,
  CheckCircle,
  AlertTriangle,
  Building2,
  Loader2,
  Shield,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface SuperAdminTenantModuleConfigProps {
  tenant: TenantWithStatus;
  onClose: () => void;
  onSaved?: () => void;
}

export const SuperAdminTenantModuleConfig: React.FC<SuperAdminTenantModuleConfigProps> = ({
  tenant,
  onClose,
  onSaved
}) => {
  const [config, setConfig] = useState<Partial<TenantModuleConfig> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Record<string, boolean>>({});
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    core: true,
    clinical: true,
    communication: false,
    integration: false,
    advanced: false,
    nurseos: false,
    billing: false,
    security: false,
  });

  useEffect(() => {
    loadTenantConfig();
  }, [tenant.tenantId]);

  const loadTenantConfig = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('tenant_module_configuration')
        .select('*')
        .eq('tenant_id', tenant.tenantId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      // If no config exists, create default
      if (!data) {
        const defaultConfig: Partial<TenantModuleConfig> = {
          tenant_id: tenant.tenantId,
          license_tier: 'basic',
          community_enabled: true,
          dashboard_enabled: true,
          check_ins_enabled: true,
          dental_enabled: false,
          sdoh_enabled: false,
          pharmacy_enabled: false,
          medications_enabled: true,
          telehealth_enabled: false,
          messaging_enabled: true,
          ehr_integration_enabled: false,
          fhir_enabled: false,
          ai_scribe_enabled: false,
          claude_care_enabled: false,
          guardian_monitoring_enabled: false,
          nurseos_clarity_enabled: false,
          nurseos_shield_enabled: false,
          resilience_hub_enabled: false,
          billing_integration_enabled: false,
          rpm_ccm_enabled: false,
          hipaa_audit_logging: true,
          mfa_enforcement: false,
        };
        setConfig(defaultConfig);
      } else {
        setConfig(data);
      }
    } catch (err) {
      await auditLogger.error('SUPER_ADMIN_TENANT_MODULE_LOAD_FAILED', err as Error, {
        tenantId: tenant.tenantId,
        tenantName: tenant.tenantName
      });
      setError('Failed to load tenant module configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleModuleToggle = (moduleName: ModuleName, enabled: boolean) => {
    setPendingChanges(prev => ({
      ...prev,
      [moduleName]: enabled
    }));
    setSuccess(false);
  };

  const handleLicenseTierChange = (tier: LicenseTier) => {
    setPendingChanges(prev => ({
      ...prev,
      license_tier: tier as unknown as boolean // Type hack for the map
    }));
    setSuccess(false);
  };

  const handleSave = async () => {
    if (Object.keys(pendingChanges).length === 0) return;

    try {
      setSaving(true);
      setError(null);

      const superAdmin = await SuperAdminService.getCurrentSuperAdmin();
      if (!superAdmin) {
        throw new Error('Unauthorized: Super admin access required');
      }

      // Prepare update payload
      const updatePayload: Record<string, any> = {
        ...pendingChanges,
        updated_at: new Date().toISOString(),
        updated_by: superAdmin.id
      };

      // Check if config exists
      const { data: existing } = await supabase
        .from('tenant_module_configuration')
        .select('id')
        .eq('tenant_id', tenant.tenantId)
        .single();

      if (existing) {
        // Update existing
        const { error: updateError } = await supabase
          .from('tenant_module_configuration')
          .update(updatePayload)
          .eq('tenant_id', tenant.tenantId);

        if (updateError) throw updateError;
      } else {
        // Insert new
        const { error: insertError } = await supabase
          .from('tenant_module_configuration')
          .insert({
            tenant_id: tenant.tenantId,
            ...config,
            ...updatePayload,
            created_by: superAdmin.id
          });

        if (insertError) throw insertError;
      }

      // Log audit event
      await SuperAdminService.logAuditEvent({
        superAdminId: superAdmin.id,
        superAdminEmail: superAdmin.email,
        action: 'tenant.modules.update',
        targetType: 'tenant',
        targetId: tenant.tenantId,
        targetName: tenant.tenantName,
        oldValue: config,
        newValue: { ...config, ...pendingChanges },
        severity: 'info'
      });

      setSuccess(true);
      setPendingChanges({});
      await loadTenantConfig(); // Reload config
      onSaved?.();

      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      await auditLogger.error('SUPER_ADMIN_TENANT_MODULE_SAVE_FAILED', err as Error, {
        tenantId: tenant.tenantId,
        changes: pendingChanges
      });
      setError((err as Error).message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const getModuleValue = (moduleName: ModuleName): boolean => {
    if (moduleName in pendingChanges) {
      return pendingChanges[moduleName];
    }
    return (config as any)?.[moduleName] ?? false;
  };

  const getCurrentTier = (): LicenseTier => {
    if ('license_tier' in pendingChanges) {
      return pendingChanges.license_tier as unknown as LicenseTier;
    }
    return config?.license_tier || 'basic';
  };

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

  const hasPendingChanges = Object.keys(pendingChanges).length > 0;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 p-8">
          <div className="flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="ml-3 text-gray-600">Loading configuration...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-cyan-700 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Configure Modules</h2>
                <p className="text-teal-100 text-sm">{tenant.tenantName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="bg-white/20 px-3 py-1 rounded-lg text-sm">
                <Shield className="w-4 h-4 inline mr-1" />
                SuperAdmin Override
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span className="text-red-800">{error}</span>
          </div>
        )}

        {success && (
          <div className="mx-6 mt-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-green-800">Configuration saved successfully!</span>
          </div>
        )}

        {/* License Tier Selector */}
        <div className="p-6 border-b">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            License Tier
          </label>
          <div className="flex gap-2">
            {(['basic', 'standard', 'premium', 'enterprise'] as LicenseTier[]).map((tier) => (
              <button
                key={tier}
                onClick={() => handleLicenseTierChange(tier)}
                className={`px-4 py-2 rounded-lg font-medium capitalize transition-colors ${
                  getCurrentTier() === tier
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {tier}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Higher tiers unlock more modules. SuperAdmin can override tier restrictions.
          </p>
        </div>

        {/* Module List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {Object.entries(categoryLabels).map(([category, label]) => {
            const modules = modulesByCategory[category];
            if (!modules || modules.length === 0) return null;

            const isExpanded = expandedCategories[category];
            const enabledCount = modules.filter(m => getModuleValue(m)).length;

            return (
              <div key={category} className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Settings className="w-5 h-5 text-gray-600" />
                    <span className="font-medium text-gray-900">{label}</span>
                    <span className="text-sm text-gray-500">
                      ({enabledCount}/{modules.length} enabled)
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </button>

                {isExpanded && (
                  <div className="divide-y">
                    {modules.map((moduleName) => {
                      const metadata = MODULE_METADATA[moduleName];
                      const isEnabled = getModuleValue(moduleName);
                      const hasChange = moduleName in pendingChanges;

                      return (
                        <div
                          key={moduleName}
                          className={`flex items-center justify-between p-4 ${
                            hasChange ? 'bg-yellow-50' : ''
                          }`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">
                                {metadata.name}
                              </span>
                              <span className={`px-2 py-0.5 text-xs rounded capitalize ${
                                metadata.requiredTier === 'basic' ? 'bg-gray-100 text-gray-600' :
                                metadata.requiredTier === 'standard' ? 'bg-blue-100 text-blue-700' :
                                metadata.requiredTier === 'premium' ? 'bg-purple-100 text-purple-700' :
                                'bg-orange-100 text-orange-700'
                              }`}>
                                {metadata.requiredTier}
                              </span>
                              {hasChange && (
                                <span className="px-2 py-0.5 text-xs bg-yellow-200 text-yellow-800 rounded">
                                  Modified
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                              {metadata.description}
                            </p>
                          </div>
                          <button
                            onClick={() => handleModuleToggle(moduleName, !isEnabled)}
                            className={`
                              relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                              ${isEnabled ? 'bg-green-500' : 'bg-gray-300'}
                            `}
                          >
                            <span
                              className={`
                                inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                                ${isEnabled ? 'translate-x-6' : 'translate-x-1'}
                              `}
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="border-t p-4 bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {hasPendingChanges ? (
              <span className="text-yellow-700 font-medium">
                {Object.keys(pendingChanges).length} unsaved change(s)
              </span>
            ) : (
              <span>No pending changes</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasPendingChanges || saving}
              className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Configuration
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminTenantModuleConfig;
