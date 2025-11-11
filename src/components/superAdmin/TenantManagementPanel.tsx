import React, { useState, useEffect } from 'react';
import { SuperAdminService } from '../../services/superAdminService';
import { TenantWithStatus, SuperAdminUser } from '../../types/superAdmin';
import { Building2, Users, Activity, AlertCircle, CheckCircle, XCircle, Eye, Settings, Edit2, Hash } from 'lucide-react';
import { auditLogger } from '../../services/auditLogger';

interface TenantManagementPanelProps {
  onViewTenant?: (tenantId: string) => void;
}

const TenantManagementPanel: React.FC<TenantManagementPanelProps> = ({ onViewTenant }) => {
  const [tenants, setTenants] = useState<TenantWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [superAdmin, setSuperAdmin] = useState<SuperAdminUser | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<TenantWithStatus | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'suspend' | 'activate' | null>(null);
  const [showEditCodeDialog, setShowEditCodeDialog] = useState(false);
  const [editTenantCode, setEditTenantCode] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [tenantsData, adminData] = await Promise.all([
        SuperAdminService.getAllTenants(),
        SuperAdminService.getCurrentSuperAdmin()
      ]);
      setTenants(tenantsData);
      setSuperAdmin(adminData);
    } catch (err) {
      await auditLogger.error('SUPER_ADMIN_TENANTS_LOAD_FAILED', err as Error, {
        category: 'ADMINISTRATIVE'
      });
      setError('Failed to load tenant data');
    } finally {
      setLoading(false);
    }
  };

  const handleSuspendTenant = async (tenant: TenantWithStatus) => {
    setSelectedTenant(tenant);
    setConfirmAction('suspend');
    setShowConfirmDialog(true);
  };

  const handleActivateTenant = async (tenant: TenantWithStatus) => {
    setSelectedTenant(tenant);
    setConfirmAction('activate');
    setShowConfirmDialog(true);
  };

  const confirmTenantAction = async () => {
    if (!selectedTenant || !superAdmin || !confirmAction) return;

    try {
      setActionLoading(selectedTenant.tenantId);
      setShowConfirmDialog(false);

      if (confirmAction === 'suspend') {
        await SuperAdminService.suspendTenant({
          tenantId: selectedTenant.tenantId,
          reason: `Suspended by ${superAdmin.displayName}`,
          superAdminId: superAdmin.id
        });
      } else {
        await SuperAdminService.activateTenant({
          tenantId: selectedTenant.tenantId,
          superAdminId: superAdmin.id
        });
      }

      // Reload data
      await loadData();
    } catch (err) {
      await auditLogger.error(`SUPER_ADMIN_TENANT_${confirmAction?.toUpperCase()}_FAILED`, err as Error, {
        category: 'SECURITY_EVENT',
        tenantId: selectedTenant.tenantId,
        action: confirmAction
      });
      setError(`Failed to ${confirmAction} tenant`);
    } finally {
      setActionLoading(null);
      setSelectedTenant(null);
      setConfirmAction(null);
    }
  };

  const handleEditTenantCode = (tenant: TenantWithStatus) => {
    setSelectedTenant(tenant);
    setEditTenantCode(tenant.tenantCode || '');
    setShowEditCodeDialog(true);
  };

  const saveTenantCode = async () => {
    if (!selectedTenant || !superAdmin) return;

    // Validate format
    const codePattern = /^[A-Z]{1,4}-[0-9]{4,6}$/;
    if (editTenantCode && !codePattern.test(editTenantCode.toUpperCase())) {
      setError('Invalid format. Use PREFIX-NUMBER (e.g., "MH-6702")');
      return;
    }

    try {
      setActionLoading(selectedTenant.tenantId);
      setShowEditCodeDialog(false);

      await SuperAdminService.updateTenantCode({
        tenantId: selectedTenant.tenantId,
        tenantCode: editTenantCode.toUpperCase(),
        superAdminId: superAdmin.id
      });

      // Reload data
      await loadData();
    } catch (err) {
      await auditLogger.error('SUPER_ADMIN_TENANT_CODE_UPDATE_FAILED', err as Error, {
        category: 'ADMINISTRATIVE',
        tenantId: selectedTenant.tenantId
      });
      setError((err as Error).message || 'Failed to update tenant code');
    } finally {
      setActionLoading(null);
      setSelectedTenant(null);
      setEditTenantCode('');
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center gap-3 text-red-600">
          <AlertCircle className="w-6 h-6" />
          <p>{error}</p>
        </div>
        <button
          onClick={loadData}
          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Tenant Management</h2>
            <p className="text-sm text-gray-600 mt-1">
              Manage all white-label tenants ({tenants.length} total)
            </p>
          </div>
          <button
            onClick={loadData}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
          >
            <Activity className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="font-semibold text-green-900">Active Tenants</span>
            </div>
            <div className="text-2xl font-bold text-green-900">
              {tenants.filter(t => t.status === 'active').length}
            </div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-5 h-5 text-red-600" />
              <span className="font-semibold text-red-900">Suspended Tenants</span>
            </div>
            <div className="text-2xl font-bold text-red-900">
              {tenants.filter(t => t.status === 'suspended').length}
            </div>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-blue-900">Total Users</span>
            </div>
            <div className="text-2xl font-bold text-blue-900">
              {tenants.reduce((sum, t) => sum + (t.userCount || 0), 0).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Tenant List */}
      <div className="space-y-4">
        {tenants.map((tenant) => (
          <div
            key={tenant.tenantId}
            className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${
                  tenant.status === 'active' ? 'bg-green-50' : 'bg-red-50'
                }`}>
                  <Building2 className={`w-6 h-6 ${
                    tenant.status === 'active' ? 'text-green-600' : 'text-red-600'
                  }`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-gray-900">{tenant.tenantName}</h3>
                    <button
                      onClick={() => handleEditTenantCode(tenant)}
                      className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Edit tenant code"
                      disabled={actionLoading === tenant.tenantId}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-600">
                    {tenant.subdomain}.wellfit.com
                  </p>
                  {tenant.tenantCode && (
                    <div className="flex items-center gap-1 mt-1">
                      <Hash className="w-3 h-3 text-blue-600" />
                      <span className="text-sm font-mono font-semibold text-blue-600">
                        {tenant.tenantCode}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`
                      px-3 py-1 rounded-full text-xs font-medium
                      ${tenant.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                      }
                    `}>
                      {tenant.status === 'active' ? (
                        <span className="flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          Suspended
                        </span>
                      )}
                    </span>
                    {tenant.licenseTier && (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {tenant.licenseTier}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {onViewTenant && (
                  <button
                    onClick={() => onViewTenant(tenant.tenantId)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="View tenant data"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                )}
                {tenant.status === 'active' ? (
                  <button
                    onClick={() => handleSuspendTenant(tenant)}
                    disabled={actionLoading === tenant.tenantId}
                    className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {actionLoading === tenant.tenantId ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-700"></div>
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    Suspend
                  </button>
                ) : (
                  <button
                    onClick={() => handleActivateTenant(tenant)}
                    disabled={actionLoading === tenant.tenantId}
                    className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {actionLoading === tenant.tenantId ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-700"></div>
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    Activate
                  </button>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
              <div>
                <div className="text-xs text-gray-600 mb-1">Users</div>
                <div className="text-lg font-semibold text-gray-900">
                  {tenant.userCount?.toLocaleString() || 0}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-1">Patients</div>
                <div className="text-lg font-semibold text-gray-900">
                  {tenant.patientCount?.toLocaleString() || 0}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-1">Created</div>
                <div className="text-lg font-semibold text-gray-900">
                  {tenant.createdAt ? new Date(tenant.createdAt).toLocaleDateString() : 'N/A'}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-1">Last Active</div>
                <div className="text-lg font-semibold text-gray-900">
                  {tenant.lastActivityAt ? new Date(tenant.lastActivityAt).toLocaleDateString() : 'N/A'}
                </div>
              </div>
            </div>

            {/* Module Configuration */}
            {tenant.modules && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <Settings className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">Enabled Modules</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(tenant.modules)
                    .filter(([key, value]) => value === true && key.endsWith('_enabled'))
                    .map(([key]) => {
                      const moduleName = key.replace('_enabled', '').replace(/_/g, ' ');
                      return (
                        <span
                          key={key}
                          className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded capitalize"
                        >
                          {moduleName}
                        </span>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && selectedTenant && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              Confirm {confirmAction === 'suspend' ? 'Suspension' : 'Activation'}
            </h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to {confirmAction} <strong>{selectedTenant.tenantName}</strong>?
              {confirmAction === 'suspend' && (
                <span className="block mt-2 text-red-600 font-medium">
                  This will prevent all users from accessing this tenant!
                </span>
              )}
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => {
                  setShowConfirmDialog(false);
                  setSelectedTenant(null);
                  setConfirmAction(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmTenantAction}
                className={`px-4 py-2 rounded-lg text-white ${
                  confirmAction === 'suspend'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                Confirm {confirmAction === 'suspend' ? 'Suspension' : 'Activation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Tenant Code Dialog */}
      {showEditCodeDialog && selectedTenant && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              Edit Tenant Code
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Assign a unique identifier for <strong>{selectedTenant.tenantName}</strong>
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tenant Code
              </label>
              <input
                type="text"
                value={editTenantCode}
                onChange={(e) => setEditTenantCode(e.target.value.toUpperCase())}
                placeholder="MH-6702"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                maxLength={11}
              />
              <p className="text-xs text-gray-500 mt-1">
                Format: PREFIX-NUMBER (e.g., "MH-6702", "P3-1234")
              </p>
              <p className="text-xs text-gray-500">
                Prefix: 1-4 uppercase letters | Number: 4-6 digits
              </p>
            </div>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => {
                  setShowEditCodeDialog(false);
                  setSelectedTenant(null);
                  setEditTenantCode('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={saveTenantCode}
                disabled={!editTenantCode.trim()}
                className="px-4 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Hash className="w-4 h-4" />
                Save Code
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TenantManagementPanel;
