import React, { useState, useEffect, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { SuperAdminService } from '../../services/superAdminService';
import { SystemOverview, TenantWithStatus } from '../../types/superAdmin';
import { Activity, Users, Building2, AlertTriangle, Shield, Settings, Key, DollarSign, Brain } from 'lucide-react';
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

const ApiKeyManager = React.lazy(() => import('../admin/ApiKeyManager'));

interface SystemMetricsProps {
  overview: SystemOverview | null;
}

const SystemMetrics: React.FC<SystemMetricsProps> = ({ overview }) => {
  if (!overview) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white p-6 rounded-lg shadow animate-pulse">
            <div className="h-12 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  // Derive system health from overview data
  const criticalIssues = (overview as any).criticalHealthIssues || 0;
  const systemHealth = criticalIssues > 0 ? 'critical' :
    overview.suspendedTenants > 0 ? 'degraded' : 'healthy';

  const metrics = [
    {
      icon: Building2,
      label: 'Total Tenants',
      value: overview.totalTenants,
      subtext: `${overview.activeTenants} active`,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      icon: Users,
      label: 'Total Users',
      value: overview.totalUsers,
      subtext: 'Across all tenants',
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      icon: Activity,
      label: 'Total Patients',
      value: overview.totalPatients,
      subtext: 'Active patients',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      icon: Shield,
      label: 'System Health',
      value: systemHealth.charAt(0).toUpperCase() + systemHealth.slice(1),
      subtext: overview.suspendedTenants > 0 ? `${overview.suspendedTenants} suspended` : 'All systems operational',
      color: systemHealth === 'healthy' ? 'text-green-600' : systemHealth === 'degraded' ? 'text-yellow-600' : 'text-red-600',
      bgColor: systemHealth === 'healthy' ? 'bg-green-50' : systemHealth === 'degraded' ? 'bg-yellow-50' : 'bg-red-50'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {metrics.map((metric, index) => (
        <div key={index} className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className={`p-3 rounded-lg ${metric.bgColor}`}>
              <metric.icon className={`w-6 h-6 ${metric.color}`} />
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">
            {typeof metric.value === 'number' ? metric.value.toLocaleString() : metric.value}
          </div>
          <div className="text-sm text-gray-600 mb-1">{metric.label}</div>
          <div className="text-xs text-gray-500">{metric.subtext}</div>
        </div>
      ))}
    </div>
  );
};

const SuperAdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<SystemOverview | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'tenants' | 'features' | 'ai-skills' | 'health' | 'audit' | 'api-keys' | 'compliance' | 'ai-cost' | 'guardian'>('overview');
  const [selectedTenant, setSelectedTenant] = useState<TenantWithStatus | null>(null);
  const [showVaultAnimation, setShowVaultAnimation] = useState(false);

  useEffect(() => {
    checkAccess();
    // Show vault animation on first access in this session
    const hasSeenVault = sessionStorage.getItem('envision_vault_seen');
    if (!hasSeenVault) {
      setShowVaultAnimation(true);
      sessionStorage.setItem('envision_vault_seen', 'true');
    }
  }, []);

  const checkAccess = async () => {
    try {
      setLoading(true);
      const isSuperAdmin = await SuperAdminService.isSuperAdmin();

      if (!isSuperAdmin) {
        navigate('/unauthorized');
        return;
      }

      await loadSystemData();
    } catch (err) {
      await auditLogger.error('SUPER_ADMIN_ACCESS_CHECK_FAILED', err as Error, {
        category: 'SECURITY_EVENT'
      });
      setError('Failed to verify super admin access');
    } finally {
      setLoading(false);
    }
  };

  const loadSystemData = async () => {
    try {
      const systemOverview = await SuperAdminService.getSystemOverview();
      setOverview(systemOverview);
    } catch (err) {
      await auditLogger.error('SUPER_ADMIN_OVERVIEW_LOAD_FAILED', err as Error, {
        category: 'ADMINISTRATIVE'
      });
      setError('Failed to load system overview');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-teal-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-teal-900 font-medium">Loading Envision Master Admin Panel...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-teal-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-xl max-w-md border-2 border-red-200">
          <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2 text-center">Error</h2>
          <p className="text-gray-600 text-center">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 w-full bg-teal-600 text-white py-2 px-4 rounded hover:bg-teal-700 transition-colors"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity, color: 'teal' },
    { id: 'tenants', label: 'Tenants', icon: Building2, color: 'blue' },
    { id: 'features', label: 'Feature Flags', icon: Settings, color: 'purple' },
    { id: 'ai-skills', label: 'AI Skills', icon: Brain, color: 'purple' },
    { id: 'api-keys', label: 'API Keys', icon: Key, color: 'orange' },
    { id: 'ai-cost', label: 'AI Cost & Usage', icon: DollarSign, color: 'orange' },
    { id: 'compliance', label: 'Platform SOC2', icon: Shield, color: 'red' },
    { id: 'guardian', label: 'Guardian Agent', icon: Shield, color: 'emerald' },
    { id: 'health', label: 'System Health', icon: Activity, color: 'emerald' },
    { id: 'audit', label: 'Audit Logs', icon: AlertTriangle, color: 'red' }
  ];

  return (
    <>
      {/* Panel renders immediately - animation plays as non-blocking overlay */}
      <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-700 border-b border-teal-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Envision Atlus Master Panel</h1>
              <p className="text-sm text-teal-100 mt-1">System-wide tenant and feature management</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm border border-white/30 px-4 py-2 rounded-lg">
                <Shield className="w-5 h-5 text-white" />
                <span className="text-sm font-medium text-white">Master Admin</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Personalized Greeting */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <PersonalizedGreeting />
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const colorMap: Record<string, { border: string; text: string; bg: string }> = {
                teal: { border: 'border-teal-500', text: 'text-teal-600', bg: 'bg-teal-50' },
                blue: { border: 'border-blue-700', text: 'text-blue-700', bg: 'bg-blue-50' },
                purple: { border: 'border-purple-600', text: 'text-purple-600', bg: 'bg-purple-50' },
                orange: { border: 'border-orange-500', text: 'text-orange-600', bg: 'bg-orange-50' },
                emerald: { border: 'border-emerald-600', text: 'text-emerald-600', bg: 'bg-emerald-50' },
                red: { border: 'border-red-600', text: 'text-red-600', bg: 'bg-red-50' }
              };
              const colors = colorMap[tab.color];
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`
                    flex items-center gap-2 py-4 px-3 border-b-3 font-medium text-sm transition-all duration-200
                    ${isActive
                      ? `${colors.border} ${colors.text} ${colors.bg} rounded-t-lg -mb-px`
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <div>
            <SystemMetrics overview={overview} />
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <button
                  onClick={() => setActiveTab('tenants')}
                  className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-700 hover:bg-blue-50 transition-all duration-200 text-left shadow-sm hover:shadow-md"
                >
                  <Building2 className="w-8 h-8 text-blue-700 mb-2" />
                  <div className="font-medium text-gray-900">Manage Tenants</div>
                  <div className="text-sm text-gray-600">View and manage all tenants</div>
                </button>
                <button
                  onClick={() => setActiveTab('features')}
                  className="p-4 border-2 border-gray-200 rounded-lg hover:border-purple-600 hover:bg-purple-50 transition-all duration-200 text-left shadow-sm hover:shadow-md"
                >
                  <Settings className="w-8 h-8 text-purple-600 mb-2" />
                  <div className="font-medium text-gray-900">Feature Flags</div>
                  <div className="text-sm text-gray-600">Control system features</div>
                </button>
                <button
                  onClick={() => setActiveTab('ai-skills')}
                  className="p-4 border-2 border-gray-200 rounded-lg hover:border-purple-600 hover:bg-purple-50 transition-all duration-200 text-left shadow-sm hover:shadow-md"
                >
                  <Brain className="w-8 h-8 text-purple-600 mb-2" />
                  <div className="font-medium text-gray-900">AI Skills</div>
                  <div className="text-sm text-gray-600">Manage AI automation</div>
                </button>
                <button
                  onClick={() => setActiveTab('audit')}
                  className="p-4 border-2 border-gray-200 rounded-lg hover:border-red-600 hover:bg-red-50 transition-all duration-200 text-left shadow-sm hover:shadow-md"
                >
                  <AlertTriangle className="w-8 h-8 text-red-600 mb-2" />
                  <div className="font-medium text-gray-900">Audit Logs</div>
                  <div className="text-sm text-gray-600">View security events</div>
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tenants' && (
          <TenantManagementPanel
            onViewTenant={(tenantId) => {
              // Find tenant and show viewer
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
          <Suspense fallback={<div className="flex justify-center items-center h-64">Loading API Keys...</div>}>
            <ApiKeyManager />
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
      </div>

      {/* Vault Animation Overlay - Non-blocking, plays over the dashboard */}
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
