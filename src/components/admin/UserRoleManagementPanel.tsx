/**
 * UserRoleManagementPanel — Admin panel for managing staff roles within a tenant
 *
 * Purpose: Assign, change, and revoke staff roles with hierarchy enforcement and audit logging
 * Used by: IntelligentAdminPanel (admin category section)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useDashboardTheme } from '../../hooks/useDashboardTheme';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { userRoleManagementService } from '../../services/userRoleManagementService';
import { ROLE_DISPLAY_NAMES, type StaffRole } from '../../types/roles';
import { auditLogger } from '../../services/auditLogger';
import { supabase } from '../../lib/supabaseClient';
import { StaffRoleTable, RoleAssignmentModal } from './user-role-management';
import type { StaffUserRow, RoleAssignmentFormData } from './user-role-management';
import { Search, RefreshCw, Users, Filter, ShieldAlert } from 'lucide-react';

// Roles to show in filter dropdown (exclude synonyms)
const FILTER_ROLES: StaffRole[] = [
  'super_admin', 'it_admin', 'department_head', 'clinical_supervisor',
  'nurse_practitioner', 'physician_assistant', 'physician', 'nurse',
  'case_manager', 'social_worker', 'community_health_worker',
  'physical_therapist', 'quality_manager', 'lab_tech', 'pharmacist',
  'radiologist', 'billing_specialist', 'admin',
];

export const UserRoleManagementPanel: React.FC = () => {
  useDashboardTheme();
  const { adminRole, isAdminAuthenticated } = useAdminAuth();

  const [users, setUsers] = useState<StaffUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<StaffRole | 'all'>('all');

  // Modal state
  const [selectedUser, setSelectedUser] = useState<StaffUserRow | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [revokeReason, setRevokeReason] = useState('');

  const loadStaff = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await userRoleManagementService.getStaffUsers();
    if (result.success) {
      setUsers(result.data);
    } else {
      setError(result.error.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdminAuthenticated) {
      loadStaff();
    }
  }, [isAdminAuthenticated, loadStaff]);

  const handleAssignRole = (user: StaffUserRow) => {
    setSelectedUser(user);
    setShowAssignModal(true);
  };

  const handleRevokeRole = (user: StaffUserRow) => {
    setSelectedUser(user);
    setRevokeReason('');
    setShowRevokeConfirm(true);
  };

  const handleSaveRole = async (data: RoleAssignmentFormData) => {
    if (!selectedUser || !adminRole) return;
    setSaving(true);
    setError(null);

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        setError('Session expired. Please re-authenticate.');
        setSaving(false);
        return;
      }

      const result = await userRoleManagementService.assignRole(
        {
          user_id: selectedUser.user_id,
          new_role: data.new_role,
          department: data.department,
          reason: data.reason,
        },
        adminRole,
        authUser.id
      );

      if (result.success) {
        // Update local state with the returned user
        setUsers(prev => prev.map(u =>
          u.user_id === result.data.user_id ? result.data : u
        ));
        setShowAssignModal(false);
        setSelectedUser(null);
      } else {
        setError(result.error.message);
      }
    } catch (err: unknown) {
      await auditLogger.error('ROLE_ASSIGN_UI_ERROR',
        err instanceof Error ? err : new Error(String(err))
      ).catch(() => {});
      setError('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmRevoke = async () => {
    if (!selectedUser || !adminRole) return;
    if (!revokeReason.trim()) {
      setError('Please provide a reason for revoking this role');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        setError('Session expired. Please re-authenticate.');
        setSaving(false);
        return;
      }

      const result = await userRoleManagementService.revokeRole(
        selectedUser.user_id,
        revokeReason.trim(),
        adminRole,
        authUser.id
      );

      if (result.success) {
        setUsers(prev => prev.map(u =>
          u.user_id === selectedUser.user_id
            ? { ...u, role: null, role_code: null }
            : u
        ));
        setShowRevokeConfirm(false);
        setSelectedUser(null);
        setRevokeReason('');
      } else {
        setError(result.error.message);
      }
    } catch (err: unknown) {
      await auditLogger.error('ROLE_REVOKE_UI_ERROR',
        err instanceof Error ? err : new Error(String(err))
      ).catch(() => {});
      setError('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  if (!isAdminAuthenticated || !adminRole) {
    return (
      <div className="flex items-center gap-2 p-4 bg-amber-50 border border-amber-200 rounded-md">
        <ShieldAlert className="w-5 h-5 text-amber-600" />
        <p className="text-sm text-amber-800">Admin authentication required to manage roles.</p>
      </div>
    );
  }

  const assignableRoles = userRoleManagementService.getAssignableRoleOptions(adminRole);

  // Stats
  const totalStaff = users.length;
  const activeStaff = users.filter(u => u.is_active).length;
  const unassigned = users.filter(u => !u.role).length;

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5 text-gray-600">
          <Users className="w-4 h-4" />
          <span><strong>{totalStaff}</strong> staff</span>
        </div>
        <div className="text-green-600">
          <strong>{activeStaff}</strong> active
        </div>
        {unassigned > 0 && (
          <div className="text-amber-600">
            <strong>{unassigned}</strong> unassigned
          </div>
        )}
        <div className="text-gray-400 text-xs">
          You can assign: {assignableRoles.length} role{assignableRoles.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Search + filter bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, or role..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[var(--ea-primary,#00857a)] focus:border-[var(--ea-primary,#00857a)]"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as StaffRole | 'all')}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[var(--ea-primary,#00857a)] focus:border-[var(--ea-primary,#00857a)]"
          >
            <option value="all">All Roles</option>
            {FILTER_ROLES.map(role => (
              <option key={role} value={role}>{ROLE_DISPLAY_NAMES[role]}</option>
            ))}
          </select>
          <button
            onClick={loadStaff}
            disabled={loading}
            className="p-2 rounded-md border border-gray-300 hover:bg-gray-50 transition-colors"
            title="Refresh staff list"
          >
            <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-700">&times;</button>
        </div>
      )}

      {/* Table */}
      <StaffRoleTable
        users={users}
        loading={loading}
        searchQuery={searchQuery}
        roleFilter={roleFilter}
        onAssignRole={handleAssignRole}
        onRevokeRole={handleRevokeRole}
      />

      {/* Assign Modal */}
      {showAssignModal && selectedUser && (
        <RoleAssignmentModal
          user={selectedUser}
          assignableRoles={assignableRoles}
          saving={saving}
          onSave={handleSaveRole}
          onClose={() => {
            setShowAssignModal(false);
            setSelectedUser(null);
          }}
        />
      )}

      {/* Revoke Confirmation */}
      {showRevokeConfirm && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Revoke Role</h3>
            <p className="text-sm text-gray-600 mb-4">
              Remove the <strong>{(selectedUser.role && ROLE_DISPLAY_NAMES[selectedUser.role]) || selectedUser.role || 'unknown'}</strong> role
              from <strong>{selectedUser.first_name} {selectedUser.last_name}</strong>?
              This will remove all role-based access.
            </p>
            <div className="mb-4">
              <label htmlFor="revoke-reason" className="block text-sm font-medium text-gray-700 mb-1">
                Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                id="revoke-reason"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="e.g., Termination, role transfer, security concern..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                disabled={saving}
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 mb-3">{error}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowRevokeConfirm(false);
                  setSelectedUser(null);
                  setRevokeReason('');
                  setError(null);
                }}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRevoke}
                disabled={saving || !revokeReason.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? 'Revoking...' : 'Revoke Role'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserRoleManagementPanel;
