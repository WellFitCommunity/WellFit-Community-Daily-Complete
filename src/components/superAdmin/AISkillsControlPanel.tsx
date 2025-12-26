import React, { useState, useEffect, useMemo } from 'react';
import { Brain, AlertTriangle, Power, Search, Filter, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { auditLogger } from '../../services/auditLogger';
import { supabase } from '../../lib/supabaseClient';

// Types for the modular AI skills design
interface AISkill {
  id: string;
  skill_key: string;
  skill_number: number;
  name: string;
  description: string | null;
  category: string;
  model: string;
  monthly_cost_estimate: number;
  icon_name: string | null;
  color_class: string | null;
  requires_license_tier: string[];
  is_active: boolean;
}

interface TenantSkillConfig {
  skill_id: string;
  skill_key: string;
  skill_number: number;
  name: string;
  description: string | null;
  category: string;
  model: string;
  monthly_cost_estimate: number;
  icon_name: string | null;
  color_class: string | null;
  is_entitled: boolean;
  is_enabled: boolean;
  settings: Record<string, unknown>;
}

interface Tenant {
  id: string;
  name: string;
  license_tier: string;
}

interface TenantWithSkills extends Tenant {
  skills: TenantSkillConfig[];
  enabled_count: number;
  entitled_count: number;
  total_cost: number;
}

// Category display info
const categoryInfo: Record<string, { label: string; color: string; bgColor: string }> = {
  core: { label: 'Core', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  clinical_docs: { label: 'Clinical Docs', color: 'text-green-700', bgColor: 'bg-green-100' },
  decision_support: { label: 'Decision Support', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  patient_engagement: { label: 'Patient Engagement', color: 'text-pink-700', bgColor: 'bg-pink-100' },
  risk_prediction: { label: 'Risk Prediction', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  admin: { label: 'Admin', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  conversational: { label: 'Conversational AI', color: 'text-cyan-700', bgColor: 'bg-cyan-100' },
  interoperability: { label: 'Interoperability', color: 'text-indigo-700', bgColor: 'bg-indigo-100' },
};

// License tier display info
const licenseTierInfo: Record<string, { label: string; color: string; bgColor: string }> = {
  standard: { label: 'Standard', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  professional: { label: 'Professional', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  enterprise: { label: 'Enterprise', color: 'text-purple-700', bgColor: 'bg-purple-100' },
};

// Dynamic icon component - safely access Lucide icons by name
const DynamicIcon: React.FC<{ name: string | null; className?: string }> = ({ name, className }) => {
  if (!name) return <Brain className={className} />;
  // Use unknown as intermediate type for safe casting
  const icons = LucideIcons as unknown as Record<string, React.FC<{ className?: string }>>;
  const IconComponent = icons[name];
  return IconComponent ? <IconComponent className={className} /> : <Brain className={className} />;
};

const AISkillsControlPanel: React.FC = () => {
  const [allSkills, setAllSkills] = useState<AISkill[]>([]);
  const [tenants, setTenants] = useState<TenantWithSkills[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled' | 'not-entitled'>('all');

  // Expanded tenants
  const [expandedTenants, setExpandedTenants] = useState<Set<string>>(new Set());

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load all skills from master table
      const { data: skills, error: skillsError } = await supabase
        .from('ai_skills')
        .select('*')
        .eq('is_active', true)
        .order('skill_number');

      if (skillsError) throw skillsError;
      setAllSkills(skills || []);

      // Load tenants with their license tier
      const { data: tenantsData, error: tenantsError } = await supabase
        .from('tenants')
        .select(`
          id,
          name,
          tenant_module_config!inner(license_tier)
        `)
        .order('name');

      if (tenantsError) throw tenantsError;

      // Load skill configs for each tenant
      const tenantsWithSkills: TenantWithSkills[] = await Promise.all(
        (tenantsData || []).map(async (tenant: { id: string; name: string; tenant_module_config: { license_tier: string }[] }) => {
          const { data: skillConfigs, error: configError } = await supabase
            .rpc('get_tenant_ai_skills', { p_tenant_id: tenant.id });

          if (configError) {
            auditLogger.error('TENANT_SKILLS_LOAD_FAILED', { tenantId: tenant.id, error: configError });
            return {
              id: tenant.id,
              name: tenant.name,
              license_tier: tenant.tenant_module_config?.[0]?.license_tier || 'standard',
              skills: [],
              enabled_count: 0,
              entitled_count: 0,
              total_cost: 0,
            };
          }

          const skills = (skillConfigs || []) as TenantSkillConfig[];
          const enabledSkills = skills.filter(s => s.is_enabled);
          const entitledSkills = skills.filter(s => s.is_entitled);
          const totalCost = enabledSkills.reduce((sum, s) => sum + (s.monthly_cost_estimate || 0), 0);

          return {
            id: tenant.id,
            name: tenant.name,
            license_tier: tenant.tenant_module_config?.[0]?.license_tier || 'standard',
            skills,
            enabled_count: enabledSkills.length,
            entitled_count: entitledSkills.length,
            total_cost: totalCost,
          };
        })
      );

      setTenants(tenantsWithSkills);
    } catch (err: unknown) {
      await auditLogger.error('AI_SKILLS_LOAD_FAILED', err as Error, {
        category: 'ADMINISTRATIVE'
      });
      setError('Failed to load AI skills configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSkill = async (tenantId: string, skillKey: string, currentEnabled: boolean) => {
    try {
      setActionLoading(`${tenantId}-${skillKey}`);

      const { data, error: toggleError } = await supabase.rpc('toggle_tenant_ai_skill', {
        p_tenant_id: tenantId,
        p_skill_key: skillKey,
        p_enabled: !currentEnabled,
        p_user_id: null // Will be set by RLS
      });

      if (toggleError) throw toggleError;

      await auditLogger.info('AI_SKILL_TOGGLED', {
        category: 'ADMINISTRATIVE',
        tenantId,
        skillKey,
        newValue: !currentEnabled
      });

      await loadData();
    } catch (err: unknown) {
      await auditLogger.error('AI_SKILL_TOGGLE_FAILED', err as Error, {
        category: 'SECURITY_EVENT',
        tenantId,
        skillKey
      });
      setError(`Failed to toggle skill: ${(err as Error).message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkEnableAll = async (tenantId: string) => {
    try {
      setActionLoading(`bulk-${tenantId}`);
      const tenant = tenants.find(t => t.id === tenantId);
      if (!tenant) return;

      // Enable all entitled skills
      for (const skill of tenant.skills.filter(s => s.is_entitled && !s.is_enabled)) {
        await supabase.rpc('toggle_tenant_ai_skill', {
          p_tenant_id: tenantId,
          p_skill_key: skill.skill_key,
          p_enabled: true,
          p_user_id: null
        });
      }

      await auditLogger.info('AI_SKILLS_BULK_ENABLED', {
        category: 'ADMINISTRATIVE',
        tenantId
      });

      await loadData();
    } catch (err: unknown) {
      await auditLogger.error('AI_SKILLS_BULK_ENABLE_FAILED', err as Error, {
        category: 'SECURITY_EVENT'
      });
      setError('Failed to bulk enable skills');
    } finally {
      setActionLoading(null);
    }
  };

  const toggleTenantExpanded = (tenantId: string) => {
    setExpandedTenants(prev => {
      const next = new Set(prev);
      if (next.has(tenantId)) {
        next.delete(tenantId);
      } else {
        next.add(tenantId);
      }
      return next;
    });
  };

  // Get unique categories from skills
  const categories = useMemo(() => {
    const cats = new Set(allSkills.map(s => s.category));
    return Array.from(cats).sort();
  }, [allSkills]);

  // Filter tenants
  const filteredTenants = useMemo(() => {
    return tenants.filter(tenant => {
      if (tierFilter !== 'all' && tenant.license_tier !== tierFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!tenant.name.toLowerCase().includes(query)) return false;
      }
      return true;
    });
  }, [tenants, tierFilter, searchQuery]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalEnabled = tenants.reduce((sum, t) => sum + t.enabled_count, 0);
    const totalEntitled = tenants.reduce((sum, t) => sum + t.entitled_count, 0);
    const totalCost = tenants.reduce((sum, t) => sum + t.total_cost, 0);
    return { totalEnabled, totalEntitled, totalCost };
  }, [tenants]);

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded-sm w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-sm"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="flex items-center gap-3 text-red-600">
          <AlertTriangle className="w-6 h-6" />
          <p>{error}</p>
          <button onClick={loadData} className="ml-auto px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Brain className="w-8 h-8 text-purple-600" />
              AI Skills Control Panel
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Manage {allSkills.length} AI skills across {tenants.length} tenants (Modular Design)
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
            <div className="text-sm text-blue-600 font-medium">Total Skills</div>
            <div className="text-3xl font-bold text-blue-900 mt-1">{allSkills.length}</div>
            <div className="text-xs text-blue-600 mt-1">Available in catalog</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg border-2 border-green-200">
            <div className="text-sm text-green-600 font-medium">Skills Enabled</div>
            <div className="text-3xl font-bold text-green-900 mt-1">{totals.totalEnabled}</div>
            <div className="text-xs text-green-600 mt-1">Across all tenants</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg border-2 border-purple-200">
            <div className="text-sm text-purple-600 font-medium">Skills Entitled</div>
            <div className="text-3xl font-bold text-purple-900 mt-1">{totals.totalEntitled}</div>
            <div className="text-xs text-purple-600 mt-1">Licensed to use</div>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg border-2 border-orange-200">
            <div className="text-sm text-orange-600 font-medium">Monthly Cost</div>
            <div className="text-3xl font-bold text-orange-900 mt-1">
              ${totals.totalCost.toFixed(2)}
            </div>
            <div className="text-xs text-orange-600 mt-1">Estimated total</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tenants..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* License Tier Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Tiers</option>
              <option value="standard">Standard</option>
              <option value="professional">Professional</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {categoryInfo[cat]?.label || cat}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">All Status</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
            <option value="not-entitled">Not Entitled</option>
          </select>
        </div>
      </div>

      {/* Tenant Cards */}
      <div className="space-y-4">
        {filteredTenants.map((tenant) => {
          const isExpanded = expandedTenants.has(tenant.id);
          const tierInfo = licenseTierInfo[tenant.license_tier] || licenseTierInfo.standard;

          // Filter skills based on category and status
          const filteredSkills = tenant.skills.filter(skill => {
            if (categoryFilter !== 'all' && skill.category !== categoryFilter) return false;
            if (statusFilter === 'enabled' && !skill.is_enabled) return false;
            if (statusFilter === 'disabled' && (skill.is_enabled || !skill.is_entitled)) return false;
            if (statusFilter === 'not-entitled' && skill.is_entitled) return false;
            return true;
          });

          return (
            <div key={tenant.id} className="bg-white rounded-lg shadow-sm overflow-hidden">
              {/* Tenant Header */}
              <div
                className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleTenantExpanded(tenant.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    )}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{tenant.name}</h3>
                      <p className="text-sm text-gray-600">
                        {tenant.enabled_count} enabled / {tenant.entitled_count} entitled / {tenant.skills.length} total
                        <span className="mx-2">•</span>
                        ${tenant.total_cost.toFixed(2)}/month
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${tierInfo.bgColor} ${tierInfo.color}`}>
                      {tierInfo.label}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleBulkEnableAll(tenant.id);
                      }}
                      disabled={actionLoading === `bulk-${tenant.id}` || tenant.enabled_count === tenant.entitled_count}
                      className="px-3 py-1 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      <Power className="w-4 h-4" />
                      {actionLoading === `bulk-${tenant.id}` ? 'Enabling...' : 'Enable All'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Skills Grid (Expanded) */}
              {isExpanded && (
                <div className="p-4 border-t border-gray-200 bg-gray-50">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {filteredSkills.map((skill) => {
                      const isLoading = actionLoading === `${tenant.id}-${skill.skill_key}`;
                      const catInfo = categoryInfo[skill.category] || categoryInfo.core;

                      return (
                        <div
                          key={skill.skill_key}
                          className={`p-4 rounded-lg border-2 transition-all ${
                            !skill.is_entitled
                              ? 'bg-gray-100 border-gray-200 opacity-60'
                              : skill.is_enabled
                              ? 'bg-white border-green-300'
                              : 'bg-white border-gray-200'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className={`p-2 rounded-lg ${catInfo.bgColor}`}>
                              <DynamicIcon
                                name={skill.icon_name}
                                className={`w-5 h-5 ${skill.color_class || catInfo.color}`}
                              />
                            </div>
                            {!skill.is_entitled ? (
                              <div className="flex items-center gap-1 text-gray-400">
                                <Lock className="w-4 h-4" />
                                <span className="text-xs">Not Entitled</span>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleToggleSkill(tenant.id, skill.skill_key, skill.is_enabled)}
                                disabled={isLoading}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                  skill.is_enabled ? 'bg-green-600' : 'bg-gray-300'
                                } ${isLoading ? 'opacity-50' : ''}`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    skill.is_enabled ? 'translate-x-6' : 'translate-x-1'
                                  }`}
                                />
                              </button>
                            )}
                          </div>
                          <h4 className={`text-sm font-semibold mb-1 ${
                            skill.is_enabled ? 'text-gray-900' : 'text-gray-600'
                          }`}>
                            #{skill.skill_number} {skill.name}
                          </h4>
                          <p className="text-xs text-gray-500 mb-2 line-clamp-2">
                            {skill.description}
                          </p>
                          <div className="flex items-center justify-between text-xs">
                            <span className={`px-2 py-0.5 rounded-full ${catInfo.bgColor} ${catInfo.color}`}>
                              {catInfo.label}
                            </span>
                            <span className="font-medium text-gray-500">
                              ${skill.monthly_cost_estimate?.toFixed(2)}/mo
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {filteredSkills.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No skills match the current filters
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredTenants.length === 0 && (
        <div className="bg-white p-8 rounded-lg shadow-sm text-center text-gray-500">
          No tenants match the current filters
        </div>
      )}
    </div>
  );
};

export default AISkillsControlPanel;
