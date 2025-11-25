/**
 * System Administration Page
 *
 * Dedicated IT/infrastructure control panel for technical operations.
 * Separate from healthcare admin operations for role-appropriate access.
 *
 * Features:
 * - System health & infrastructure monitoring
 * - User role & permission management
 * - Active session management with revocation
 * - Database administration
 * - Security operations
 * - Audit log investigation
 * - AI usage monitoring
 * - Performance & cache monitoring
 * - Compliance dashboards
 */

import React, { useState, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/AuthContext';
import RequireAdminAuth from '../components/auth/RequireAdminAuth';
import AdminHeader from '../components/admin/AdminHeader';
import SmartBackButton from '../components/ui/SmartBackButton';
import { SystemAdminDashboard } from '../components/admin/SystemAdminDashboard';
import UserRoleManager from '../components/system/UserRoleManager';
import ActiveSessionManager from '../components/system/ActiveSessionManager';
import DatabaseAdminPanel from '../components/system/DatabaseAdminPanel';
import SystemConfigurationPanel from '../components/system/SystemConfigurationPanel';
import {
  Database, Users, Shield, Settings, Activity,
  Server, HardDrive, Zap, ChevronDown, Brain,
  BarChart3, ShieldCheck, Gauge
} from 'lucide-react';

// Lazy load monitoring dashboards to reduce initial bundle size
const TenantAIUsageDashboard = React.lazy(() => import('../components/admin/TenantAIUsageDashboard'));
const PerformanceMonitoringDashboard = React.lazy(() => import('../components/admin/PerformanceMonitoringDashboard'));
const CacheMonitoringDashboard = React.lazy(() => import('../components/admin/CacheMonitoringDashboard'));
const ComplianceDashboard = React.lazy(() => import('../components/admin/ComplianceDashboard'));
const SOC2SecurityDashboard = React.lazy(() =>
  import('../components/admin/SOC2SecurityDashboard').then(m => ({ default: m.SOC2SecurityDashboard }))
);
const ClaudeBillingMonitoringDashboard = React.lazy(() => import('../components/admin/ClaudeBillingMonitoringDashboard'));

type SystemTabKey = 'overview' | 'users' | 'sessions' | 'database' | 'config' | 'security' | 'ai-usage' | 'performance' | 'compliance';

interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string | number;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  subtitle,
  icon,
  children,
  defaultOpen = false,
  badge
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
                <span className="px-2 py-1 text-xs font-bold rounded-full bg-[#C8E63D] text-black border border-black">
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

const SystemAdministrationPage: React.FC = () => {
  const user = useUser();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SystemTabKey>('overview');

  const tabs = [
    { key: 'overview' as SystemTabKey, label: 'System Overview', icon: <Activity className="w-5 h-5" /> },
    { key: 'users' as SystemTabKey, label: 'User & Roles', icon: <Users className="w-5 h-5" /> },
    { key: 'sessions' as SystemTabKey, label: 'Active Sessions', icon: <Zap className="w-5 h-5" /> },
    { key: 'database' as SystemTabKey, label: 'Database', icon: <Database className="w-5 h-5" /> },
    { key: 'config' as SystemTabKey, label: 'Configuration', icon: <Settings className="w-5 h-5" /> },
    { key: 'security' as SystemTabKey, label: 'Security', icon: <Shield className="w-5 h-5" /> },
    { key: 'ai-usage' as SystemTabKey, label: 'AI Usage', icon: <Brain className="w-5 h-5" /> },
    { key: 'performance' as SystemTabKey, label: 'Performance', icon: <Gauge className="w-5 h-5" /> },
    { key: 'compliance' as SystemTabKey, label: 'Compliance', icon: <ShieldCheck className="w-5 h-5" /> }
  ];

  return (
    <RequireAdminAuth allowedRoles={['super_admin']}>
      <div className="min-h-screen bg-[#E8F8F7]">
        <AdminHeader title="Envision Atlus - System Administration" showRiskAssessment={false} />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Back Button */}
          <div className="mb-4">
            <SmartBackButton />
          </div>

          {/* Page Header */}
          <div className="bg-gradient-to-r from-[#2D3339] to-[#1F2326] rounded-2xl shadow-2xl p-8 border-2 border-black">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                  <Server className="w-8 h-8 text-[#C8E63D]" />
                  System Administration Control Center
                </h1>
                <p className="text-white/80 mt-2 font-medium">
                  Infrastructure management, database operations, and technical configuration
                </p>
                <div className="mt-3 flex items-center gap-2 text-sm">
                  <span className="px-3 py-1 bg-[#C8E63D] text-black font-bold rounded-full border border-black">
                    Master Admin Access
                  </span>
                  <span className="text-white/60">Logged in as: {user?.email}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right text-white/80 text-sm">
                  <p className="font-bold">IT Operations Dashboard</p>
                  <p className="text-xs">Technical Staff Only</p>
                </div>
                <HardDrive className="w-12 h-12 text-[#1BA39C]" />
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
                      ? 'bg-[#2D3339] text-white border-black shadow-lg'
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
            <div className="space-y-6">
              <CollapsibleSection
                title="Infrastructure Monitoring"
                subtitle="Real-time system health, performance metrics, and resource utilization"
                icon={<Activity className="w-6 h-6 text-[#1BA39C]" />}
                defaultOpen={true}
              >
                <SystemAdminDashboard />
              </CollapsibleSection>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl p-6 border-2 border-black shadow-lg hover:border-[#1BA39C] transition-all">
                  <h3 className="text-lg font-bold text-black mb-4 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-[#C8E63D]" />
                    Quick Actions
                  </h3>
                  <div className="space-y-2">
                    <button
                      onClick={() => setActiveTab('users')}
                      className="w-full text-left px-4 py-3 bg-[#E8F8F7] hover:bg-[#D1F2F0] rounded-lg border border-black transition-all font-semibold"
                    >
                      👥 Manage User Roles & Permissions
                    </button>
                    <button
                      onClick={() => setActiveTab('sessions')}
                      className="w-full text-left px-4 py-3 bg-[#E8F8F7] hover:bg-[#D1F2F0] rounded-lg border border-black transition-all font-semibold"
                    >
                      🔌 View Active Sessions
                    </button>
                    <button
                      onClick={() => setActiveTab('database')}
                      className="w-full text-left px-4 py-3 bg-[#E8F8F7] hover:bg-[#D1F2F0] rounded-lg border border-black transition-all font-semibold"
                    >
                      💾 Database Administration
                    </button>
                    <button
                      onClick={() => navigate('/admin/audit-logs')}
                      className="w-full text-left px-4 py-3 bg-[#E8F8F7] hover:bg-[#D1F2F0] rounded-lg border border-black transition-all font-semibold"
                    >
                      📋 Advanced Audit Logs
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-6 border-2 border-black shadow-lg hover:border-[#1BA39C] transition-all">
                  <h3 className="text-lg font-bold text-black mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-[#158A84]" />
                    Security Status
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                      <span className="font-semibold text-green-800">System Health</span>
                      <span className="text-2xl">🟢</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <span className="font-semibold text-blue-800">Firewall Status</span>
                      <span className="text-sm font-bold text-blue-800">ACTIVE</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200">
                      <span className="font-semibold text-purple-800">SSL Certificate</span>
                      <span className="text-sm font-bold text-purple-800">VALID</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                      <span className="font-semibold text-yellow-800">Last Backup</span>
                      <span className="text-sm font-bold text-yellow-800">2h ago</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-6">
              <CollapsibleSection
                title="User Role & Permission Management"
                subtitle="Assign roles, manage permissions, and control access levels"
                icon={<Users className="w-6 h-6 text-[#1BA39C]" />}
                defaultOpen={true}
              >
                <UserRoleManager />
              </CollapsibleSection>
            </div>
          )}

          {activeTab === 'sessions' && (
            <div className="space-y-6">
              <CollapsibleSection
                title="Active Session Management"
                subtitle="Monitor and control active user sessions with revocation capabilities"
                icon={<Zap className="w-6 h-6 text-[#C8E63D]" />}
                defaultOpen={true}
              >
                <ActiveSessionManager />
              </CollapsibleSection>
            </div>
          )}

          {activeTab === 'database' && (
            <div className="space-y-6">
              <CollapsibleSection
                title="Database Administration"
                subtitle="Database maintenance, backups, and performance optimization"
                icon={<Database className="w-6 h-6 text-[#158A84]" />}
                defaultOpen={true}
              >
                <DatabaseAdminPanel />
              </CollapsibleSection>
            </div>
          )}

          {activeTab === 'config' && (
            <div className="space-y-6">
              <CollapsibleSection
                title="System Configuration"
                subtitle="Feature flags, environment variables, and system-wide settings"
                icon={<Settings className="w-6 h-6 text-[#6B7280]" />}
                defaultOpen={true}
              >
                <SystemConfigurationPanel />
              </CollapsibleSection>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <CollapsibleSection
                title="Security Operations"
                subtitle="Real-time security monitoring, threat detection, and SOC2 compliance"
                icon={<Shield className="w-6 h-6 text-red-600" />}
                defaultOpen={true}
              >
                <Suspense fallback={<LoadingFallback />}>
                  <SOC2SecurityDashboard />
                </Suspense>
              </CollapsibleSection>
            </div>
          )}

          {activeTab === 'ai-usage' && (
            <div className="space-y-6">
              <CollapsibleSection
                title="AI Usage & Cost Tracking"
                subtitle="Claude AI usage, token consumption, and cost analysis"
                icon={<Brain className="w-6 h-6 text-purple-600" />}
                defaultOpen={true}
              >
                <Suspense fallback={<LoadingFallback />}>
                  <TenantAIUsageDashboard />
                </Suspense>
              </CollapsibleSection>

              <CollapsibleSection
                title="Claude & Billing Monitoring"
                subtitle="Detailed AI billing workflows, cost optimization, and performance metrics"
                icon={<BarChart3 className="w-6 h-6 text-blue-600" />}
                defaultOpen={false}
              >
                <Suspense fallback={<LoadingFallback />}>
                  <ClaudeBillingMonitoringDashboard />
                </Suspense>
              </CollapsibleSection>
            </div>
          )}

          {activeTab === 'performance' && (
            <div className="space-y-6">
              <CollapsibleSection
                title="Performance Monitoring"
                subtitle="Application errors, latency metrics, and system performance"
                icon={<Gauge className="w-6 h-6 text-orange-600" />}
                defaultOpen={true}
              >
                <Suspense fallback={<LoadingFallback />}>
                  <PerformanceMonitoringDashboard />
                </Suspense>
              </CollapsibleSection>

              <CollapsibleSection
                title="Cache & Connection Monitoring"
                subtitle="Cache hit rates, connection pool health, and real-time subscription status"
                icon={<Activity className="w-6 h-6 text-green-600" />}
                defaultOpen={false}
              >
                <Suspense fallback={<LoadingFallback />}>
                  <CacheMonitoringDashboard />
                </Suspense>
              </CollapsibleSection>
            </div>
          )}

          {activeTab === 'compliance' && (
            <div className="space-y-6">
              <CollapsibleSection
                title="Compliance Dashboard"
                subtitle="HIPAA, SOC2, backup status, disaster recovery drills, and vulnerability tracking"
                icon={<ShieldCheck className="w-6 h-6 text-green-600" />}
                defaultOpen={true}
              >
                <Suspense fallback={<LoadingFallback />}>
                  <ComplianceDashboard />
                </Suspense>
              </CollapsibleSection>
            </div>
          )}
        </div>
      </div>
    </RequireAdminAuth>
  );
};

// Loading fallback for lazy-loaded components
const LoadingFallback: React.FC = () => (
  <div className="flex items-center justify-center py-12">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1BA39C]"></div>
  </div>
);

export default SystemAdministrationPage;
