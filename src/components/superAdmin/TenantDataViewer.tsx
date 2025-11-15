import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { TenantWithStatus } from '../../types/superAdmin';
import { Users, Activity, FileText, AlertCircle, Eye, X } from 'lucide-react';
import { auditLogger } from '../../services/auditLogger';

interface TenantDataViewerProps {
  tenant: TenantWithStatus;
  onClose: () => void;
}

interface TenantUser {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  lastSeenAt?: string;
}

const TenantDataViewer: React.FC<TenantDataViewerProps> = ({ tenant, onClose }) => {
  const [activeSection, setActiveSection] = useState<'users' | 'patients' | 'activity'>('users');
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTenantData();
  }, [tenant.tenantId, activeSection]);

  const loadTenantData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (activeSection === 'users') {
        // Load users for this tenant (super admin can bypass RLS)
        const { data, error: usersError } = await supabase
          .from('profiles')
          .select('id, email, role, created_at, last_seen_at')
          .eq('tenant_id', tenant.tenantId)
          .order('created_at', { ascending: false });

        if (usersError) throw usersError;

        setUsers(
          (data || []).map((u: any) => ({
            id: u.id,
            email: u.email || 'No email',
            role: u.role || 'user',
            createdAt: u.created_at,
            lastSeenAt: u.last_seen_at
          }))
        );
      }
      // Add more sections as needed (patients, activity, etc.)
    } catch (err) {
      await auditLogger.error('SUPER_ADMIN_TENANT_DATA_LOAD_FAILED', err as Error, {
        category: 'ADMINISTRATIVE',
        tenantId: tenant.tenantId,
        section: activeSection
      });
      setError('Failed to load tenant data');
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
      case 'super_admin':
        return 'bg-red-100 text-red-800';
      case 'caregiver':
        return 'bg-blue-100 text-blue-800';
      case 'senior':
      case 'patient':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col border-2 border-teal-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 text-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Eye className="w-6 h-6" />
                <h2 className="text-2xl font-bold">Tenant Data Viewer</h2>
              </div>
              <p className="text-blue-100 text-sm">
                {tenant.tenantName} ({tenant.subdomain}.wellfit.com)
              </p>
              <div className="flex items-center gap-2 mt-3">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  tenant.status === 'active'
                    ? 'bg-green-500 text-white'
                    : 'bg-red-500 text-white'
                }`}>
                  {tenant.status}
                </span>
                <span className="px-3 py-1 bg-blue-500 text-white rounded-full text-xs font-medium">
                  {tenant.licenseTier || 'N/A'}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-teal-800 p-2 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="border-b border-gray-200 bg-gray-50 px-6">
          <nav className="flex space-x-6" aria-label="Sections">
            {[
              { id: 'users', label: 'Users', icon: Users },
              { id: 'patients', label: 'Patients', icon: Activity },
              { id: 'activity', label: 'Activity', icon: FileText }
            ].map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id as typeof activeSection)}
                  className={`
                    flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                    ${isActive
                      ? 'border-teal-600 text-teal-700'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  {section.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading data...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
                <p className="text-red-600 font-medium mb-2">Error Loading Data</p>
                <p className="text-gray-600 text-sm">{error}</p>
                <button
                  onClick={loadTenantData}
                  className="mt-4 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors shadow-sm"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : (
            <>
              {activeSection === 'users' && (
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Users ({users.length})
                    </h3>
                    <div className="text-sm text-gray-600">
                      Read-only view
                    </div>
                  </div>

                  {users.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      No users found for this tenant
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {users.map((user) => (
                        <div
                          key={user.id}
                          className="bg-gray-50 p-4 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="font-medium text-gray-900">{user.email}</span>
                                <span className={`px-2 py-1 rounded text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                                  {user.role}
                                </span>
                              </div>
                              <div className="text-sm text-gray-600">
                                User ID: <code className="bg-white px-2 py-1 rounded text-xs">{user.id}</code>
                              </div>
                            </div>
                            <div className="text-right text-sm text-gray-600">
                              <div>Joined: {new Date(user.createdAt).toLocaleDateString()}</div>
                              {user.lastSeenAt && (
                                <div className="text-xs mt-1">
                                  Last seen: {new Date(user.lastSeenAt).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeSection === 'patients' && (
                <div className="text-center py-12 text-gray-500">
                  <Activity className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>Patient data viewer coming soon</p>
                </div>
              )}

              {activeSection === 'activity' && (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>Activity logs viewer coming soon</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              <AlertCircle className="w-4 h-4 inline mr-2" />
              This is a read-only view for super admin oversight
            </div>
            <button
              onClick={onClose}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TenantDataViewer;
