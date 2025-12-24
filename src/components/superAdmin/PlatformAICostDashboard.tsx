/**
 * Platform AI Cost Dashboard
 *
 * Cross-tenant AI usage and cost tracking for Envision VirtualEdge Group
 * Shows aggregate AI usage across all tenants
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { DollarSign, TrendingUp, Zap, AlertCircle, Building2, Activity } from 'lucide-react';
import { auditLogger } from '../../services/auditLogger';

interface TenantAICost {
  tenantId: string;
  tenantName: string;
  tenantCode: string | null;
  totalCost: number;
  totalTokens: number;
  totalRequests: number;
  avgCostPerRequest: number;
}

interface PlatformAIMetrics {
  totalCostAllTenants: number;
  totalTokensAllTenants: number;
  totalRequestsAllTenants: number;
  avgCostPerTenant: number;
  highestCostTenant: string | null;
}

const PlatformAICostDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [platformMetrics, setPlatformMetrics] = useState<PlatformAIMetrics | null>(null);
  const [tenantCosts, setTenantCosts] = useState<TenantAICost[]>([]);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('30d');

  const loadAICosts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Calculate date range
      const now = new Date();
      const cutoffDate = new Date();
      switch (timeRange) {
        case '24h':
          cutoffDate.setHours(now.getHours() - 24);
          break;
        case '7d':
          cutoffDate.setDate(now.getDate() - 7);
          break;
        case '30d':
          cutoffDate.setDate(now.getDate() - 30);
          break;
      }

      // Get all tenants
      const { data: tenants, error: tenantsError } = await supabase
        .from('tenants')
        .select('id, name, tenant_code')
        .order('name');

      if (tenantsError) throw tenantsError;

      // Get AI usage data for each tenant
      const tenantCostData: TenantAICost[] = await Promise.all(
        (tenants || []).map(async (tenant: any) => {
          // Query MCP cost tracking table (if exists) or audit logs for AI usage
          const { data: usageData } = await supabase
            .from('mcp_usage_logs')
            .select('cost_usd, total_tokens')
            .eq('tenant_id', tenant.id)
            .gte('created_at', cutoffDate.toISOString());

          // Fallback to checking admin_audit_logs for AI operations
          // Note: admin_audit_logs uses action_type and action_description columns
          const { count: aiRequests } = await supabase
            .from('admin_audit_logs')
            .select('*', { count: 'exact', head: true })
            .or('action_type.ilike.%AI%,action_description.ilike.%AI%,action_description.ilike.%claude%,resource_type.ilike.%mcp%')
            .gte('created_at', cutoffDate.toISOString());

          const totalCost = usageData?.reduce((sum, log) => sum + (Number(log.cost_usd) || 0), 0) || 0;
          const totalTokens = usageData?.reduce((sum, log) => sum + (log.total_tokens || 0), 0) || 0;
          const totalRequests = aiRequests || 0;

          return {
            tenantId: tenant.id,
            tenantName: tenant.name,
            tenantCode: tenant.tenant_code,
            totalCost,
            totalTokens,
            totalRequests,
            avgCostPerRequest: totalRequests > 0 ? totalCost / totalRequests : 0
          };
        })
      );

      // Sort by cost descending
      tenantCostData.sort((a, b) => b.totalCost - a.totalCost);
      setTenantCosts(tenantCostData);

      // Calculate platform-wide metrics
      const totalCost = tenantCostData.reduce((sum, t) => sum + t.totalCost, 0);
      const totalTokens = tenantCostData.reduce((sum, t) => sum + t.totalTokens, 0);
      const totalRequests = tenantCostData.reduce((sum, t) => sum + t.totalRequests, 0);
      const highestCostTenant = tenantCostData.length > 0 ? tenantCostData[0].tenantName : null;

      setPlatformMetrics({
        totalCostAllTenants: totalCost,
        totalTokensAllTenants: totalTokens,
        totalRequestsAllTenants: totalRequests,
        avgCostPerTenant: tenantCostData.length > 0 ? totalCost / tenantCostData.length : 0,
        highestCostTenant
      });

    } catch (err) {
      await auditLogger.error('PLATFORM_AI_COST_DASHBOARD_LOAD_FAILED', err as Error, {
        category: 'ADMINISTRATIVE'
      });
      setError('Failed to load AI cost data');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    loadAICosts();
  }, [loadAICosts]);

  const formatCost = (cost: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(cost);
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(2)}M`;
    } else if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toString();
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded-sm w-1/3"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
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
          <AlertCircle className="w-6 h-6" />
          <p>{error}</p>
        </div>
        <button
          onClick={loadAICosts}
          className="mt-4 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors shadow-xs"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Platform AI Cost & Usage</h2>
            <p className="text-sm text-gray-600 mt-1">
              Cross-tenant AI usage tracking and cost analysis
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {(['24h', '7d', '30d'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                    timeRange === range
                      ? 'bg-orange-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {range === '24h' ? '24 Hours' : range === '7d' ? '7 Days' : '30 Days'}
                </button>
              ))}
            </div>
            <button
              onClick={loadAICosts}
              disabled={loading}
              className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2 transition-colors shadow-xs"
            >
              <Activity className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Platform-Wide Metrics */}
        {platformMetrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-green-900">Total Cost</span>
              </div>
              <div className="text-3xl font-bold text-green-900">
                {formatCost(platformMetrics.totalCostAllTenants)}
              </div>
              <div className="text-sm text-green-700 mt-1">
                Across all tenants
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-5 h-5 text-blue-600" />
                <span className="font-semibold text-blue-900">Total Tokens</span>
              </div>
              <div className="text-3xl font-bold text-blue-900">
                {formatTokens(platformMetrics.totalTokensAllTenants)}
              </div>
              <div className="text-sm text-blue-700 mt-1">
                {platformMetrics.totalRequestsAllTenants.toLocaleString()} requests
              </div>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-purple-600" />
                <span className="font-semibold text-purple-900">Avg Per Tenant</span>
              </div>
              <div className="text-3xl font-bold text-purple-900">
                {formatCost(platformMetrics.avgCostPerTenant)}
              </div>
              <div className="text-sm text-purple-700 mt-1">
                Average cost
              </div>
            </div>

            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-5 h-5 text-orange-600" />
                <span className="font-semibold text-orange-900">Highest Usage</span>
              </div>
              <div className="text-lg font-bold text-orange-900 truncate">
                {platformMetrics.highestCostTenant || 'N/A'}
              </div>
              <div className="text-sm text-orange-700 mt-1">
                Top consumer
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tenant Cost Breakdown */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Tenant AI Cost Breakdown
        </h3>

        {tenantCosts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Zap className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p>No AI usage data found for this time period</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tenantCosts.map((tenant, index) => (
              <div
                key={tenant.tenantId}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-bold text-orange-700">#{index + 1}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{tenant.tenantName}</span>
                        {tenant.tenantCode && (
                          <span className="px-2 py-0.5 bg-gray-100 rounded-sm text-xs font-mono text-gray-700">
                            {tenant.tenantCode}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {tenant.totalRequests.toLocaleString()} AI requests • {formatTokens(tenant.totalTokens)} tokens
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-700">
                      {formatCost(tenant.totalCost)}
                    </div>
                    <div className="text-xs text-gray-600">
                      {formatCost(tenant.avgCostPerRequest)}/request
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <DollarSign className="w-5 h-5 text-orange-600 mt-0.5" />
          <div className="text-sm text-orange-900">
            <p className="font-medium mb-1">AI Cost Tracking</p>
            <p className="text-orange-800">
              Costs include AI processing, SmartScribe transcription,
              intelligent automation, and other AI-powered features. Costs are calculated based on token usage
              and API pricing.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlatformAICostDashboard;
