/**
 * StaffRoleTable — Displays staff users with roles in a filterable table
 *
 * Used by: UserRoleManagementPanel
 */

import React from 'react';
import { ROLE_DISPLAY_NAMES, DEPARTMENT_DISPLAY_NAMES, type Department } from '../../../types/roles';
import { EABadge } from '../../envision-atlus';
import { UserCog, ShieldOff, Loader2 } from 'lucide-react';
import type { StaffTableProps, StaffUserRow } from './types';

function getRoleBadgeVariant(role: string | null): 'critical' | 'high' | 'elevated' | 'normal' | 'info' | 'neutral' {
  if (!role) return 'neutral';
  if (role === 'super_admin') return 'critical';
  if (role === 'it_admin' || role === 'department_head') return 'high';
  if (role === 'clinical_supervisor' || role === 'nurse_practitioner' || role === 'physician_assistant') return 'elevated';
  if (role === 'physician' || role === 'nurse' || role === 'doctor') return 'normal';
  return 'info';
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Unknown';
  }
}

function matchesSearch(user: StaffUserRow, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    user.first_name.toLowerCase().includes(q) ||
    user.last_name.toLowerCase().includes(q) ||
    user.email.toLowerCase().includes(q) ||
    (user.role && ROLE_DISPLAY_NAMES[user.role]?.toLowerCase().includes(q)) ||
    false
  );
}

export const StaffRoleTable: React.FC<StaffTableProps> = ({
  users,
  loading,
  searchQuery,
  roleFilter,
  onAssignRole,
  onRevokeRole,
}) => {
  const filtered = users.filter(user => {
    if (!matchesSearch(user, searchQuery)) return false;
    if (roleFilter !== 'all' && user.role !== roleFilter) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">Loading staff...</span>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <UserCog className="w-10 h-10 mx-auto mb-2 text-gray-300" />
        <p className="text-sm">
          {users.length === 0
            ? 'No staff users found in this tenant'
            : 'No staff match your search or filter'}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left">
            <th className="pb-2 pr-4 font-medium text-gray-600">Name</th>
            <th className="pb-2 pr-4 font-medium text-gray-600">Email</th>
            <th className="pb-2 pr-4 font-medium text-gray-600">Current Role</th>
            <th className="pb-2 pr-4 font-medium text-gray-600">Department</th>
            <th className="pb-2 pr-4 font-medium text-gray-600">Last Active</th>
            <th className="pb-2 font-medium text-gray-600 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(user => (
            <tr key={user.user_id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-3 pr-4">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${user.is_active ? 'bg-green-400' : 'bg-gray-300'}`} />
                  <span className="font-medium text-gray-900">
                    {user.first_name} {user.last_name}
                  </span>
                </div>
              </td>
              <td className="py-3 pr-4 text-gray-600">{user.email}</td>
              <td className="py-3 pr-4">
                {user.role ? (
                  <EABadge variant={getRoleBadgeVariant(user.role)} size="sm">
                    {ROLE_DISPLAY_NAMES[user.role] || user.role}
                  </EABadge>
                ) : (
                  <span className="text-gray-400 italic text-xs">No role</span>
                )}
              </td>
              <td className="py-3 pr-4 text-gray-600">
                {user.department
                  ? DEPARTMENT_DISPLAY_NAMES[user.department as NonNullable<Department>] || user.department
                  : <span className="text-gray-400">—</span>}
              </td>
              <td className="py-3 pr-4 text-gray-500 text-xs">
                {formatDate(user.last_sign_in_at)}
              </td>
              <td className="py-3 text-right">
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => onAssignRole(user)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                    title="Assign or change role"
                  >
                    <UserCog className="w-3 h-3" />
                    Role
                  </button>
                  {user.role && (
                    <button
                      onClick={() => onRevokeRole(user)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-700 bg-red-50 rounded hover:bg-red-100 transition-colors"
                      title="Revoke role"
                    >
                      <ShieldOff className="w-3 h-3" />
                      Revoke
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-gray-400 mt-2">
        Showing {filtered.length} of {users.length} staff members
      </p>
    </div>
  );
};

export default StaffRoleTable;
