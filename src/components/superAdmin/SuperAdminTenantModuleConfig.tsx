/**
 * SuperAdmin Tenant Module Entitlement Configuration
 *
 * Allows Envision Atlus SuperAdmin to configure module ENTITLEMENTS for any tenant.
 *
 * Two-Tier Control Model:
 * - ENTITLEMENTS (this panel): What the tenant has PAID FOR (ceiling)
 * - ACTIVE STATE (TenantModuleConfigPanel): What tenant admin has ENABLED
 *
 * A module is only accessible if: entitled=true AND enabled=true
 *
 * Features:
 * - Configure entitlements for any tenant
 * - Set license tier (determines default feature access)
 * - View tenant's current active states
 * - Full audit trail for all changes
 * - Envision Atlus professional EMR branding
 */

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { TenantWithStatus } from '../../types/superAdmin';
import {
  MODULE_METADATA,
  type ModuleName,
  type LicenseTier,
  type TenantModuleConfig,
  type EntitlementName,
  getEntitlementName
} from '../../types/tenantModules';
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
  ChevronUp,
  Key,
  ToggleLeft,
  Crown,
  Info
} from 'lucide-react';

interface SuperAdminTenantModuleConfigProps {
  tenant: TenantWithStatus;
  onClose: () => void;
  onSaved?: () => void;
}

// Envision Atlus brand colors
const ATLUS_COLORS = {
  primary: '#0D9488', // teal-600
  primaryDark: '#0F766E', // teal-700
  accent: '#06B6D4', // cyan-500
  gradientFrom: '#0D9488', // teal-600
  gradientTo: '#0891B2', // cyan-600
};

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
  const [pendingChanges, setPendingChanges] = useState<Record<string, boolean | string>>({});
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

  const loadTenantConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('tenant_module_config')
        .select('*')
        .eq('tenant_id', tenant.tenantId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      // If no config exists, create default with basic entitlements
      if (!data) {
        const defaultConfig: Partial<TenantModuleConfig> = {
          tenant_id: tenant.tenantId,
          license_tier: 'basic',
          // Default entitlements (basic tier)
          community_entitled: true,
          dashboard_entitled: true,
          check_ins_entitled: true,
          dental_entitled: false,
          sdoh_entitled: false,
          pharmacy_entitled: false,
          medications_entitled: true,
          telehealth_entitled: false,
          messaging_entitled: true,
          ehr_integration_entitled: false,
          fhir_entitled: false,
          ai_scribe_entitled: false,
          claude_care_entitled: false,
          guardian_monitoring_entitled: false,
          nurseos_clarity_entitled: false,
          nurseos_shield_entitled: false,
          resilience_hub_entitled: false,
          billing_integration_entitled: false,
          rpm_ccm_entitled: false,
          hipaa_audit_logging_entitled: true,
          mfa_enforcement_entitled: false,
          // Default active states (same as entitlements initially)
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
      await auditLogger.error('SUPER_ADMIN_TENANT_ENTITLEMENT_LOAD_FAILED', err as Error, {
        tenantId: tenant.tenantId,
        tenantName: tenant.tenantName
      });
      setError('Failed to load tenant entitlement configuration');
    } finally {
      setLoading(false);
    }
  }, [tenant.tenantId, tenant.tenantName]);

  useEffect(() => {
    loadTenantConfig();
  }, [loadTenantConfig]);

  // Handle entitlement toggle (SuperAdmin controls this)
  const handleEntitlementToggle = (moduleName: ModuleName, entitled: boolean) => {
    const entitlementName = getEntitlementName(moduleName);
    setPendingChanges(prev => ({
      ...prev,
      [entitlementName]: entitled
    }));
    setSuccess(false);
  };

  const handleLicenseTierChange = (tier: LicenseTier) => {
    setPendingChanges(prev => ({
      ...prev,
      license_tier: tier
    }));
    setSuccess(false);
  };

  // Apply tier defaults to entitlements
  const applyTierDefaults = (tier: LicenseTier) => {
    const tierDefaults: Record<LicenseTier, Partial<Record<EntitlementName, boolean>>> = {
      basic: {
        community_entitled: true,
        dashboard_entitled: true,
        check_ins_entitled: true,
        medications_entitled: true,
        messaging_entitled: true,
        hipaa_audit_logging_entitled: true,
      },
      standard: {
        community_entitled: true,
        dashboard_entitled: true,
        check_ins_entitled: true,
        medications_entitled: true,
        messaging_entitled: true,
        dental_entitled: true,
        sdoh_entitled: true,
        resilience_hub_entitled: true,
        hipaa_audit_logging_entitled: true,
        mfa_enforcement_entitled: true,
      },
      premium: {
        community_entitled: true,
        dashboard_entitled: true,
        check_ins_entitled: true,
        medications_entitled: true,
        messaging_entitled: true,
        dental_entitled: true,
        sdoh_entitled: true,
        pharmacy_entitled: true,
        telehealth_entitled: true,
        fhir_entitled: true,
        ai_scribe_entitled: true,
        claude_care_entitled: true,
        nurseos_clarity_entitled: true,
        nurseos_shield_entitled: true,
        resilience_hub_entitled: true,
        billing_integration_entitled: true,
        rpm_ccm_entitled: true,
        hipaa_audit_logging_entitled: true,
        mfa_enforcement_entitled: true,
      },
      enterprise: {
        community_entitled: true,
        dashboard_entitled: true,
        check_ins_entitled: true,
        medications_entitled: true,
        messaging_entitled: true,
        dental_entitled: true,
        sdoh_entitled: true,
        pharmacy_entitled: true,
        telehealth_entitled: true,
        ehr_integration_entitled: true,
        fhir_entitled: true,
        ai_scribe_entitled: true,
        claude_care_entitled: true,
        guardian_monitoring_entitled: true,
        nurseos_clarity_entitled: true,
        nurseos_shield_entitled: true,
        resilience_hub_entitled: true,
        billing_integration_entitled: true,
        rpm_ccm_entitled: true,
        hipaa_audit_logging_entitled: true,
        mfa_enforcement_entitled: true,
      },
    };

    const defaults = tierDefaults[tier];
    const allEntitlements: EntitlementName[] = [
      'community_entitled', 'dashboard_entitled', 'check_ins_entitled',
      'dental_entitled', 'sdoh_entitled', 'pharmacy_entitled', 'medications_entitled',
      'telehealth_entitled', 'messaging_entitled',
      'ehr_integration_entitled', 'fhir_entitled',
      'ai_scribe_entitled', 'claude_care_entitled', 'guardian_monitoring_entitled',
      'nurseos_clarity_entitled', 'nurseos_shield_entitled', 'resilience_hub_entitled',
      'billing_integration_entitled', 'rpm_ccm_entitled',
      'hipaa_audit_logging_entitled', 'mfa_enforcement_entitled'
    ];

    const newChanges: Record<string, boolean | string> = { license_tier: tier };
    allEntitlements.forEach(ent => {
      newChanges[ent] = defaults[ent] ?? false;
    });

    setPendingChanges(newChanges);
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

      // Prepare update payload with entitlement audit fields
      const updatePayload: Record<string, unknown> = {
        ...pendingChanges,
        entitlements_updated_at: new Date().toISOString(),
        entitlements_updated_by: superAdmin.id,
        updated_at: new Date().toISOString(),
        updated_by: superAdmin.id
      };

      // Check if config exists
      const { data: existing } = await supabase
        .from('tenant_module_config')
        .select('id')
        .eq('tenant_id', tenant.tenantId)
        .single();

      if (existing) {
        // Update existing
        const { error: updateError } = await supabase
          .from('tenant_module_config')
          .update(updatePayload)
          .eq('tenant_id', tenant.tenantId);

        if (updateError) throw updateError;
      } else {
        // Insert new
        const { error: insertError } = await supabase
          .from('tenant_module_config')
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
        action: 'tenant.entitlements.update',
        targetType: 'tenant',
        targetId: tenant.tenantId,
        targetName: tenant.tenantName,
        oldValue: config ?? undefined,
        newValue: { ...config, ...pendingChanges },
        severity: 'warning' // Entitlement changes are important
      });

      setSuccess(true);
      setPendingChanges({});
      await loadTenantConfig();
      onSaved?.();

      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      await auditLogger.error('SUPER_ADMIN_TENANT_ENTITLEMENT_SAVE_FAILED', err as Error, {
        tenantId: tenant.tenantId,
        changes: pendingChanges
      });
      setError((err as Error).message || 'Failed to save entitlement configuration');
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

  // Get entitlement value (what SuperAdmin has granted)
  const getEntitlementValue = (moduleName: ModuleName): boolean => {
    const entitlementName = getEntitlementName(moduleName);
    if (entitlementName in pendingChanges) {
      return pendingChanges[entitlementName] as boolean;
    }
    return (config as unknown as Record<string, boolean>)?.[entitlementName] ?? false;
  };

  // Get active state (what Tenant Admin has enabled)
  const getActiveValue = (moduleName: ModuleName): boolean => {
    return (config as unknown as Record<string, boolean>)?.[moduleName] ?? false;
  };

  const getCurrentTier = (): LicenseTier => {
    if ('license_tier' in pendingChanges) {
      return pendingChanges.license_tier as LicenseTier;
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

  const categoryLabels: Record<string, { label: string; icon: string }> = {
    core: { label: 'Core Platform', icon: 'layout' },
    clinical: { label: 'Clinical Modules', icon: 'heart' },
    communication: { label: 'Communication', icon: 'message' },
    integration: { label: 'Integrations', icon: 'plug' },
    advanced: { label: 'Advanced AI Features', icon: 'brain' },
    nurseos: { label: 'NurseOS Suite', icon: 'nurse' },
    billing: { label: 'Billing & Revenue', icon: 'dollar' },
    security: { label: 'Security & Compliance', icon: 'shield' },
  };

  const hasPendingChanges = Object.keys(pendingChanges).length > 0;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 p-8">
          <div className="flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: ATLUS_COLORS.primary }} />
            <span className="ml-3 text-gray-600">Loading entitlement configuration...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Envision Atlus Header */}
        <div
          className="p-6 text-white"
          style={{ background: `linear-gradient(135deg, ${ATLUS_COLORS.gradientFrom} 0%, ${ATLUS_COLORS.gradientTo} 100%)` }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <Key className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold">Module Entitlements</h2>
                  <span className="px-2 py-0.5 bg-white/20 rounded text-xs font-medium">
                    Envision Atlus
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Building2 className="w-4 h-4 opacity-80" />
                  <p className="text-teal-100">{tenant.tenantName}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-white/20 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                <Shield className="w-4 h-4" />
                SuperAdmin Control
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Info Banner */}
        <div className="mx-6 mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">Two-Tier Control Model</p>
            <p className="mt-1">
              <span className="font-medium">Entitlements</span> (you set): What the tenant has paid for (the ceiling).<br />
              <span className="font-medium">Active State</span> (tenant sets): What they've chosen to enable from their entitlements.
            </p>
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
            <span className="text-green-800">Entitlements saved successfully!</span>
          </div>
        )}

        {/* License Tier Selector */}
        <div className="p-6 border-b bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Crown className="w-4 h-4" style={{ color: ATLUS_COLORS.primary }} />
                License Tier
              </label>
              <div className="flex gap-2">
                {(['basic', 'standard', 'premium', 'enterprise'] as LicenseTier[]).map((tier) => (
                  <button
                    key={tier}
                    onClick={() => handleLicenseTierChange(tier)}
                    className={`px-4 py-2 rounded-lg font-medium capitalize transition-all ${
                      getCurrentTier() === tier
                        ? 'text-white shadow-md'
                        : 'bg-white text-gray-700 border hover:bg-gray-100'
                    }`}
                    style={getCurrentTier() === tier ? { backgroundColor: ATLUS_COLORS.primary } : {}}
                  >
                    {tier}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => applyTierDefaults(getCurrentTier())}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Apply Tier Defaults
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Tier determines default entitlements. You can customize individual modules below.
          </p>
        </div>

        {/* Module List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {Object.entries(categoryLabels).map(([category, { label }]) => {
            const modules = modulesByCategory[category];
            if (!modules || modules.length === 0) return null;

            const isExpanded = expandedCategories[category];
            const entitledCount = modules.filter(m => getEntitlementValue(m)).length;
            const activeCount = modules.filter(m => getActiveValue(m)).length;

            return (
              <div key={category} className="border rounded-lg overflow-hidden shadow-sm">
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Settings className="w-5 h-5" style={{ color: ATLUS_COLORS.primary }} />
                    <span className="font-medium text-gray-900">{label}</span>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-teal-100 text-teal-700 text-xs rounded-full font-medium">
                        {entitledCount}/{modules.length} entitled
                      </span>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                        {activeCount} active
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
                  <div className="divide-y">
                    {modules.map((moduleName) => {
                      const metadata = MODULE_METADATA[moduleName];
                      const isEntitled = getEntitlementValue(moduleName);
                      const isActive = getActiveValue(moduleName);
                      const entitlementName = getEntitlementName(moduleName);
                      const hasChange = entitlementName in pendingChanges;

                      return (
                        <div
                          key={moduleName}
                          className={`flex items-center justify-between p-4 ${
                            hasChange ? 'bg-yellow-50' : ''
                          }`}
                        >
                          <div className="flex-1 mr-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-gray-900">
                                {metadata.name}
                              </span>
                              <span className={`px-2 py-0.5 text-xs rounded capitalize ${
                                metadata.requiredTier === 'basic' ? 'bg-gray-100 text-gray-600' :
                                metadata.requiredTier === 'standard' ? 'bg-blue-100 text-blue-700' :
                                metadata.requiredTier === 'premium' ? 'bg-purple-100 text-purple-700' :
                                'bg-orange-100 text-orange-700'
                              }`}>
                                {metadata.requiredTier} tier
                              </span>
                              {hasChange && (
                                <span className="px-2 py-0.5 text-xs bg-yellow-200 text-yellow-800 rounded font-medium">
                                  Modified
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                              {metadata.description}
                            </p>
                            {/* Active state indicator */}
                            <div className="flex items-center gap-2 mt-2">
                              <ToggleLeft className="w-4 h-4 text-gray-400" />
                              <span className="text-xs text-gray-500">
                                Tenant status:{' '}
                                <span className={isActive ? 'text-green-600 font-medium' : 'text-gray-500'}>
                                  {isActive ? 'Active' : 'Inactive'}
                                </span>
                                {isEntitled && !isActive && (
                                  <span className="text-yellow-600 ml-1">(entitled but not activated)</span>
                                )}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-xs text-gray-500 font-medium">Entitlement</span>
                            <button
                              onClick={() => handleEntitlementToggle(moduleName, !isEntitled)}
                              className={`
                                relative inline-flex h-7 w-14 items-center rounded-full transition-colors shadow-inner
                                ${isEntitled ? '' : 'bg-gray-300'}
                              `}
                              style={isEntitled ? { backgroundColor: ATLUS_COLORS.primary } : {}}
                              aria-label={`Toggle ${metadata.name} entitlement`}
                            >
                              <span
                                className={`
                                  inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform
                                  ${isEntitled ? 'translate-x-8' : 'translate-x-1'}
                                `}
                              />
                            </button>
                          </div>
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
              <span className="text-yellow-700 font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {Object.keys(pendingChanges).length} unsaved change(s)
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                All changes saved
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasPendingChanges || saving}
              className="px-6 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors font-medium shadow-md hover:shadow-lg"
              style={{ backgroundColor: hasPendingChanges && !saving ? ATLUS_COLORS.primary : undefined }}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Entitlements
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
