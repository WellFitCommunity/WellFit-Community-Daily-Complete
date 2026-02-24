/**
 * RoleAssignmentModal — Modal form for assigning/changing a user's role
 *
 * Used by: UserRoleManagementPanel
 */

import React, { useState } from 'react';
import { ROLE_DISPLAY_NAMES, DEPARTMENT_DISPLAY_NAMES, type Department, type StaffRole } from '../../../types/roles';
import { EABadge } from '../../envision-atlus';
import { X, Loader2, ShieldCheck } from 'lucide-react';
import type { RoleAssignmentModalProps, RoleAssignmentFormData } from './types';

const DEPARTMENTS: Array<{ value: Department; label: string }> = [
  { value: null, label: 'None (All Departments)' },
  { value: 'nursing', label: DEPARTMENT_DISPLAY_NAMES.nursing },
  { value: 'medical', label: DEPARTMENT_DISPLAY_NAMES.medical },
  { value: 'therapy', label: DEPARTMENT_DISPLAY_NAMES.therapy },
  { value: 'administration', label: DEPARTMENT_DISPLAY_NAMES.administration },
];

export const RoleAssignmentModal: React.FC<RoleAssignmentModalProps> = ({
  user,
  assignableRoles,
  saving,
  onSave,
  onClose,
}) => {
  const [selectedRole, setSelectedRole] = useState<StaffRole | ''>(user.role || '');
  const [selectedDept, setSelectedDept] = useState<Department>(user.department || null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedRole) {
      setError('Please select a role');
      return;
    }
    if (!reason.trim()) {
      setError('Please provide a reason for this role change');
      return;
    }

    const data: RoleAssignmentFormData = {
      new_role: selectedRole as StaffRole,
      department: selectedDept,
      reason: reason.trim(),
    };
    onSave(data);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Assign Role</h3>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="p-1 rounded hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* User info */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
          <p className="text-sm font-medium text-gray-900">
            {user.first_name} {user.last_name}
          </p>
          <p className="text-xs text-gray-500">{user.email}</p>
          {user.role && (
            <div className="mt-1 flex items-center gap-1">
              <span className="text-xs text-gray-500">Current:</span>
              <EABadge variant="info" size="sm">
                {ROLE_DISPLAY_NAMES[user.role] || user.role}
              </EABadge>
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* Role selection */}
          <div>
            <label htmlFor="role-select" className="block text-sm font-medium text-gray-700 mb-1">
              New Role
            </label>
            <select
              id="role-select"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as StaffRole | '')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={saving}
            >
              <option value="">Select a role...</option>
              {assignableRoles.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {assignableRoles.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                Your role does not have permission to assign any roles.
              </p>
            )}
          </div>

          {/* Department selection */}
          <div>
            <label htmlFor="dept-select" className="block text-sm font-medium text-gray-700 mb-1">
              Department
            </label>
            <select
              id="dept-select"
              value={selectedDept || ''}
              onChange={(e) => setSelectedDept((e.target.value || null) as Department)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={saving}
            >
              {DEPARTMENTS.map(opt => (
                <option key={opt.value || 'none'} value={opt.value || ''}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Reason */}
          <div>
            <label htmlFor="reason-input" className="block text-sm font-medium text-gray-700 mb-1">
              Reason for Change <span className="text-red-500">*</span>
            </label>
            <textarea
              id="reason-input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., New hire onboarding, role promotion, department transfer..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              disabled={saving}
            />
            <p className="text-xs text-gray-400 mt-1">
              This reason is recorded in the audit log per HIPAA requirements.
            </p>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || assignableRoles.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Saving...' : 'Assign Role'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RoleAssignmentModal;
