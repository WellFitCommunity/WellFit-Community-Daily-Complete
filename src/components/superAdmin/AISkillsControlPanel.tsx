import React, { useState, useEffect } from 'react';
import { SuperAdminService } from '../../services/superAdminService';
import { Brain, AlertTriangle, Power, TrendingUp, DollarSign, Globe, Shield, Heart, Users, Zap } from 'lucide-react';
import { auditLogger } from '../../services/auditLogger';
import { supabase } from '../../lib/supabaseClient';

interface AISkillConfig {
  tenant_id: string;
  tenant_name: string;
  billing_suggester_enabled: boolean;
  readmission_predictor_enabled: boolean;
  cultural_health_coach_enabled: boolean;
  welfare_check_dispatcher_enabled: boolean;
  emergency_intelligence_enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface TenantSkillStats {
  tenant_id: string;
  tenant_name: string;
  enabled_skills: number;
  total_skills: number;
  estimated_monthly_cost: number;
}

const AISkillsControlPanel: React.FC = () => {
  const [tenantConfigs, setTenantConfigs] = useState<AISkillConfig[]>([]);
  const [stats, setStats] = useState<TenantSkillStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showBulkEnableDialog, setShowBulkEnableDialog] = useState(false);
  const [filterEnabled, setFilterEnabled] = useState<'all' | 'enabled' | 'disabled'>('all');

  const skills = [
    {
      id: 'billing_suggester',
      name: 'Billing Code Suggester',
      description: 'AI-powered ICD-10/CPT code suggestions',
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      monthlyCost: 2.40,
      column: 'billing_suggester_enabled'
    },
    {
      id: 'readmission_predictor',
      name: 'Readmission Risk Predictor',
      description: '30-day readmission risk assessment',
      icon: TrendingUp,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      monthlyCost: 4.20,
      column: 'readmission_predictor_enabled'
    },
    {
      id: 'cultural_health_coach',
      name: 'Cultural Health Coach',
      description: 'Multi-language health content translation',
      icon: Globe,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      monthlyCost: 6.00,
      column: 'cultural_health_coach_enabled'
    },
    {
      id: 'welfare_check_dispatcher',
      name: 'Welfare Check Dispatcher',
      description: 'Law enforcement welfare check prioritization',
      icon: Shield,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      monthlyCost: 1.80,
      column: 'welfare_check_dispatcher_enabled'
    },
    {
      id: 'emergency_intelligence',
      name: 'Emergency Access Intelligence',
      description: 'Pre-generated 911 dispatcher briefings',
      icon: Zap,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      monthlyCost: 15.46,
      column: 'emergency_intelligence_enabled'
    }
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get all tenants
      const { data: tenants, error: tenantsError } = await supabase
        .from('tenants')
        .select('id, name')
        .order('name');

      if (tenantsError) throw tenantsError;

      // Get AI skill configs
      const { data: configs, error: configsError } = await supabase
        .from('ai_skill_config')
        .select('*');

      if (configsError) throw configsError;

      // Merge tenant data with configs
      const configsWithTenantNames = (configs || []).map((config: any) => {
        const tenant = tenants?.find((t: any) => t.id === config.tenant_id);
        return {
          ...config,
          tenant_name: tenant?.name || 'Unknown Tenant'
        };
      });

      setTenantConfigs(configsWithTenantNames);

      // Calculate stats
      const statsData: TenantSkillStats[] = (tenants || []).map((tenant: any) => {
        const config = configs?.find((c: any) => c.tenant_id === tenant.id);
        const enabledSkills = config ? [
          config.billing_suggester_enabled,
          config.readmission_predictor_enabled,
          config.cultural_health_coach_enabled,
          config.welfare_check_dispatcher_enabled,
          config.emergency_intelligence_enabled
        ].filter(Boolean).length : 0;

        const monthlyCost = (config ? [
          config.billing_suggester_enabled ? 2.40 : 0,
          config.readmission_predictor_enabled ? 4.20 : 0,
          config.cultural_health_coach_enabled ? 6.00 : 0,
          config.welfare_check_dispatcher_enabled ? 1.80 : 0,
          config.emergency_intelligence_enabled ? 15.46 : 0
        ].reduce((a, b) => a + b, 0) : 0);

        return {
          tenant_id: tenant.id,
          tenant_name: tenant.name,
          enabled_skills: enabledSkills,
          total_skills: 5,
          estimated_monthly_cost: monthlyCost
        };
      });

      setStats(statsData);
    } catch (err) {
      await auditLogger.error('AI_SKILLS_LOAD_FAILED', err as Error, {
        category: 'ADMINISTRATIVE'
      });
      setError('Failed to load AI skills configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSkill = async (tenantId: string, skillColumn: string, currentValue: boolean) => {
    try {
      setActionLoading(`${tenantId}-${skillColumn}`);

      // Check if config exists
      const { data: existing } = await supabase
        .from('ai_skill_config')
        .select('tenant_id')
        .eq('tenant_id', tenantId)
        .single();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('ai_skill_config')
          .update({
            [skillColumn]: !currentValue,
            updated_at: new Date().toISOString()
          })
          .eq('tenant_id', tenantId);

        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from('ai_skill_config')
          .insert({
            tenant_id: tenantId,
            [skillColumn]: !currentValue
          });

        if (error) throw error;
      }

      await auditLogger.info('AI_SKILL_TOGGLED', {
        category: 'ADMINISTRATIVE',
        tenantId,
        skill: skillColumn,
        newValue: !currentValue
      });

      await loadData();
    } catch (err) {
      await auditLogger.error('AI_SKILL_TOGGLE_FAILED', err as Error, {
        category: 'SECURITY_EVENT',
        tenantId,
        skill: skillColumn
      });
      setError('Failed to toggle skill');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkEnable = async () => {
    try {
      setActionLoading('bulk-enable');
      setShowBulkEnableDialog(false);

      // Get all tenants
      const { data: tenants, error: tenantsError } = await supabase
        .from('tenants')
        .select('id');

      if (tenantsError) throw tenantsError;

      // Enable all skills for all tenants
      for (const tenant of (tenants || [])) {
        await supabase
          .from('ai_skill_config')
          .upsert({
            tenant_id: tenant.id,
            billing_suggester_enabled: true,
            readmission_predictor_enabled: true,
            cultural_health_coach_enabled: true,
            welfare_check_dispatcher_enabled: true,
            emergency_intelligence_enabled: true,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'tenant_id'
          });
      }

      await auditLogger.info('AI_SKILLS_BULK_ENABLED', {
        category: 'ADMINISTRATIVE',
        tenantCount: tenants?.length || 0
      });

      await loadData();
    } catch (err) {
      await auditLogger.error('AI_SKILLS_BULK_ENABLE_FAILED', err as Error, {
        category: 'SECURITY_EVENT'
      });
      setError('Failed to bulk enable skills');
    } finally {
      setActionLoading(null);
    }
  };

  const totalEnabledSkills = stats.reduce((sum, s) => sum + s.enabled_skills, 0);
  const totalMonthlyCost = stats.reduce((sum, s) => sum + s.estimated_monthly_cost, 0);
  const tenantsWithSkills = stats.filter(s => s.enabled_skills > 0).length;

  const filteredStats = stats.filter(s => {
    if (filterEnabled === 'enabled') return s.enabled_skills > 0;
    if (filterEnabled === 'disabled') return s.enabled_skills === 0;
    return true;
  });

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center gap-3 text-red-600">
          <AlertTriangle className="w-6 h-6" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Brain className="w-8 h-8 text-purple-600" />
              AI Skills Control Panel
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Manage AI automation skills across all tenants
            </p>
          </div>
          <button
            onClick={() => setShowBulkEnableDialog(true)}
            disabled={actionLoading === 'bulk-enable'}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Power className="w-4 h-4" />
            {actionLoading === 'bulk-enable' ? 'Enabling...' : 'Enable All Skills'}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
            <div className="text-sm text-blue-600 font-medium">Total Enabled</div>
            <div className="text-3xl font-bold text-blue-900 mt-1">{totalEnabledSkills}</div>
            <div className="text-xs text-blue-600 mt-1">Across all tenants</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg border-2 border-green-200">
            <div className="text-sm text-green-600 font-medium">Active Tenants</div>
            <div className="text-3xl font-bold text-green-900 mt-1">{tenantsWithSkills}</div>
            <div className="text-xs text-green-600 mt-1">Using AI skills</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg border-2 border-purple-200">
            <div className="text-sm text-purple-600 font-medium">Total Tenants</div>
            <div className="text-3xl font-bold text-purple-900 mt-1">{stats.length}</div>
            <div className="text-xs text-purple-600 mt-1">In the system</div>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg border-2 border-orange-200">
            <div className="text-sm text-orange-600 font-medium">Monthly Cost</div>
            <div className="text-3xl font-bold text-orange-900 mt-1">
              ${totalMonthlyCost.toFixed(2)}
            </div>
            <div className="text-xs text-orange-600 mt-1">Estimated total</div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white p-4 rounded-lg shadow flex items-center gap-4">
        <span className="text-sm font-medium text-gray-700">Filter:</span>
        <div className="flex gap-2">
          {(['all', 'enabled', 'disabled'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setFilterEnabled(filter)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterEnabled === filter
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Tenant Skills Grid */}
      <div className="space-y-4">
        {filteredStats.map((tenantStat) => {
          const config = tenantConfigs.find(c => c.tenant_id === tenantStat.tenant_id);

          return (
            <div key={tenantStat.tenant_id} className="bg-white p-6 rounded-lg shadow">
              {/* Tenant Header */}
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{tenantStat.tenant_name}</h3>
                  <p className="text-sm text-gray-600">
                    {tenantStat.enabled_skills} of {tenantStat.total_skills} skills enabled
                    <span className="mx-2">•</span>
                    ${tenantStat.estimated_monthly_cost.toFixed(2)}/month
                  </p>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  tenantStat.enabled_skills === 0
                    ? 'bg-gray-100 text-gray-600'
                    : tenantStat.enabled_skills < 3
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-green-100 text-green-700'
                }`}>
                  {tenantStat.enabled_skills === 0 ? 'Inactive' :
                   tenantStat.enabled_skills < 3 ? 'Partial' : 'Active'}
                </div>
              </div>

              {/* Skills Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {skills.map((skill) => {
                  const isEnabled = config?.[skill.column as keyof AISkillConfig] as boolean ?? false;
                  const isLoading = actionLoading === `${tenantStat.tenant_id}-${skill.column}`;
                  const SkillIcon = skill.icon;

                  return (
                    <div
                      key={skill.id}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        isEnabled
                          ? `${skill.bgColor} border-${skill.color.replace('text-', '')}-300`
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className={`p-2 rounded-lg ${skill.bgColor}`}>
                          <SkillIcon className={`w-5 h-5 ${skill.color}`} />
                        </div>
                        <button
                          onClick={() => handleToggleSkill(tenantStat.tenant_id, skill.column, isEnabled)}
                          disabled={isLoading}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            isEnabled ? 'bg-green-600' : 'bg-gray-300'
                          } ${isLoading ? 'opacity-50' : ''}`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              isEnabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                      <h4 className={`text-sm font-semibold mb-1 ${isEnabled ? skill.color : 'text-gray-700'}`}>
                        {skill.name}
                      </h4>
                      <p className="text-xs text-gray-600 mb-2">{skill.description}</p>
                      <div className="text-xs font-medium text-gray-500">
                        ${skill.monthlyCost.toFixed(2)}/month
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bulk Enable Dialog */}
      {showBulkEnableDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Enable All AI Skills?</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will enable all 5 AI skills for all {stats.length} tenants.
              Estimated monthly cost: <span className="font-bold">${(stats.length * 29.86).toFixed(2)}</span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleBulkEnable}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Enable All
              </button>
              <button
                onClick={() => setShowBulkEnableDialog(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AISkillsControlPanel;
