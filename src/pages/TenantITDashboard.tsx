/**
 * Tenant IT Administration Dashboard
 *
 * IT Operations control panel for tenant IT administrators.
 * Decomposed into focused sub-modules in ./tenant-it-dashboard/
 *
 * SECURITY: All operations are tenant-scoped via RLS policies.
 */

import React, { useState } from 'react';
import { useUser } from '../contexts/AuthContext';
import RequireAdminAuth from '../components/auth/RequireAdminAuth';
import AdminHeader from '../components/admin/AdminHeader';
import SmartBackButton from '../components/ui/SmartBackButton';
import {
  Users, Shield, Key, Activity,
  FileText, Server, Wifi, HardDrive
} from 'lucide-react';

import type { ITTabKey } from './tenant-it-dashboard/TenantITDashboard.types';
import { CollapsibleSection } from './tenant-it-dashboard/CollapsibleSection';
import { UserManagementPanel } from './tenant-it-dashboard/UserManagementPanel';
import { ActiveSessionsPanel } from './tenant-it-dashboard/ActiveSessionsPanel';
import { APIKeyManagementPanel } from './tenant-it-dashboard/APIKeyManagementPanel';
import { AuditLogPanel } from './tenant-it-dashboard/AuditLogPanel';
import { SystemHealthPanel } from './tenant-it-dashboard/SystemHealthPanel';
import { ComplianceReportsPanel } from './tenant-it-dashboard/ComplianceReportsPanel';
import { OverviewDashboard } from './tenant-it-dashboard/OverviewDashboard';

const TenantITDashboard: React.FC = () => {
  const user = useUser();
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
          <div className="bg-linear-to-r from-[#1BA39C] to-[#158A84] rounded-2xl shadow-2xl p-8 border-2 border-black">
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
          {activeTab === 'overview' && <OverviewDashboard />}

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
