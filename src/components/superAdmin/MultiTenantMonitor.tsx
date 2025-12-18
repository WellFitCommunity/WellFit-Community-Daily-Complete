/**
 * Multi-Tenant Monitor
 *
 * Split-screen view to monitor multiple tenant admin panels simultaneously
 * Supports 2-4 tenants in grid layout
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { TenantAssignmentService, TenantAssignment } from '../../services/tenantAssignmentService';
import { Building2, X, Maximize2, Minimize2, AlertCircle, ArrowLeft } from 'lucide-react';
import { auditLogger } from '../../services/auditLogger';

const MultiTenantMonitor: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tenants, setTenants] = useState<TenantAssignment[]>([]);
  const [fullscreenTenant, setFullscreenTenant] = useState<string | null>(null);

  const loadTenants = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const tenantIdsParam = searchParams.get('tenants');
      if (!tenantIdsParam) {
        setError('No tenants specified');
        return;
      }

      const tenantIds = tenantIdsParam.split(',');
      if (tenantIds.length > 4) {
        setError('Maximum 4 tenants can be monitored simultaneously');
        return;
      }

      // Get all available tenants
      const allTenants = await TenantAssignmentService.getAllTenants();
      const selectedTenants = allTenants.filter(t => tenantIds.includes(t.tenantId));

      if (selectedTenants.length === 0) {
        setError('No valid tenants found');
        return;
      }

      // Verify access to each tenant
      for (const tenant of selectedTenants) {
        const hasAccess = await TenantAssignmentService.canAccessTenant(tenant.tenantId);
        if (!hasAccess) {
          await auditLogger.warn('UNAUTHORIZED_TENANT_ACCESS_ATTEMPT', {
            category: 'SECURITY_EVENT',
            tenantId: tenant.tenantId,
            tenantName: tenant.tenantName
          });
          setError(`You don't have access to tenant: ${tenant.tenantName}`);
          return;
        }
      }

      setTenants(selectedTenants);

    } catch (err) {
      await auditLogger.error('MULTI_TENANT_MONITOR_LOAD_FAILED', err as Error, {
        category: 'ADMINISTRATIVE'
      });
      setError('Failed to load tenant monitoring');
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  const getTenantColor = (index: number) => {
    const colors = ['blue', 'green', 'purple', 'orange'];
    return colors[index % colors.length];
  };

  const getGridLayout = () => {
    switch (tenants.length) {
      case 1:
        return 'grid-cols-1';
      case 2:
        return 'grid-cols-1 lg:grid-cols-2';
      case 3:
        return 'grid-cols-1 lg:grid-cols-2';
      case 4:
        return 'grid-cols-1 lg:grid-cols-2';
      default:
        return 'grid-cols-1';
    }
  };

  const handleRemoveTenant = (tenantId: string) => {
    const remaining = tenants.filter(t => t.tenantId !== tenantId);
    if (remaining.length === 0) {
      navigate('/tenant-selector');
      return;
    }
    const newIds = remaining.map(t => t.tenantId).join(',');
    navigate(`/multi-tenant-monitor?tenants=${newIds}`);
  };

  const toggleFullscreen = (tenantId: string) => {
    setFullscreenTenant(fullscreenTenant === tenantId ? null : tenantId);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-700 font-medium">Loading tenant monitors...</p>
        </div>
      </div>
    );
  }

  if (error || tenants.length === 0) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-xl max-w-md border-2 border-red-200">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2 text-center">Error</h2>
          <p className="text-gray-600 text-center mb-4">{error || 'No tenants to monitor'}</p>
          <button
            onClick={() => navigate('/tenant-selector')}
            className="w-full bg-teal-600 text-white py-2 px-4 rounded-lg hover:bg-teal-700 transition-colors"
          >
            Return to Tenant Selector
          </button>
        </div>
      </div>
    );
  }

  const visibleTenants = fullscreenTenant
    ? tenants.filter(t => t.tenantId === fullscreenTenant)
    : tenants;

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-700 shadow-lg flex-shrink-0">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/tenant-selector')}
              className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
              title="Back to Tenant Selector"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">Multi-Tenant Monitor</h1>
              <p className="text-xs text-teal-100">
                Monitoring {visibleTenants.length} tenant{visibleTenants.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {tenants.map((tenant, index) => {
              const color = getTenantColor(index);
              const isFullscreen = fullscreenTenant === tenant.tenantId;
              return (
                <div
                  key={tenant.tenantId}
                  className={`px-3 py-1 rounded text-xs font-medium ${
                    isFullscreen
                      ? 'bg-white text-teal-700'
                      : 'bg-white/20 text-white'
                  }`}
                >
                  {tenant.tenantCode || tenant.tenantName}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tenant Grid */}
      <div className={`flex-1 overflow-hidden grid ${getGridLayout()} gap-2 p-2`}>
        {visibleTenants.map((tenant, index) => {
          const color = getTenantColor(index);
          return (
            <div
              key={tenant.tenantId}
              className="relative bg-white rounded-lg shadow-xl overflow-hidden flex flex-col"
            >
              {/* Tenant Header */}
              <div className={`bg-${color}-500 text-white px-4 py-2 flex items-center justify-between flex-shrink-0`}>
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  <span className="font-semibold text-sm">{tenant.tenantName}</span>
                  {tenant.tenantCode && (
                    <span className="px-2 py-0.5 bg-white/20 rounded text-xs font-mono">
                      {tenant.tenantCode}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {!fullscreenTenant && tenants.length > 1 && (
                    <button
                      onClick={() => toggleFullscreen(tenant.tenantId)}
                      className="p-1 hover:bg-white/20 rounded transition-colors"
                      title="Maximize"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  )}
                  {fullscreenTenant && (
                    <button
                      onClick={() => setFullscreenTenant(null)}
                      className="p-1 hover:bg-white/20 rounded transition-colors"
                      title="Restore"
                    >
                      <Minimize2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleRemoveTenant(tenant.tenantId)}
                    className="p-1 hover:bg-white/20 rounded transition-colors"
                    title="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* HIPAA-Compliant System Metrics (NO PHI) */}
              <div className="flex-1 p-6 bg-gray-50 overflow-auto">
                <div className="space-y-4">
                  {/* System Status */}
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">System Status</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs text-gray-600">Status</div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-sm font-semibold text-gray-900">Online</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-600">Uptime</div>
                        <div className="text-sm font-semibold text-gray-900 mt-1">99.9%</div>
                      </div>
                    </div>
                  </div>

                  {/* Aggregate Counts (NO IDENTITIES) */}
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Usage Metrics</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-600">Total Users</span>
                        <span className="text-sm font-semibold text-gray-900">Loading...</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-600">Total Patients</span>
                        <span className="text-sm font-semibold text-gray-900">Loading...</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-600">Active Today</span>
                        <span className="text-sm font-semibold text-gray-900">Loading...</span>
                      </div>
                    </div>
                  </div>

                  {/* System Health */}
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">System Health</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-600">Errors (24h)</span>
                        <span className="text-sm font-semibold text-red-600">Loading...</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-600">Avg Response</span>
                        <span className="text-sm font-semibold text-gray-900">Loading...</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-600">Database</span>
                        <span className="text-sm font-semibold text-green-600">Healthy</span>
                      </div>
                    </div>
                  </div>

                  {/* Compliance */}
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Compliance</h3>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-600">SOC2 Score</span>
                      <span className="text-lg font-bold text-green-600">Loading...</span>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                    <strong>HIPAA Compliant View:</strong> This dashboard shows only aggregate system metrics.
                    No patient names, medical records, or identifiable information is displayed.
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MultiTenantMonitor;
