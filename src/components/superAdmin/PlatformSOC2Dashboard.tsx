/**
 * Platform-Wide SOC2 Compliance Dashboard
 *
 * Master Panel view for Envision VirtualEdge Group LLC
 * Shows compliance metrics across ALL tenants
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Shield, AlertTriangle, CheckCircle, TrendingUp, Building2, FileText, Activity } from 'lucide-react';
import { auditLogger } from '../../services/auditLogger';

interface TenantComplianceMetrics {
  tenantId: string;
  tenantName: string;
  tenantCode: string | null;
  complianceScore: number;
  criticalIssues: number;
  warnings: number;
  lastAuditDate: string;
  hipaaCompliant: boolean;
  mfaEnforced: boolean;
  auditLogsEnabled: boolean;
  hasModuleConfig: boolean; // Track if module config was found
}

interface PlatformMetrics {
  totalTenants: number;
  compliantTenants: number;
  tenantsWithIssues: number;
  avgComplianceScore: number;
  criticalIssuesTotal: number;
  warningsTotal: number;
}

// Raw tenant data from database query
interface TenantRow {
  id: string;
  name: string;
  tenant_code: string | null;
}

const PlatformSOC2Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [platformMetrics, setPlatformMetrics] = useState<PlatformMetrics | null>(null);
  const [tenantMetrics, setTenantMetrics] = useState<TenantComplianceMetrics[]>([]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'compliant' | 'issues'>('all');

  const loadPlatformCompliance = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get all tenants
      const { data: tenants, error: tenantsError } = await supabase
        .from('tenants')
        .select('id, name, tenant_code')
        .order('name');

      if (tenantsError) throw tenantsError;

      // Get module configs separately (more reliable than embedded query with RLS)
      const { data: moduleConfigs } = await supabase
        .from('tenant_module_config')
        .select('tenant_id, hipaa_audit_logging, mfa_enforcement');

      // Create lookup map for module configs
      const moduleConfigMap = new Map(
        (moduleConfigs || []).map((mc: { tenant_id: string; hipaa_audit_logging: boolean; mfa_enforcement: boolean }) => [mc.tenant_id, mc])
      );

      // Calculate compliance metrics for each tenant
      const tenantComplianceData: TenantComplianceMetrics[] = await Promise.all(
        (tenants || []).map(async (tenant: TenantRow) => {
          // Get audit log count for this tenant (as a compliance indicator)
          const { count: auditCount } = await supabase
            .from('admin_audit_logs')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenant.id)
            .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

          // Get latest audit log
          const { data: latestAudit } = await supabase
            .from('admin_audit_logs')
            .select('created_at')
            .eq('tenant_id', tenant.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          // Get module config from the lookup map
          const moduleConfig = moduleConfigMap.get(tenant.id);
          const hasModuleConfig = Boolean(moduleConfig);
          const hipaaCompliant = Boolean(moduleConfig?.hipaa_audit_logging);
          const mfaEnforced = Boolean(moduleConfig?.mfa_enforcement);
          const auditLogsEnabled = (auditCount || 0) > 0;

          // Calculate compliance score (0-100)
          let complianceScore = 0;
          if (hipaaCompliant) complianceScore += 40;
          if (mfaEnforced) complianceScore += 30;
          if (auditLogsEnabled) complianceScore += 30;

          // Determine issues
          let criticalIssues = 0;
          let warnings = 0;

          if (!hipaaCompliant) criticalIssues++;
          if (!mfaEnforced) warnings++;
          if (!auditLogsEnabled) warnings++;

          return {
            tenantId: tenant.id,
            tenantName: tenant.name,
            tenantCode: tenant.tenant_code,
            complianceScore,
            criticalIssues,
            warnings,
            lastAuditDate: latestAudit?.created_at || 'Never',
            hipaaCompliant,
            mfaEnforced,
            auditLogsEnabled,
            hasModuleConfig
          };
        })
      );

      setTenantMetrics(tenantComplianceData);

      // Calculate platform-wide metrics
      const compliantTenants = tenantComplianceData.filter(t => t.complianceScore >= 80).length;
      const tenantsWithIssues = tenantComplianceData.filter(t => t.criticalIssues > 0).length;
      const avgScore = tenantComplianceData.reduce((sum, t) => sum + t.complianceScore, 0) / tenantComplianceData.length;
      const totalCritical = tenantComplianceData.reduce((sum, t) => sum + t.criticalIssues, 0);
      const totalWarnings = tenantComplianceData.reduce((sum, t) => sum + t.warnings, 0);

      setPlatformMetrics({
        totalTenants: tenantComplianceData.length,
        compliantTenants,
        tenantsWithIssues,
        avgComplianceScore: Math.round(avgScore),
        criticalIssuesTotal: totalCritical,
        warningsTotal: totalWarnings
      });

    } catch (err) {
      await auditLogger.error('PLATFORM_SOC2_DASHBOARD_LOAD_FAILED', err as Error, {
        category: 'ADMINISTRATIVE'
      });
      setError('Failed to load platform compliance data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlatformCompliance();
  }, [loadPlatformCompliance]);

  const getComplianceColor = (score: number) => {
    if (score >= 80) return { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-200' };
    if (score >= 60) return { bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border-yellow-200' };
    return { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200' };
  };

  const filteredTenants = tenantMetrics.filter(tenant => {
    if (filterStatus === 'compliant') return tenant.complianceScore >= 80;
    if (filterStatus === 'issues') return tenant.criticalIssues > 0;
    return true;
  });

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded-sm w-1/3"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-sm"></div>
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
          onClick={loadPlatformCompliance}
          className="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors shadow-xs"
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
            <h2 className="text-xl font-bold text-gray-900">Platform SOC2 Compliance</h2>
            <p className="text-sm text-gray-600 mt-1">
              Cross-tenant security and compliance monitoring
            </p>
          </div>
          <button
            onClick={loadPlatformCompliance}
            disabled={loading}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2 transition-colors shadow-xs"
          >
            <Activity className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Platform-Wide Metrics */}
        {platformMetrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                <span className="font-semibold text-blue-900">Total Tenants</span>
              </div>
              <div className="text-3xl font-bold text-blue-900">
                {platformMetrics.totalTenants}
              </div>
              <div className="text-sm text-blue-700 mt-1">
                {platformMetrics.compliantTenants} compliant
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-green-900">Avg Compliance</span>
              </div>
              <div className="text-3xl font-bold text-green-900">
                {platformMetrics.avgComplianceScore}%
              </div>
              <div className="text-sm text-green-700 mt-1">
                Platform-wide score
              </div>
            </div>

            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <span className="font-semibold text-red-900">Critical Issues</span>
              </div>
              <div className="text-3xl font-bold text-red-900">
                {platformMetrics.criticalIssuesTotal}
              </div>
              <div className="text-sm text-red-700 mt-1">
                {platformMetrics.tenantsWithIssues} tenants affected
              </div>
            </div>

            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-yellow-600" />
                <span className="font-semibold text-yellow-900">Warnings</span>
              </div>
              <div className="text-3xl font-bold text-yellow-900">
                {platformMetrics.warningsTotal}
              </div>
              <div className="text-sm text-yellow-700 mt-1">
                Non-critical issues
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Filter:</span>
          {[
            { id: 'all', label: 'All Tenants' },
            { id: 'compliant', label: 'Compliant (≥80%)' },
            { id: 'issues', label: 'Has Issues' }
          ].map((filter) => (
            <button
              key={filter.id}
              onClick={() => setFilterStatus(filter.id as typeof filterStatus)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors shadow-xs ${
                filterStatus === filter.id
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tenant Compliance List */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Tenant Compliance ({filteredTenants.length})
        </h3>

        {filteredTenants.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Shield className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p>No tenants found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTenants.map((tenant) => {
              const colors = getComplianceColor(tenant.complianceScore);
              return (
                <div
                  key={tenant.tenantId}
                  className={`border rounded-lg p-4 ${colors.border} ${colors.bg}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-gray-900">{tenant.tenantName}</h4>
                        {tenant.tenantCode && (
                          <span className="px-2 py-1 bg-white rounded-sm text-xs font-mono font-medium text-blue-700">
                            {tenant.tenantCode}
                          </span>
                        )}
                      </div>

                      {/* Compliance Indicators with hover details */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        <div
                          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium cursor-help ${
                            tenant.hipaaCompliant
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                          title={
                            !tenant.hasModuleConfig
                              ? 'CRITICAL: No module configuration found for this tenant. Go to Tenant Settings to configure.'
                              : tenant.hipaaCompliant
                              ? 'HIPAA audit logging is enabled'
                              : 'CRITICAL: HIPAA audit logging is DISABLED. Enable it in Tenant Module Config → hipaa_audit_logging'
                          }
                        >
                          {tenant.hipaaCompliant ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                          HIPAA Logging
                          {!tenant.hasModuleConfig && <span className="ml-1 text-red-600">(No Config)</span>}
                        </div>
                        <div
                          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium cursor-help ${
                            tenant.mfaEnforced
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                          title={
                            tenant.mfaEnforced
                              ? 'MFA is enforced for all users'
                              : 'WARNING: MFA is not enforced. Enable it in Tenant Module Config → mfa_enforcement'
                          }
                        >
                          {tenant.mfaEnforced ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                          MFA Enforced
                        </div>
                        <div
                          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium cursor-help ${
                            tenant.auditLogsEnabled
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                          title={
                            tenant.auditLogsEnabled
                              ? 'Audit logs are being recorded'
                              : 'WARNING: No audit logs found in the last 30 days. Ensure admin actions are being logged.'
                          }
                        >
                          {tenant.auditLogsEnabled ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                          Audit Logs
                        </div>
                      </div>

                      <div className="text-sm text-gray-600">
                        Last audit: {tenant.lastAuditDate === 'Never' ? 'Never' : new Date(tenant.lastAuditDate).toLocaleDateString()}
                      </div>
                    </div>

                    {/* Compliance Score */}
                    <div className="text-right">
                      <div className={`text-3xl font-bold ${colors.text}`}>
                        {tenant.complianceScore}%
                      </div>
                      <div className="text-xs text-gray-600 mt-1">Compliance Score</div>
                      {tenant.criticalIssues > 0 && (
                        <div className="mt-2 px-2 py-1 bg-red-600 text-white rounded-sm text-xs font-medium">
                          {tenant.criticalIssues} Critical
                        </div>
                      )}
                      {tenant.warnings > 0 && tenant.criticalIssues === 0 && (
                        <div className="mt-2 px-2 py-1 bg-yellow-600 text-white rounded-sm text-xs font-medium">
                          {tenant.warnings} Warnings
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Compliance Notes */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-medium mb-1">SOC 2 Compliance Scoring</p>
            <p className="text-blue-800">
              Compliance scores are calculated based on: HIPAA audit logging enabled (40%), MFA enforcement (30%),
              and active audit logging (30%). Scores ≥80% are considered compliant.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlatformSOC2Dashboard;
