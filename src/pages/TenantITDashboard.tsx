/**
 * Tenant IT Administration Dashboard
 *
 * IT Operations control panel for tenant IT administrators.
 * Provides technical operations capabilities scoped to their organization ONLY.
 *
 * KEY DISTINCTION:
 * - it_admin: Tenant IT staff (this dashboard) - manages their organization only
 * - super_admin: Envision Platform staff - manages ALL tenants
 *
 * Capabilities:
 * - User account management (password resets, account unlocks)
 * - Tenant-scoped audit log viewing
 * - API key management for integrations
 * - SSO/Session configuration
 * - System health monitoring (tenant's resources only)
 * - Compliance report exports
 *
 * SECURITY: All operations are tenant-scoped via RLS policies.
 * No access to other tenants or platform-level settings.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/AuthContext';
import RequireAdminAuth from '../components/auth/RequireAdminAuth';
import AdminHeader from '../components/admin/AdminHeader';
import SmartBackButton from '../components/ui/SmartBackButton';
import {
  Users, Shield, Key, Settings, Activity, Clock,
  FileText, AlertTriangle, CheckCircle, XCircle,
  RefreshCw, Lock, Unlock, Search, Download,
  ChevronDown, Eye, EyeOff, Copy, RotateCcw,
  Server, HardDrive, Wifi, Database, Mail, Phone
} from 'lucide-react';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type ITTabKey = 'overview' | 'users' | 'sessions' | 'api-keys' | 'audit' | 'health' | 'compliance';

interface TenantUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: 'active' | 'locked' | 'pending';
  last_login: string;
  created_at: string;
  failed_attempts: number;
  mfa_enabled: boolean;
}

interface ActiveSession {
  id: string;
  user_id: string;
  user_email: string;
  ip_address: string;
  device_info: string;
  location: string;
  started_at: string;
  last_activity: string;
}

interface APIKey {
  id: string;
  name: string;
  key_prefix: string;
  permissions: string[];
  created_at: string;
  last_used: string;
  expires_at: string | null;
  status: 'active' | 'expired' | 'revoked';
}

interface AuditLogEntry {
  id: string;
  timestamp: string;
  user_email: string;
  action: string;
  resource: string;
  ip_address: string;
  status: 'success' | 'failure';
  details: string;
}

interface SystemHealth {
  service: string;
  status: 'healthy' | 'degraded' | 'down';
  latency_ms: number;
  last_check: string;
}

// ============================================================================
// COLLAPSIBLE SECTION COMPONENT
// ============================================================================

interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string | number;
  badgeColor?: string;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  subtitle,
  icon,
  children,
  defaultOpen = false,
  badge,
  badgeColor = 'bg-[#C8E63D]'
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="bg-white rounded-xl shadow-lg border-2 border-black overflow-hidden hover:border-[#1BA39C] transition-all">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between bg-[#E8F8F7] hover:bg-[#D1F2F0] transition-all border-b-2 border-black"
      >
        <div className="flex items-center flex-1 gap-3">
          <div className="p-2 rounded-lg bg-white border-2 border-black shadow-md">
            {icon}
          </div>
          <div className="text-left">
            <h2 className="text-xl font-bold text-black flex items-center gap-2">
              {title}
              {badge !== undefined && (
                <span className={`px-2 py-1 text-xs font-bold rounded-full ${badgeColor} text-black border border-black`}>
                  {badge}
                </span>
              )}
            </h2>
            {subtitle && <p className="text-sm text-[#6B7280] mt-1">{subtitle}</p>}
          </div>
        </div>
        <ChevronDown className={`text-[#1BA39C] transform transition-transform duration-200 w-6 h-6 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="p-6 bg-white">
          {children}
        </div>
      )}
    </section>
  );
};

// ============================================================================
// STATUS BADGE COMPONENT
// ============================================================================

const StatusBadge: React.FC<{ status: string; size?: 'sm' | 'md' }> = ({ status, size = 'md' }) => {
  const getStatusStyles = () => {
    switch (status) {
      case 'active':
      case 'healthy':
      case 'success':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'locked':
      case 'down':
      case 'failure':
      case 'revoked':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'pending':
      case 'degraded':
      case 'expired':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span className={`${sizeClasses} font-bold rounded-full border ${getStatusStyles()}`}>
      {status.toUpperCase()}
    </span>
  );
};

// ============================================================================
// USER MANAGEMENT PANEL
// ============================================================================

const UserManagementPanel: React.FC = () => {
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
    // Implementation would call the API
    alert(`Password reset email sent for user ${userId}`);
  };

  const handleUnlockAccount = (userId: string) => {
    // Implementation would call the API
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
                  <span className="px-2 py-1 bg-[#E8F8F7] text-[#1BA39C] font-bold rounded border border-[#1BA39C]">
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

// ============================================================================
// ACTIVE SESSIONS PANEL
// ============================================================================

const ActiveSessionsPanel: React.FC = () => {
  const [sessions] = useState<ActiveSession[]>([
    {
      id: '1',
      user_id: '1',
      user_email: 'dr.smith@clinic.org',
      ip_address: '192.168.1.100',
      device_info: 'Chrome on Windows',
      location: 'New York, NY',
      started_at: '2025-01-25T14:30:00Z',
      last_activity: '2025-01-25T15:45:00Z'
    },
    {
      id: '2',
      user_id: '3',
      user_email: 'admin@clinic.org',
      ip_address: '192.168.1.105',
      device_info: 'Safari on macOS',
      location: 'Boston, MA',
      started_at: '2025-01-25T09:15:00Z',
      last_activity: '2025-01-25T15:40:00Z'
    }
  ]);

  const handleTerminateSession = (sessionId: string) => {
    alert(`Session ${sessionId} terminated`);
  };

  const handleTerminateAllSessions = () => {
    if (window.confirm('Are you sure you want to terminate ALL active sessions? Users will need to log in again.')) {
      alert('All sessions terminated');
    }
  };

  return (
    <div className="space-y-6">
      {/* Session Stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-[#C8E63D] p-3 rounded-lg border-2 border-black">
            <Activity className="w-6 h-6 text-black" />
          </div>
          <div>
            <p className="text-2xl font-bold text-black">{sessions.length} Active Sessions</p>
            <p className="text-sm text-gray-600">Currently logged in users</p>
          </div>
        </div>
        <button
          onClick={handleTerminateAllSessions}
          className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 font-bold rounded-lg border-2 border-red-300 transition-all flex items-center gap-2"
        >
          <XCircle className="w-5 h-5" />
          Terminate All Sessions
        </button>
      </div>

      {/* Sessions List */}
      <div className="space-y-4">
        {sessions.map(session => (
          <div key={session.id} className="bg-white p-4 rounded-lg border-2 border-black hover:border-[#1BA39C] transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#E8F8F7] rounded-full flex items-center justify-center border-2 border-[#1BA39C]">
                  <Users className="w-6 h-6 text-[#1BA39C]" />
                </div>
                <div>
                  <p className="font-bold text-black">{session.user_email}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <Wifi className="w-4 h-4" />
                      {session.ip_address}
                    </span>
                    <span className="flex items-center gap-1">
                      <HardDrive className="w-4 h-4" />
                      {session.device_info}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Last active: {new Date(session.last_activity).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleTerminateSession(session.id)}
                className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-800 font-bold rounded-lg border border-red-300 transition-all"
              >
                Terminate
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// API KEY MANAGEMENT PANEL
// ============================================================================

const APIKeyManagementPanel: React.FC = () => {
  const [showKey, setShowKey] = useState<string | null>(null);
  const [apiKeys] = useState<APIKey[]>([
    {
      id: '1',
      name: 'EHR Integration',
      key_prefix: 'wf_live_8x7k',
      permissions: ['read:patients', 'write:appointments'],
      created_at: '2024-10-15T09:00:00Z',
      last_used: '2025-01-25T14:30:00Z',
      expires_at: '2025-10-15T09:00:00Z',
      status: 'active'
    },
    {
      id: '2',
      name: 'Lab Results Webhook',
      key_prefix: 'wf_live_3m2n',
      permissions: ['write:lab_results'],
      created_at: '2024-06-01T10:30:00Z',
      last_used: '2025-01-20T11:15:00Z',
      expires_at: null,
      status: 'active'
    },
    {
      id: '3',
      name: 'Old Billing Integration',
      key_prefix: 'wf_live_9p4q',
      permissions: ['read:billing'],
      created_at: '2023-03-01T08:00:00Z',
      last_used: '2024-01-15T09:00:00Z',
      expires_at: '2024-03-01T08:00:00Z',
      status: 'expired'
    }
  ]);

  const handleCopyKey = (keyPrefix: string) => {
    navigator.clipboard.writeText(`${keyPrefix}...`);
    alert('Key prefix copied to clipboard');
  };

  const handleRevokeKey = (keyId: string) => {
    if (window.confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      alert(`API key ${keyId} revoked`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-gray-600">
          Manage API keys for third-party integrations within your organization.
        </p>
        <button className="px-4 py-2 bg-[#1BA39C] hover:bg-[#158A84] text-white font-bold rounded-lg border-2 border-black transition-all flex items-center gap-2">
          <Key className="w-5 h-5" />
          Generate New Key
        </button>
      </div>

      {/* API Keys List */}
      <div className="space-y-4">
        {apiKeys.map(key => (
          <div key={key.id} className={`p-4 rounded-lg border-2 ${key.status === 'active' ? 'border-black bg-white hover:border-[#1BA39C]' : 'border-gray-300 bg-gray-50'} transition-all`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-lg ${key.status === 'active' ? 'bg-[#C8E63D]' : 'bg-gray-300'} border-2 border-black`}>
                  <Key className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-black">{key.name}</p>
                    <StatusBadge status={key.status} size="sm" />
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">
                      {showKey === key.id ? `${key.key_prefix}••••••••••••••••` : '••••••••••••••••••••'}
                    </code>
                    <button
                      onClick={() => setShowKey(showKey === key.id ? null : key.id)}
                      className="p-1 hover:bg-gray-200 rounded transition-all"
                    >
                      {showKey === key.id ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleCopyKey(key.key_prefix)}
                      className="p-1 hover:bg-gray-200 rounded transition-all"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                    <span>Created: {new Date(key.created_at).toLocaleDateString()}</span>
                    <span>Last used: {new Date(key.last_used).toLocaleDateString()}</span>
                    {key.expires_at && (
                      <span className={key.status === 'expired' ? 'text-red-600 font-bold' : ''}>
                        Expires: {new Date(key.expires_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {key.status === 'active' && (
                <button
                  onClick={() => handleRevokeKey(key.id)}
                  className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-800 font-bold rounded-lg border border-red-300 transition-all"
                >
                  Revoke
                </button>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {key.permissions.map(perm => (
                <span key={perm} className="px-2 py-1 bg-[#E8F8F7] text-[#1BA39C] text-xs font-bold rounded border border-[#1BA39C]">
                  {perm}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// AUDIT LOG PANEL
// ============================================================================

const AuditLogPanel: React.FC = () => {
  const [filter, setFilter] = useState('all');
  const [auditLogs] = useState<AuditLogEntry[]>([
    {
      id: '1',
      timestamp: '2025-01-25T15:45:00Z',
      user_email: 'admin@clinic.org',
      action: 'USER_LOGIN',
      resource: 'auth/session',
      ip_address: '192.168.1.105',
      status: 'success',
      details: 'Successful login via SSO'
    },
    {
      id: '2',
      timestamp: '2025-01-25T15:30:00Z',
      user_email: 'nurse.jones@clinic.org',
      action: 'USER_LOGIN',
      resource: 'auth/session',
      ip_address: '192.168.1.110',
      status: 'failure',
      details: 'Failed login - Invalid password (attempt 5/5)'
    },
    {
      id: '3',
      timestamp: '2025-01-25T14:30:00Z',
      user_email: 'dr.smith@clinic.org',
      action: 'PATIENT_VIEW',
      resource: 'patients/12345',
      ip_address: '192.168.1.100',
      status: 'success',
      details: 'Viewed patient record'
    },
    {
      id: '4',
      timestamp: '2025-01-25T14:15:00Z',
      user_email: 'dr.smith@clinic.org',
      action: 'API_KEY_CREATE',
      resource: 'api-keys',
      ip_address: '192.168.1.100',
      status: 'success',
      details: 'Created new API key: EHR Integration'
    }
  ]);

  const filteredLogs = filter === 'all' ? auditLogs : auditLogs.filter(log => log.status === filter);

  const handleExportLogs = () => {
    alert('Exporting audit logs to CSV...');
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-bold transition-all border-2 ${filter === 'all' ? 'bg-[#2D3339] text-white border-black' : 'bg-white text-black border-black/20 hover:border-[#1BA39C]'}`}
          >
            All Events
          </button>
          <button
            onClick={() => setFilter('success')}
            className={`px-4 py-2 rounded-lg font-bold transition-all border-2 ${filter === 'success' ? 'bg-green-600 text-white border-green-800' : 'bg-white text-black border-black/20 hover:border-green-500'}`}
          >
            Success
          </button>
          <button
            onClick={() => setFilter('failure')}
            className={`px-4 py-2 rounded-lg font-bold transition-all border-2 ${filter === 'failure' ? 'bg-red-600 text-white border-red-800' : 'bg-white text-black border-black/20 hover:border-red-500'}`}
          >
            Failures
          </button>
        </div>
        <button
          onClick={handleExportLogs}
          className="px-4 py-2 bg-[#1BA39C] hover:bg-[#158A84] text-white font-bold rounded-lg border-2 border-black transition-all flex items-center gap-2"
        >
          <Download className="w-5 h-5" />
          Export CSV
        </button>
      </div>

      {/* Audit Log Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-[#2D3339] text-white">
              <th className="px-4 py-3 text-left font-bold">Timestamp</th>
              <th className="px-4 py-3 text-left font-bold">User</th>
              <th className="px-4 py-3 text-left font-bold">Action</th>
              <th className="px-4 py-3 text-left font-bold">Resource</th>
              <th className="px-4 py-3 text-left font-bold">IP Address</th>
              <th className="px-4 py-3 text-left font-bold">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map((log, idx) => (
              <tr key={log.id} className={`border-b-2 border-black/10 ${idx % 2 === 0 ? 'bg-white' : 'bg-[#F8FFFE]'} hover:bg-[#E8F8F7] transition-all`}>
                <td className="px-4 py-3 text-sm">
                  {new Date(log.timestamp).toLocaleString()}
                </td>
                <td className="px-4 py-3 font-medium">{log.user_email}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 bg-purple-100 text-purple-800 font-bold rounded text-sm">
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm font-mono text-gray-600">{log.resource}</td>
                <td className="px-4 py-3 text-sm font-mono">{log.ip_address}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={log.status} size="sm" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============================================================================
// SYSTEM HEALTH PANEL
// ============================================================================

const SystemHealthPanel: React.FC = () => {
  const [healthChecks] = useState<SystemHealth[]>([
    { service: 'Database (PostgreSQL)', status: 'healthy', latency_ms: 12, last_check: '2025-01-25T15:50:00Z' },
    { service: 'Authentication Service', status: 'healthy', latency_ms: 45, last_check: '2025-01-25T15:50:00Z' },
    { service: 'API Gateway', status: 'healthy', latency_ms: 8, last_check: '2025-01-25T15:50:00Z' },
    { service: 'File Storage', status: 'healthy', latency_ms: 156, last_check: '2025-01-25T15:50:00Z' },
    { service: 'Email Service', status: 'degraded', latency_ms: 2340, last_check: '2025-01-25T15:50:00Z' },
    { service: 'SMS Gateway', status: 'healthy', latency_ms: 89, last_check: '2025-01-25T15:50:00Z' }
  ]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      case 'degraded':
        return <AlertTriangle className="w-6 h-6 text-yellow-600" />;
      case 'down':
        return <XCircle className="w-6 h-6 text-red-600" />;
      default:
        return null;
    }
  };

  const getServiceIcon = (service: string) => {
    if (service.includes('Database')) return <Database className="w-5 h-5" />;
    if (service.includes('Authentication')) return <Shield className="w-5 h-5" />;
    if (service.includes('API')) return <Server className="w-5 h-5" />;
    if (service.includes('File')) return <HardDrive className="w-5 h-5" />;
    if (service.includes('Email')) return <Mail className="w-5 h-5" />;
    if (service.includes('SMS')) return <Phone className="w-5 h-5" />;
    return <Activity className="w-5 h-5" />;
  };

  return (
    <div className="space-y-6">
      {/* Overall Status */}
      <div className="bg-gradient-to-r from-green-500 to-[#1BA39C] p-6 rounded-xl border-2 border-black text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold">System Status: Operational</h3>
            <p className="text-white/80 mt-1">All critical services are running normally</p>
          </div>
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            <span className="text-sm">Last checked: Just now</span>
          </div>
        </div>
      </div>

      {/* Service Health Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {healthChecks.map(check => (
          <div
            key={check.service}
            className={`p-4 rounded-lg border-2 ${
              check.status === 'healthy' ? 'border-green-300 bg-green-50' :
              check.status === 'degraded' ? 'border-yellow-300 bg-yellow-50' :
              'border-red-300 bg-red-50'
            } transition-all hover:shadow-lg`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  check.status === 'healthy' ? 'bg-green-200' :
                  check.status === 'degraded' ? 'bg-yellow-200' :
                  'bg-red-200'
                }`}>
                  {getServiceIcon(check.service)}
                </div>
                <div>
                  <p className="font-bold text-black">{check.service}</p>
                  <p className="text-sm text-gray-600">Latency: {check.latency_ms}ms</p>
                </div>
              </div>
              {getStatusIcon(check.status)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// COMPLIANCE REPORTS PANEL
// ============================================================================

const ComplianceReportsPanel: React.FC = () => {
  const handleGenerateReport = (reportType: string) => {
    alert(`Generating ${reportType} report...`);
  };

  return (
    <div className="space-y-6">
      {/* Compliance Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-50 p-6 rounded-xl border-2 border-green-300">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-200 rounded-lg">
              <Shield className="w-8 h-8 text-green-800" />
            </div>
            <div>
              <h3 className="font-bold text-green-800">HIPAA Compliance</h3>
              <p className="text-2xl font-bold text-green-900">98%</p>
            </div>
          </div>
        </div>
        <div className="bg-blue-50 p-6 rounded-xl border-2 border-blue-300">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-200 rounded-lg">
              <FileText className="w-8 h-8 text-blue-800" />
            </div>
            <div>
              <h3 className="font-bold text-blue-800">SOC2 Type II</h3>
              <p className="text-2xl font-bold text-blue-900">Active</p>
            </div>
          </div>
        </div>
        <div className="bg-purple-50 p-6 rounded-xl border-2 border-purple-300">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-200 rounded-lg">
              <Lock className="w-8 h-8 text-purple-800" />
            </div>
            <div>
              <h3 className="font-bold text-purple-800">Data Encryption</h3>
              <p className="text-2xl font-bold text-purple-900">AES-256</p>
            </div>
          </div>
        </div>
      </div>

      {/* Available Reports */}
      <div className="bg-white rounded-xl border-2 border-black overflow-hidden">
        <div className="bg-[#2D3339] p-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-[#C8E63D]" />
            Available Compliance Reports
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between p-4 bg-[#E8F8F7] rounded-lg border border-black hover:bg-[#D1F2F0] transition-all">
            <div>
              <p className="font-bold text-black">Access Audit Report</p>
              <p className="text-sm text-gray-600">Complete log of all user access to patient data</p>
            </div>
            <button
              onClick={() => handleGenerateReport('Access Audit')}
              className="px-4 py-2 bg-[#1BA39C] hover:bg-[#158A84] text-white font-bold rounded-lg border border-black transition-all flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Generate
            </button>
          </div>
          <div className="flex items-center justify-between p-4 bg-[#E8F8F7] rounded-lg border border-black hover:bg-[#D1F2F0] transition-all">
            <div>
              <p className="font-bold text-black">User Activity Summary</p>
              <p className="text-sm text-gray-600">Monthly summary of user logins and actions</p>
            </div>
            <button
              onClick={() => handleGenerateReport('User Activity')}
              className="px-4 py-2 bg-[#1BA39C] hover:bg-[#158A84] text-white font-bold rounded-lg border border-black transition-all flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Generate
            </button>
          </div>
          <div className="flex items-center justify-between p-4 bg-[#E8F8F7] rounded-lg border border-black hover:bg-[#D1F2F0] transition-all">
            <div>
              <p className="font-bold text-black">Security Incident Report</p>
              <p className="text-sm text-gray-600">Failed logins, suspicious activities, and security alerts</p>
            </div>
            <button
              onClick={() => handleGenerateReport('Security Incident')}
              className="px-4 py-2 bg-[#1BA39C] hover:bg-[#158A84] text-white font-bold rounded-lg border border-black transition-all flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Generate
            </button>
          </div>
          <div className="flex items-center justify-between p-4 bg-[#E8F8F7] rounded-lg border border-black hover:bg-[#D1F2F0] transition-all">
            <div>
              <p className="font-bold text-black">API Usage Report</p>
              <p className="text-sm text-gray-600">API key usage, rate limits, and integration health</p>
            </div>
            <button
              onClick={() => handleGenerateReport('API Usage')}
              className="px-4 py-2 bg-[#1BA39C] hover:bg-[#158A84] text-white font-bold rounded-lg border border-black transition-all flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Generate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// OVERVIEW DASHBOARD
// ============================================================================

const OverviewDashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-[#1BA39C] to-[#158A84] p-6 rounded-xl border-2 border-black text-white">
          <Users className="w-8 h-8 mb-2 text-[#C8E63D]" />
          <p className="text-3xl font-bold">127</p>
          <p className="text-white/80">Total Users</p>
        </div>
        <div className="bg-gradient-to-br from-[#C8E63D] to-[#a8c633] p-6 rounded-xl border-2 border-black text-black">
          <Activity className="w-8 h-8 mb-2" />
          <p className="text-3xl font-bold">23</p>
          <p className="text-black/70">Active Sessions</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-xl border-2 border-black text-white">
          <Key className="w-8 h-8 mb-2 text-purple-200" />
          <p className="text-3xl font-bold">5</p>
          <p className="text-white/80">Active API Keys</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-xl border-2 border-black text-white">
          <Shield className="w-8 h-8 mb-2 text-blue-200" />
          <p className="text-3xl font-bold">98%</p>
          <p className="text-white/80">Security Score</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl p-6 border-2 border-black shadow-lg">
        <h3 className="text-xl font-bold text-black mb-4 flex items-center gap-2">
          <Settings className="w-6 h-6 text-[#1BA39C]" />
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button className="p-4 bg-[#E8F8F7] hover:bg-[#D1F2F0] rounded-lg border-2 border-black transition-all text-left">
            <Users className="w-6 h-6 text-[#1BA39C] mb-2" />
            <p className="font-bold text-black">Add New User</p>
            <p className="text-sm text-gray-600">Create user account</p>
          </button>
          <button className="p-4 bg-[#E8F8F7] hover:bg-[#D1F2F0] rounded-lg border-2 border-black transition-all text-left">
            <RotateCcw className="w-6 h-6 text-[#1BA39C] mb-2" />
            <p className="font-bold text-black">Reset Password</p>
            <p className="text-sm text-gray-600">Help user recover access</p>
          </button>
          <button className="p-4 bg-[#E8F8F7] hover:bg-[#D1F2F0] rounded-lg border-2 border-black transition-all text-left">
            <Key className="w-6 h-6 text-[#1BA39C] mb-2" />
            <p className="font-bold text-black">Generate API Key</p>
            <p className="text-sm text-gray-600">For integrations</p>
          </button>
          <button className="p-4 bg-[#E8F8F7] hover:bg-[#D1F2F0] rounded-lg border-2 border-black transition-all text-left">
            <FileText className="w-6 h-6 text-[#1BA39C] mb-2" />
            <p className="font-bold text-black">Export Audit Log</p>
            <p className="text-sm text-gray-600">Download CSV report</p>
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl p-6 border-2 border-black shadow-lg">
        <h3 className="text-xl font-bold text-black mb-4 flex items-center gap-2">
          <Clock className="w-6 h-6 text-[#C8E63D]" />
          Recent Security Events
        </h3>
        <div className="space-y-3">
          <div className="flex items-center gap-4 p-3 bg-red-50 rounded-lg border border-red-200">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <div className="flex-1">
              <p className="font-semibold text-red-800">Account Locked: nurse.jones@clinic.org</p>
              <p className="text-sm text-red-600">5 failed login attempts - 30 minutes ago</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-3 bg-green-50 rounded-lg border border-green-200">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <div className="flex-1">
              <p className="font-semibold text-green-800">New API Key Created: EHR Integration</p>
              <p className="text-sm text-green-600">By dr.smith@clinic.org - 2 hours ago</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <Shield className="w-5 h-5 text-blue-600" />
            <div className="flex-1">
              <p className="font-semibold text-blue-800">MFA Enabled: admin@clinic.org</p>
              <p className="text-sm text-blue-600">Enhanced security - 1 day ago</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const TenantITDashboard: React.FC = () => {
  const user = useUser();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ITTabKey>('overview');

  const tabs = [
    { key: 'overview' as ITTabKey, label: 'Overview', icon: <Activity className="w-5 h-5" /> },
    { key: 'users' as ITTabKey, label: 'User Management', icon: <Users className="w-5 h-5" /> },
    { key: 'sessions' as ITTabKey, label: 'Active Sessions', icon: <Wifi className="w-5 h-5" /> },
    { key: 'api-keys' as ITTabKey, label: 'API Keys', icon: <Key className="w-5 h-5" /> },
    { key: 'audit' as ITTabKey, label: 'Audit Logs', icon: <FileText className="w-5 h-5" /> },
    { key: 'health' as ITTabKey, label: 'System Health', icon: <Server className="w-5 h-5" /> },
    { key: 'compliance' as ITTabKey, label: 'Compliance', icon: <Shield className="w-5 h-5" /> }
  ];

  return (
    <RequireAdminAuth allowedRoles={['it_admin', 'super_admin']}>
      <div className="min-h-screen bg-[#E8F8F7]">
        <AdminHeader title="IT Administration" showRiskAssessment={false} />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Back Button */}
          <div className="mb-4">
            <SmartBackButton />
          </div>

          {/* Page Header */}
          <div className="bg-gradient-to-r from-[#1BA39C] to-[#158A84] rounded-2xl shadow-2xl p-8 border-2 border-black">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                  <HardDrive className="w-8 h-8 text-[#C8E63D]" />
                  IT Administration Dashboard
                </h1>
                <p className="text-white/80 mt-2 font-medium">
                  Manage users, sessions, API keys, and system health for your organization
                </p>
                <div className="mt-3 flex items-center gap-2 text-sm">
                  <span className="px-3 py-1 bg-[#C8E63D] text-black font-bold rounded-full border border-black">
                    IT Administrator
                  </span>
                  <span className="text-white/60">Logged in as: {user?.email}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right text-white/80 text-sm">
                  <p className="font-bold">Tenant-Scoped Access</p>
                  <p className="text-xs">Your Organization Only</p>
                </div>
                <Shield className="w-12 h-12 text-[#C8E63D]" />
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="bg-white rounded-xl shadow-lg border-2 border-black overflow-hidden">
            <div className="flex items-center gap-2 p-4 bg-[#E8F8F7] border-b-2 border-black overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-6 py-3 rounded-lg font-bold transition-all flex items-center gap-2 whitespace-nowrap border-2 ${
                    activeTab === tab.key
                      ? 'bg-[#1BA39C] text-white border-black shadow-lg'
                      : 'bg-white text-black border-black/20 hover:border-[#1BA39C]'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <OverviewDashboard />
          )}

          {activeTab === 'users' && (
            <CollapsibleSection
              title="User Management"
              subtitle="View, search, and manage user accounts in your organization"
              icon={<Users className="w-6 h-6 text-[#1BA39C]" />}
              defaultOpen={true}
            >
              <UserManagementPanel />
            </CollapsibleSection>
          )}

          {activeTab === 'sessions' && (
            <CollapsibleSection
              title="Active Sessions"
              subtitle="Monitor and manage currently active user sessions"
              icon={<Wifi className="w-6 h-6 text-[#C8E63D]" />}
              defaultOpen={true}
            >
              <ActiveSessionsPanel />
            </CollapsibleSection>
          )}

          {activeTab === 'api-keys' && (
            <CollapsibleSection
              title="API Key Management"
              subtitle="Create and manage API keys for third-party integrations"
              icon={<Key className="w-6 h-6 text-purple-600" />}
              defaultOpen={true}
            >
              <APIKeyManagementPanel />
            </CollapsibleSection>
          )}

          {activeTab === 'audit' && (
            <CollapsibleSection
              title="Audit Logs"
              subtitle="View all security and access events within your organization"
              icon={<FileText className="w-6 h-6 text-blue-600" />}
              defaultOpen={true}
            >
              <AuditLogPanel />
            </CollapsibleSection>
          )}

          {activeTab === 'health' && (
            <CollapsibleSection
              title="System Health"
              subtitle="Monitor the health of services your organization depends on"
              icon={<Server className="w-6 h-6 text-green-600" />}
              defaultOpen={true}
            >
              <SystemHealthPanel />
            </CollapsibleSection>
          )}

          {activeTab === 'compliance' && (
            <CollapsibleSection
              title="Compliance Reports"
              subtitle="Generate and download compliance reports for auditors"
              icon={<Shield className="w-6 h-6 text-[#1BA39C]" />}
              defaultOpen={true}
            >
              <ComplianceReportsPanel />
            </CollapsibleSection>
          )}
        </div>
      </div>
    </RequireAdminAuth>
  );
};

export default TenantITDashboard;
