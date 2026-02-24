/**
 * Types for User Role Management UI components
 */

import type { StaffRole, Department } from '../../../types/roles';

export interface StaffUserRow {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: StaffRole | null;
  role_code: number | null;
  department: Department;
  is_active: boolean;
  created_at: string;
  last_sign_in_at: string | null;
}

export interface RoleAssignmentFormData {
  new_role: StaffRole;
  department: Department;
  reason: string;
}

export interface StaffTableProps {
  users: StaffUserRow[];
  loading: boolean;
  searchQuery: string;
  roleFilter: StaffRole | 'all';
  onAssignRole: (user: StaffUserRow) => void;
  onRevokeRole: (user: StaffUserRow) => void;
}

export interface RoleAssignmentModalProps {
  user: StaffUserRow;
  assignableRoles: Array<{ value: StaffRole; label: string }>;
  saving: boolean;
  onSave: (data: RoleAssignmentFormData) => void;
  onClose: () => void;
}
