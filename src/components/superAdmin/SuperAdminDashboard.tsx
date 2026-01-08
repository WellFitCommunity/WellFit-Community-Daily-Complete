import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { SuperAdminService } from '../../services/superAdminService';
import { SystemOverview, TenantWithStatus } from '../../types/superAdmin';
import { Activity, Users, Building2, AlertTriangle, Shield, Settings, Key, DollarSign, Brain, Home, LayoutDashboard } from 'lucide-react';
import TenantManagementPanel from './TenantManagementPanel';
import FeatureFlagControlPanel from './FeatureFlagControlPanel';
import SystemHealthPanel from './SystemHealthPanel';
import AuditLogViewer from './AuditLogViewer';
import TenantDataViewer from './TenantDataViewer';
import VaultAnimation from './VaultAnimation';
import PlatformSOC2Dashboard from './PlatformSOC2Dashboard';
import PlatformAICostDashboard from './PlatformAICostDashboard';
import GuardianMonitoringDashboard from './GuardianMonitoringDashboard';
import AISkillsControlPanel from './AISkillsControlPanel';
import { auditLogger } from '../../services/auditLogger';
import { PersonalizedGreeting } from '../ai-transparency';
import { EACard, EACardContent, EAButton } from '../envision-atlus';
import { useAdminAuth } from '../../contexts/AdminAuthContext';

// SECURITY: Use dedicated super-admin component instead of importing from tenant-admin
const SuperAdminApiKeyManager = React.lazy(() => import('./SuperAdminApiKeyManager'));

interface SystemMetricsProps {
  overview: SystemOverview | null;
}

const SystemMetrics: React.FC<SystemMetricsProps> = ({ overview }) => {
  if (!overview) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-slate-800 p-6 rounded-lg border border-slate-700 animate-pulse">
            <div className="h-12 bg-slate-700 rounded-sm"></div>
          </div>
        ))}
      </div>
    );
  }

  const criticalIssues = overview.criticalHealthIssues || 0;
  const systemHealth = criticalIssues > 0 ? 'critical' :
    overview.suspendedTenants > 0 ? 'degraded' : 'healthy';

  const metrics = [
    {
      icon: Building2,
      label: 'Total Tenants',
      value: overview.totalTenants,
      subtext: `${overview.activeTenants} active`,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/20',
      borderColor: 'border-blue-500/30'
    },
    {
      icon: Users,
      label: 'Total Users',
      value: overview.totalUsers,
      subtext: 'Across all tenants',
      color: 'text-green-400',
      bgColor: 'bg-green-500/20',
      borderColor: 'border-green-500/30'
    },
    {
      icon: Activity,
      label: 'Total Patients',
      value: overview.totalPatients,
      subtext: 'Active patients',
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/20',
      borderColor: 'border-purple-500/30'
    },
    {
      icon: Shield,
      label: 'System Health',
      value: systemHealth.charAt(0).toUpperCase() + systemHealth.slice(1),
      subtext: overview.suspendedTenants > 0 ? `${overview.suspendedTenants} suspended` : 'All systems operational',
      color: systemHealth === 'healthy' ? 'text-green-400' : systemHealth === 'degraded' ? 'text-yellow-400' : 'text-red-400',
      bgColor: systemHealth === 'healthy' ? 'bg-green-500/20' : systemHealth === 'degraded' ? 'bg-yellow-500/20' : 'bg-red-500/20',
      borderColor: systemHealth === 'healthy' ? 'border-green-500/30' : systemHealth === 'degraded' ? 'border-yellow-500/30' : 'border-red-500/30'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {metrics.map((metric, index) => (
        <div key={index} className={`bg-slate-800 p-6 rounded-lg border ${metric.borderColor} hover:border-opacity-60 transition-all`}>
          <div className="flex items-center justify-between mb-4">
            <div className={`p-3 rounded-lg ${metric.bgColor}`}>
              <metric.icon className={`w-6 h-6 ${metric.color}`} />
            </div>
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            {typeof metric.value === 'number' ? metric.value.toLocaleString() : metric.value}
          </div>
          <div className="text-sm text-slate-300 mb-1">{metric.label}</div>
          <div className="text-xs text-slate-500">{metric.subtext}</div>
        </div>
      ))}
    </div>
  );
};

const SuperAdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { autoAuthenticateAsSuperAdmin, isLoading: adminAuthLoading } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<SystemOverview | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'tenants' | 'features' | 'ai-skills' | 'health' | 'audit' | 'api-keys' | 'compliance' | 'ai-cost' | 'guardian'>('overview');
  const [selectedTenant, setSelectedTenant] = useState<TenantWithStatus | null>(null);
  const [showVaultAnimation, setShowVaultAnimation] = useState(false);

  // Handler to navigate to WellFit Admin panel
  const handleGoToWellFitAdmin = async () => {
    const success = await autoAuthenticateAsSuperAdmin();
    if (success) {
      navigate('/admin');
    } else {
      setError('Failed to authenticate for WellFit Admin access.');
    }
  };

  const checkAccess = useCallback(async () => {
    try {
      setLoading(true);
      const isSuperAdmin = await SuperAdminService.isSuperAdmin();

      if (!isSuperAdmin) {
        navigate('/unauthorized');
        return;
      }

      await loadSystemData();
    } catch (err: unknown) {
      await auditLogger.error('SUPER_ADMIN_ACCESS_CHECK_FAILED', err as Error, {
        category: 'SECURITY_EVENT'
      });
      setError('Failed to verify super admin access');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    checkAccess();
    // Vault animation disabled for production - proceed directly to dashboard
    setShowVaultAnimation(false);
  }, [checkAccess]);

  const loadSystemData = async () => {
    try {
      setError(null);
      const systemOverview = await SuperAdminService.getSystemOverview();
      setOverview(systemOverview);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      await auditLogger.error('SUPER_ADMIN_OVERVIEW_LOAD_FAILED', err as Error, {
        category: 'ADMINISTRATIVE',
        errorMessage
      });
      setError(`Failed to load system overview: ${errorMessage}`);
      setOverview({
        totalTenants: 0,
        activeTenants: 0,
        suspendedTenants: 0,
        totalUsers: 0,
        totalPatients: 0,
        featuresForceDisabled: 0,
        criticalHealthIssues: 0,
        criticalAuditEvents24h: 0
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00857a] mx-auto mb-4"></div>
          <p className="text-slate-300 font-medium">Loading Envision Master Admin Panel...</p>
        </div>
      </div>
    );
  }

  const ErrorBanner = () => error ? (
    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <span className="text-red-300">{error}</span>
        </div>
        <EAButton variant="danger" size="sm" onClick={loadSystemData}>
          Retry
        </EAButton>
      </div>
    </div>
  ) : null;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'tenants', label: 'Tenants', icon: Building2 },
    { id: 'features', label: 'Feature Flags', icon: Settings },
    { id: 'ai-skills', label: 'AI Skills', icon: Brain },
    { id: 'api-keys', label: 'API Keys', icon: Key },
    { id: 'ai-cost', label: 'AI Cost & Usage', icon: DollarSign },
    { id: 'compliance', label: 'Platform SOC2', icon: Shield },
    { id: 'guardian', label: 'Guardian Agent', icon: Shield },
    { id: 'health', label: 'System Health', icon: Activity },
    { id: 'audit', label: 'Audit Logs', icon: AlertTriangle }
  ];

  return (
    <>
      <div className="min-h-screen bg-linear-to-br from-slate-900 to-slate-800">
        {/* Header */}
        <header className="bg-linear-to-r from-[#00857a] to-[#006d64] border-b border-[#00554e] shadow-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white">Envision Atlus Master Panel</h1>
                <p className="text-sm text-teal-200 mt-1">System-wide tenant and feature management</p>
              </div>
              <div className="flex items-center gap-3">
                {/* WellFit Community Button */}
                <button
                  onClick={() => navigate('/dashboard')}
                  className="flex items-center gap-2 bg-[#8cc63f] hover:bg-[#7ab835] text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-md"
                >
                  <Home className="w-4 h-4" />
                  <span>WellFit Community</span>
                </button>
                {/* WellFit Admin Button */}
                <button
                  onClick={handleGoToWellFitAdmin}
                  disabled={adminAuthLoading}
                  className="flex items-center gap-2 bg-[#4a90d9] hover:bg-[#3a7bc8] text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {adminAuthLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <LayoutDashboard className="w-4 h-4" />
                  )}
                  <span>WellFit Admin</span>
                </button>
                <div className="flex items-center gap-2 bg-white/20 backdrop-blur-xs border border-white/30 px-4 py-2 rounded-lg">
                  <Shield className="w-5 h-5 text-white" />
                  <span className="text-sm font-medium text-white">Master Admin</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Personalized Greeting */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <PersonalizedGreeting />
        </div>

        {/* Tabs */}
        <div className="bg-slate-800/50 border-b border-slate-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-1 overflow-x-auto py-1" aria-label="Tabs">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`
                      flex items-center gap-2 py-3 px-4 rounded-lg font-medium text-sm transition-all duration-200 whitespace-nowrap
                      ${isActive
                        ? 'bg-[#00857a] text-white shadow-md'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <ErrorBanner />

          {activeTab === 'overview' && (
            <div>
              <SystemMetrics overview={overview} />
              <EACard>
                <EACardContent>
                  <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <button
                      onClick={() => setActiveTab('tenants')}
                      className="p-4 bg-slate-700/30 border border-slate-600 rounded-lg hover:border-blue-500/50 hover:bg-blue-500/10 transition-all duration-200 text-left"
                    >
                      <Building2 className="w-8 h-8 text-blue-400 mb-2" />
                      <div className="font-medium text-white">Manage Tenants</div>
                      <div className="text-sm text-slate-400">View and manage all tenants</div>
                    </button>
                    <button
                      onClick={() => setActiveTab('features')}
                      className="p-4 bg-slate-700/30 border border-slate-600 rounded-lg hover:border-purple-500/50 hover:bg-purple-500/10 transition-all duration-200 text-left"
                    >
                      <Settings className="w-8 h-8 text-purple-400 mb-2" />
                      <div className="font-medium text-white">Feature Flags</div>
                      <div className="text-sm text-slate-400">Control system features</div>
                    </button>
                    <button
                      onClick={() => setActiveTab('ai-skills')}
                      className="p-4 bg-slate-700/30 border border-slate-600 rounded-lg hover:border-purple-500/50 hover:bg-purple-500/10 transition-all duration-200 text-left"
                    >
                      <Brain className="w-8 h-8 text-purple-400 mb-2" />
                      <div className="font-medium text-white">AI Skills</div>
                      <div className="text-sm text-slate-400">Manage AI automation</div>
                    </button>
                    <button
                      onClick={() => setActiveTab('audit')}
                      className="p-4 bg-slate-700/30 border border-slate-600 rounded-lg hover:border-red-500/50 hover:bg-red-500/10 transition-all duration-200 text-left"
                    >
                      <AlertTriangle className="w-8 h-8 text-red-400 mb-2" />
                      <div className="font-medium text-white">Audit Logs</div>
                      <div className="text-sm text-slate-400">View security events</div>
                    </button>
                  </div>
                </EACardContent>
              </EACard>
            </div>
          )}

          {activeTab === 'tenants' && (
            <TenantManagementPanel
              onViewTenant={(tenantId) => {
                SuperAdminService.getAllTenants().then(tenants => {
                  const tenant = tenants.find(t => t.tenantId === tenantId);
                  if (tenant) setSelectedTenant(tenant);
                });
              }}
            />
          )}

          {activeTab === 'features' && <FeatureFlagControlPanel />}

          {activeTab === 'ai-skills' && <AISkillsControlPanel />}

          {activeTab === 'api-keys' && (
            <Suspense fallback={<div className="flex justify-center items-center h-64 text-slate-400">Loading API Keys...</div>}>
              <SuperAdminApiKeyManager />
            </Suspense>
          )}

          {activeTab === 'ai-cost' && <PlatformAICostDashboard />}

          {activeTab === 'compliance' && <PlatformSOC2Dashboard />}

          {activeTab === 'guardian' && <GuardianMonitoringDashboard />}

          {activeTab === 'health' && <SystemHealthPanel />}

          {activeTab === 'audit' && <AuditLogViewer />}
        </div>

        {/* Tenant Data Viewer Modal */}
        {selectedTenant && (
          <TenantDataViewer
            tenant={selectedTenant}
            onClose={() => setSelectedTenant(null)}
          />
        )}

        {/* Footer */}
        <footer className="border-t border-slate-800 py-4 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-xs text-slate-600 text-center">
              Envision Atlus Master Panel &bull; Powered by Envision VirtualEdge Group
            </p>
          </div>
        </footer>
      </div>

      {/* Vault Animation Overlay */}
      {showVaultAnimation && (
        <VaultAnimation
          onComplete={() => setShowVaultAnimation(false)}
          skipEnabled={true}
        />
      )}
    </>
  );
};

export default SuperAdminDashboard;
