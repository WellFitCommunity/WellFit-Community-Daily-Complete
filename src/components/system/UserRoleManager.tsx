/**
 * User Role Manager Component
 *
 * Visual interface for managing user roles and permissions.
 * Allows super admins to grant/revoke staff roles (admin, nurse, physician, etc.)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSupabaseClient } from '../../contexts/AuthContext';
import { Alert, AlertDescription } from '../ui/alert';
import { UserPlus, UserMinus, Shield, Search, Filter } from 'lucide-react';

interface UserWithRole {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  full_name?: string; // Computed from first_name + last_name
  role?: string;
  user_roles?: Array<{ role: string }>;
  created_at: string;
}

const STAFF_ROLES = [
  { value: 'super_admin', label: 'Master Admin', color: 'bg-red-600', description: 'Full system access' },
  { value: 'admin', label: 'Admin', color: 'bg-purple-600', description: 'Administrative access' },
  { value: 'doctor', label: 'Physician', color: 'bg-blue-600', description: 'Physician privileges' },
  { value: 'physician', label: 'Physician (Alt)', color: 'bg-blue-500', description: 'Alternative physician role' },
  { value: 'nurse', label: 'Nurse', color: 'bg-green-600', description: 'Nursing staff access' },
  { value: 'contractor_nurse', label: 'Contract Nurse', color: 'bg-teal-600', description: 'Contract nursing staff' }
];

const UserRoleManager: React.FC = () => {
  const supabase = useSupabaseClient();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);

      // Load all users with their roles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, role, created_at')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Load user_roles separately
      const { data: userRolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError && rolesError.code !== 'PGRST116') {

      }

      // Merge the data
      const usersWithRoles = (profilesData || []).map(profile => ({
        ...profile,
        full_name: ((profile.first_name || '') + ' ' + (profile.last_name || '')).trim() || undefined,
        user_roles: (userRolesData || [])
          .filter(ur => ur.user_id === profile.id)
          .map(ur => ({ role: ur.role }))
      }));

      setUsers(usersWithRoles);
      setFilteredUsers(usersWithRoles);
    } catch (error) {

      setMessage({ type: 'error', text: 'Failed to load users' });
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const filterUsers = useCallback(() => {
    let filtered = [...users];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        u =>
          u.email?.toLowerCase().includes(query) ||
          u.full_name?.toLowerCase().includes(query)
      );
    }

    // Role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(u => {
        const profileRole = u.role;
        const userRoles = u.user_roles?.map(ur => ur.role) || [];
        return profileRole === roleFilter || userRoles.includes(roleFilter);
      });
    }

    setFilteredUsers(filtered);
  }, [searchQuery, roleFilter, users]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    filterUsers();
  }, [filterUsers]);

  const grantRole = async () => {
    if (!selectedUser || !selectedRole) return;

    try {
      setActionLoading(true);
      setMessage(null);

      const response = await fetch('/api/admin/grant-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          target_user_id: selectedUser.id,
          role: selectedRole
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to grant role');
      }

      setMessage({ type: 'success', text: `Successfully granted ${selectedRole} role to ${selectedUser.email}` });
      setSelectedUser(null);
      setSelectedRole('');
      await loadUsers();
    } catch (error: any) {

      setMessage({ type: 'error', text: error.message || 'Failed to grant role' });
    } finally {
      setActionLoading(false);
    }
  };

  const revokeRole = async (userId: string, userEmail: string, role: string) => {
    if (!window.confirm(`Are you sure you want to revoke ${role} role from ${userEmail}?`)) {
      return;
    }

    try {
      setActionLoading(true);
      setMessage(null);

      const response = await fetch('/api/admin/revoke-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          target_user_id: userId,
          role: role
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to revoke role');
      }

      setMessage({ type: 'success', text: `Successfully revoked ${role} role from ${userEmail}` });
      await loadUsers();
    } catch (error: any) {

      setMessage({ type: 'error', text: error.message || 'Failed to revoke role' });
    } finally {
      setActionLoading(false);
    }
  };

  const getUserRoles = (user: UserWithRole): string[] => {
    const roles: string[] = [];
    if (user.role) roles.push(user.role);
    if (user.user_roles) {
      user.user_roles.forEach(ur => {
        if (!roles.includes(ur.role)) {
          roles.push(ur.role);
        }
      });
    }
    return roles;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1BA39C] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Messages */}
      {message && (
        <Alert className={message.type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
          <AlertDescription className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
            {message.text}
          </AlertDescription>
        </Alert>
      )}

      {/* Grant Role Section */}
      <div className="bg-[#E8F8F7] rounded-lg p-6 border-2 border-black">
        <h3 className="text-lg font-bold text-black mb-4 flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-[#1BA39C]" />
          Grant Role to User
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Select User</label>
            <select
              value={selectedUser?.id || ''}
              onChange={(e) => {
                const user = users.find(u => u.id === e.target.value);
                setSelectedUser(user || null);
              }}
              className="w-full px-4 py-2 border-2 border-black rounded-lg focus:ring-2 focus:ring-[#1BA39C] focus:border-[#1BA39C]"
            >
              <option value="">Choose a user...</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.email} {user.full_name ? `(${user.full_name})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Select Role</label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full px-4 py-2 border-2 border-black rounded-lg focus:ring-2 focus:ring-[#1BA39C] focus:border-[#1BA39C]"
            >
              <option value="">Choose a role...</option>
              {STAFF_ROLES.map(role => (
                <option key={role.value} value={role.value}>
                  {role.label} - {role.description}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={grantRole}
              disabled={!selectedUser || !selectedRole || actionLoading}
              className="w-full px-6 py-2 bg-[#1BA39C] hover:bg-[#158A84] text-white font-bold rounded-lg transition-all shadow-md hover:shadow-lg border-2 border-black disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading ? 'Granting...' : 'Grant Role'}
            </button>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by email or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border-2 border-black rounded-lg focus:ring-2 focus:ring-[#1BA39C] focus:border-[#1BA39C]"
            />
          </div>
        </div>
        <div className="w-full md:w-64">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border-2 border-black rounded-lg focus:ring-2 focus:ring-[#1BA39C] focus:border-[#1BA39C]"
            >
              <option value="all">All Roles</option>
              {STAFF_ROLES.map(role => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg border-2 border-black shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-[#E8F8F7]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Roles
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No users found matching your criteria
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const userRoles = getUserRoles(user);
                  return (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-gray-900">{user.full_name || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-700">{user.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {userRoles.length === 0 ? (
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-200 text-gray-700">
                              No staff roles
                            </span>
                          ) : (
                            userRoles.map(role => {
                              const roleInfo = STAFF_ROLES.find(r => r.value === role);
                              return (
                                <span
                                  key={role}
                                  className={`px-2 py-1 text-xs font-semibold rounded-full text-white ${
                                    roleInfo?.color || 'bg-gray-600'
                                  }`}
                                >
                                  {roleInfo?.label || role}
                                </span>
                              );
                            })
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {userRoles.length > 0 && (
                          <div className="flex flex-col gap-1">
                            {userRoles.map(role => (
                              <button
                                key={role}
                                onClick={() => revokeRole(user.id, user.email, role)}
                                disabled={actionLoading}
                                className="inline-flex items-center gap-1 px-3 py-1 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded border border-red-300 transition-all disabled:opacity-50"
                              >
                                <UserMinus className="w-3 h-3" />
                                Revoke {STAFF_ROLES.find(r => r.value === role)?.label || role}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 border-2 border-black shadow-md">
          <div className="text-2xl font-bold text-[#1BA39C]">{users.length}</div>
          <div className="text-xs text-gray-600 font-semibold">Total Users</div>
        </div>
        <div className="bg-white rounded-lg p-4 border-2 border-black shadow-md">
          <div className="text-2xl font-bold text-purple-600">
            {users.filter(u => getUserRoles(u).includes('admin') || getUserRoles(u).includes('super_admin')).length}
          </div>
          <div className="text-xs text-gray-600 font-semibold">Admins</div>
        </div>
        <div className="bg-white rounded-lg p-4 border-2 border-black shadow-md">
          <div className="text-2xl font-bold text-blue-600">
            {users.filter(u => getUserRoles(u).includes('doctor') || getUserRoles(u).includes('physician')).length}
          </div>
          <div className="text-xs text-gray-600 font-semibold">Physicians</div>
        </div>
        <div className="bg-white rounded-lg p-4 border-2 border-black shadow-md">
          <div className="text-2xl font-bold text-green-600">
            {users.filter(u => getUserRoles(u).includes('nurse') || getUserRoles(u).includes('contractor_nurse')).length}
          </div>
          <div className="text-xs text-gray-600 font-semibold">Nurses</div>
        </div>
      </div>
    </div>
  );
};

export default UserRoleManager;
