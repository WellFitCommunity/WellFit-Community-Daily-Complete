/**
 * Multi-Tenant Selector Dashboard
 *
 * Allows Envision staff to select which tenant admin panels to monitor
 * Displays big colorful buttons for each assigned tenant + Master Panel
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TenantAssignmentService, TenantAssignment, SuperAdminProfile } from '../../services/tenantAssignmentService';
import { Building2, Shield, Activity, AlertCircle, Grid3x3, Maximize2 } from 'lucide-react';
import { auditLogger } from '../../services/auditLogger';

const MultiTenantSelector: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<SuperAdminProfile | null>(null);
  const [allTenants, setAllTenants] = useState<TenantAssignment[]>([]);
  const [selectedTenants, setSelectedTenants] = useState<TenantAssignment[]>([]);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      const userProfile = await TenantAssignmentService.getCurrentUserProfile();
      if (!userProfile) {
        setError('Unable to load user profile');
        return;
      }

      setProfile(userProfile);

      // If super admin, get all tenants
      if (userProfile.isSuperAdmin) {
        const tenants = await TenantAssignmentService.getAllTenants();
        setAllTenants(tenants);
      } else {
        // Regular admin, only show assigned tenants
        setAllTenants(userProfile.assignedTenants);
      }

    } catch (err) {
      await auditLogger.error('MULTI_TENANT_SELECTOR_LOAD_FAILED', err as Error, {
        category: 'ADMINISTRATIVE'
      });
      setError('Failed to load tenant assignments');
    } finally {
      setLoading(false);
    }
  };

  const getTenantColor = (index: number) => {
    const colors = [
      { bg: 'bg-blue-500', hover: 'hover:bg-blue-600', text: 'text-blue-600', bgLight: 'bg-blue-50' },
      { bg: 'bg-green-500', hover: 'hover:bg-green-600', text: 'text-green-600', bgLight: 'bg-green-50' },
      { bg: 'bg-purple-500', hover: 'hover:bg-purple-600', text: 'text-purple-600', bgLight: 'bg-purple-50' },
      { bg: 'bg-orange-500', hover: 'hover:bg-orange-600', text: 'text-orange-600', bgLight: 'bg-orange-50' },
      { bg: 'bg-pink-500', hover: 'hover:bg-pink-600', text: 'text-pink-600', bgLight: 'bg-pink-50' },
      { bg: 'bg-indigo-500', hover: 'hover:bg-indigo-600', text: 'text-indigo-600', bgLight: 'bg-indigo-50' },
    ];
    return colors[index % colors.length];
  };

  const handleTenantSelect = (tenant: TenantAssignment) => {
    const isSelected = selectedTenants.some(t => t.tenantId === tenant.tenantId);

    if (isSelected) {
      setSelectedTenants(selectedTenants.filter(t => t.tenantId !== tenant.tenantId));
    } else {
      if (selectedTenants.length >= 4) {
        setError('Maximum 4 tenants can be monitored simultaneously');
        return;
      }
      setSelectedTenants([...selectedTenants, tenant]);
    }
  };

  const handleOpenMasterPanel = () => {
    navigate('/super-admin');
  };

  const handleOpenSelected = () => {
    if (selectedTenants.length === 0) {
      setError('Please select at least one tenant to monitor');
      return;
    }

    // Navigate to multi-tenant view
    const tenantIds = selectedTenants.map(t => t.tenantId).join(',');
    navigate(`/multi-tenant-monitor?tenants=${tenantIds}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-teal-900 font-medium">Loading tenant assignments...</p>
        </div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-blue-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-xl max-w-md border-2 border-red-200">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2 text-center">Error</h2>
          <p className="text-gray-600 text-center">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 w-full bg-teal-600 text-white py-2 px-4 rounded-lg hover:bg-teal-700 transition-colors"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-blue-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Envision Atlas</h1>
              <p className="text-sm text-teal-100 mt-1">Multi-Tenant Monitoring Dashboard</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-white/20 backdrop-blur-sm border border-white/30 px-4 py-2 rounded-lg">
                <span className="text-sm font-medium text-white">{profile?.email}</span>
              </div>
              {profile?.isSuperAdmin && (
                <div className="bg-white/20 backdrop-blur-sm border border-white/30 px-3 py-2 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-white" />
                    <span className="text-xs font-medium text-white">Super Admin</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Instructions */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Select Tenants to Monitor</h2>
          <p className="text-sm text-gray-600">
            Click on tenant cards to select them. You can monitor up to 4 tenants simultaneously in a grid layout.
            {profile?.isSuperAdmin && ' As a Super Admin, you can also access the Master Panel to manage all tenants.'}
          </p>
          {selectedTenants.length > 0 && (
            <div className="mt-4 flex items-center gap-2">
              <span className="text-sm font-medium text-teal-700">
                Selected: {selectedTenants.length} tenant{selectedTenants.length > 1 ? 's' : ''}
              </span>
              <button
                onClick={handleOpenSelected}
                className="ml-auto bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-2 shadow-sm"
              >
                <Grid3x3 className="w-4 h-4" />
                Open Multi-View
              </button>
            </div>
          )}
        </div>

        {error && profile && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          </div>
        )}

        {/* Master Panel Button (Super Admins Only) */}
        {profile?.isSuperAdmin && (
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Master Control</h3>
            <button
              onClick={handleOpenMasterPanel}
              className="w-full md:w-auto group relative overflow-hidden bg-gradient-to-r from-red-500 to-red-600 text-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            >
              <div className="flex items-center gap-4">
                <div className="p-4 bg-white/20 rounded-lg">
                  <Shield className="w-12 h-12" />
                </div>
                <div className="text-left">
                  <div className="text-2xl font-bold mb-1">Envision Atlas Master Panel</div>
                  <div className="text-sm text-red-100">System-wide tenant and feature management</div>
                </div>
                <Maximize2 className="w-6 h-6 ml-auto opacity-60 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          </div>
        )}

        {/* Tenant Grid */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
            Your Tenants {allTenants.length > 0 && `(${allTenants.length})`}
          </h3>

          {allTenants.length === 0 ? (
            <div className="bg-white p-12 rounded-lg shadow text-center">
              <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Tenants Assigned</h3>
              <p className="text-gray-600">
                You don't have any tenant assignments yet. Contact your system administrator.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {allTenants.map((tenant, index) => {
                const isSelected = selectedTenants.some(t => t.tenantId === tenant.tenantId);
                const colors = getTenantColor(index);

                return (
                  <button
                    key={tenant.tenantId}
                    onClick={() => handleTenantSelect(tenant)}
                    className={`group relative text-left p-6 rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105 ${
                      isSelected
                        ? `${colors.bg} text-white ring-4 ring-offset-2 ring-${colors.bg}`
                        : 'bg-white hover:shadow-xl'
                    }`}
                  >
                    {/* Selection Indicator */}
                    {isSelected && (
                      <div className="absolute top-3 right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md">
                        <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start gap-4 mb-4">
                      <div className={`p-3 rounded-lg ${isSelected ? 'bg-white/20' : colors.bgLight}`}>
                        <Building2 className={`w-8 h-8 ${isSelected ? 'text-white' : colors.text}`} />
                      </div>
                      <div className="flex-1">
                        <h4 className={`text-xl font-bold mb-1 ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                          {tenant.tenantName}
                        </h4>
                        {tenant.tenantCode && (
                          <div className={`inline-block px-2 py-1 rounded text-xs font-mono font-semibold ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {tenant.tenantCode}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className={`text-sm ${isSelected ? 'text-white/90' : 'text-gray-600'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Activity className="w-4 h-4" />
                        <span>{tenant.subdomain}.wellfit.com</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : 'bg-green-500'}`}></div>
                        <span className="font-medium">Active</span>
                      </div>
                    </div>

                    <div className={`mt-4 pt-4 border-t ${isSelected ? 'border-white/20' : 'border-gray-200'}`}>
                      <div className={`text-xs font-medium ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>
                        Click to {isSelected ? 'deselect' : 'select'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MultiTenantSelector;
