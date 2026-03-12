/**
 * UserManagementPanel — User account management for tenant IT admins
 */

import React, { useState } from 'react';
import {
  Users, Shield, Lock, Search, CheckCircle,
  AlertTriangle, RotateCcw, Unlock
} from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import type { TenantUser } from './TenantITDashboard.types';

export const UserManagementPanel: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [users] = useState<TenantUser[]>([
    {
      id: '1',
      email: 'dr.smith@clinic.org',
      full_name: 'Dr. Sarah Smith',
      role: 'physician',
      status: 'active',
      last_login: '2025-01-25T14:30:00Z',
      created_at: '2024-06-15T09:00:00Z',
      failed_attempts: 0,
      mfa_enabled: true
    },
    {
      id: '2',
      email: 'nurse.jones@clinic.org',
      full_name: 'Michael Jones',
      role: 'nurse',
      status: 'locked',
      last_login: '2025-01-24T16:45:00Z',
      created_at: '2024-08-20T10:30:00Z',
      failed_attempts: 5,
      mfa_enabled: false
    },
    {
      id: '3',
      email: 'admin@clinic.org',
      full_name: 'Admin User',
      role: 'admin',
      status: 'active',
      last_login: '2025-01-25T09:15:00Z',
      created_at: '2024-01-01T00:00:00Z',
      failed_attempts: 0,
      mfa_enabled: true
    }
  ]);

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleResetPassword = (userId: string) => {
    alert(`Password reset email sent for user ${userId}`);
  };

  const handleUnlockAccount = (userId: string) => {
    alert(`Account unlocked for user ${userId}`);
  };

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search users by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border-2 border-black rounded-lg focus:border-[#1BA39C] focus:ring-2 focus:ring-[#1BA39C]/20 transition-all font-medium"
        />
      </div>

      {/* User Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#E8F8F7] p-4 rounded-lg border-2 border-black">
          <div className="flex items-center gap-2 text-[#1BA39C]">
            <Users className="w-5 h-5" />
            <span className="font-bold">Total Users</span>
          </div>
          <p className="text-3xl font-bold text-black mt-2">{users.length}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg border-2 border-green-200">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle className="w-5 h-5" />
            <span className="font-bold">Active</span>
          </div>
          <p className="text-3xl font-bold text-green-800 mt-2">{users.filter(u => u.status === 'active').length}</p>
        </div>
        <div className="bg-red-50 p-4 rounded-lg border-2 border-red-200">
          <div className="flex items-center gap-2 text-red-700">
            <Lock className="w-5 h-5" />
            <span className="font-bold">Locked</span>
          </div>
          <p className="text-3xl font-bold text-red-800 mt-2">{users.filter(u => u.status === 'locked').length}</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg border-2 border-purple-200">
          <div className="flex items-center gap-2 text-purple-700">
            <Shield className="w-5 h-5" />
            <span className="font-bold">MFA Enabled</span>
          </div>
          <p className="text-3xl font-bold text-purple-800 mt-2">{users.filter(u => u.mfa_enabled).length}</p>
        </div>
      </div>

      {/* User Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-[#2D3339] text-white">
              <th className="px-4 py-3 text-left font-bold">User</th>
              <th className="px-4 py-3 text-left font-bold">Role</th>
              <th className="px-4 py-3 text-left font-bold">Status</th>
              <th className="px-4 py-3 text-left font-bold">Last Login</th>
              <th className="px-4 py-3 text-left font-bold">MFA</th>
              <th className="px-4 py-3 text-left font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user, idx) => (
              <tr key={user.id} className={`border-b-2 border-black/10 ${idx % 2 === 0 ? 'bg-white' : 'bg-[#F8FFFE]'} hover:bg-[#E8F8F7] transition-all`}>
                <td className="px-4 py-3">
                  <div>
                    <p className="font-bold text-black">{user.full_name}</p>
                    <p className="text-sm text-gray-600">{user.email}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 bg-[#E8F8F7] text-[#1BA39C] font-bold rounded-sm border border-[#1BA39C]">
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={user.status} />
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {new Date(user.last_login).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  {user.mfa_enabled ? (
                    <span className="text-green-600 font-bold flex items-center gap-1">
                      <Shield className="w-4 h-4" /> On
                    </span>
                  ) : (
                    <span className="text-orange-600 font-bold flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" /> Off
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleResetPassword(user.id)}
                      className="p-2 bg-blue-100 hover:bg-blue-200 rounded-lg border border-blue-300 transition-all"
                      title="Reset Password"
                    >
                      <RotateCcw className="w-4 h-4 text-blue-700" />
                    </button>
                    {user.status === 'locked' && (
                      <button
                        onClick={() => handleUnlockAccount(user.id)}
                        className="p-2 bg-green-100 hover:bg-green-200 rounded-lg border border-green-300 transition-all"
                        title="Unlock Account"
                      >
                        <Unlock className="w-4 h-4 text-green-700" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
