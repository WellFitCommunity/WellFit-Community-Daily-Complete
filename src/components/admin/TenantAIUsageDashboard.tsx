/**
 * Tenant AI Usage Dashboard
 *
 * Shows AI usage and costs for a specific tenant
 * Highlights top 5 users by AI usage (HIPAA-compliant - staff only)
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { DollarSign, Zap, TrendingUp, User, AlertCircle, Activity, Trophy } from 'lucide-react';
import { auditLogger } from '../../services/auditLogger';
import { useUser } from '../../contexts/AuthContext';

interface UserAIUsage {
  userId: string;
  userEmail: string;
  fullName: string | null;
  totalCost: number;
  totalTokens: number;
  totalRequests: number;
  lastUsed: string;
}

interface TenantAIMetrics {
  totalCost: number;
  totalTokens: number;
  totalRequests: number;
  avgCostPerRequest: number;
  avgTokensPerRequest: number;
}

const TenantAIUsageDashboard: React.FC = () => {
  const user = useUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<TenantAIMetrics | null>(null);
  const [topUsers, setTopUsers] = useState<UserAIUsage[]>([]);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('30d');
  const [tenantId, setTenantId] = useState<string | null>(null);

  // Fetch user's profile to get tenant_id
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', user.id)
        .single();

      setTenantId(profile?.tenant_id || null);
    };

    fetchProfile();
  }, [user]);

  useEffect(() => {
    if (tenantId) {
      loadAIUsage();
    }
  }, [timeRange, tenantId]);

  const loadAIUsage = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!tenantId) {
        setError('No tenant ID found');
        return;
      }

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

      // Get AI usage data for this tenant
      const { data: usageData, error: usageError } = await supabase
        .from('mcp_usage_logs')
        .select('user_id, cost, tokens_used, created_at')
        .eq('tenant_id', tenantId)
        .gte('created_at', cutoffDate.toISOString());

      if (usageError && usageError.code !== 'PGRST116') {
        // PGRST116 = table doesn't exist, which is okay
        throw usageError;
      }

      // Calculate metrics
      const totalCost = usageData?.reduce((sum, log) => sum + (log.cost || 0), 0) || 0;
      const totalTokens = usageData?.reduce((sum, log) => sum + (log.tokens_used || 0), 0) || 0;
      const totalRequests = usageData?.length || 0;

      setMetrics({
        totalCost,
        totalTokens,
        totalRequests,
        avgCostPerRequest: totalRequests > 0 ? totalCost / totalRequests : 0,
        avgTokensPerRequest: totalRequests > 0 ? totalTokens / totalRequests : 0
      });

      // Group by user and calculate per-user stats
      const userUsageMap = new Map<string, {
        cost: number;
        tokens: number;
        requests: number;
        lastUsed: string;
      }>();

      usageData?.forEach(log => {
        if (!log.user_id) return;

        const existing = userUsageMap.get(log.user_id) || {
          cost: 0,
          tokens: 0,
          requests: 0,
          lastUsed: log.created_at
        };

        userUsageMap.set(log.user_id, {
          cost: existing.cost + (log.cost || 0),
          tokens: existing.tokens + (log.tokens_used || 0),
          requests: existing.requests + 1,
          lastUsed: log.created_at > existing.lastUsed ? log.created_at : existing.lastUsed
        });
      });

      // Get user details for top users
      const userIds = Array.from(userUsageMap.keys());
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', userIds);

      // Combine usage data with profile data
      const userUsageArray: UserAIUsage[] = Array.from(userUsageMap.entries())
        .map(([userId, usage]) => {
          const profile = profilesData?.find(p => p.id === userId);
          return {
            userId,
            userEmail: profile?.email || 'Unknown',
            fullName: profile?.full_name,
            totalCost: usage.cost,
            totalTokens: usage.tokens,
            totalRequests: usage.requests,
            lastUsed: usage.lastUsed
          };
        })
        .sort((a, b) => b.totalCost - a.totalCost)
        .slice(0, 5); // Top 5 users

      setTopUsers(userUsageArray);

    } catch (err) {
      await auditLogger.error('TENANT_AI_USAGE_DASHBOARD_LOAD_FAILED', err as Error, {
        category: 'ADMINISTRATIVE',
        tenantId: tenantId || undefined
      });
      setError('Failed to load AI usage data');
    } finally {
      setLoading(false);
    }
  };

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
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
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
          <AlertCircle className="w-6 h-6" />
          <p>{error}</p>
        </div>
        <button
          onClick={loadAIUsage}
          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">AI Usage & Costs</h2>
          <p className="text-sm text-gray-600 mt-1">
            Claude AI usage tracking for your organization
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
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {range === '24h' ? '24 Hours' : range === '7d' ? '7 Days' : '30 Days'}
              </button>
            ))}
          </div>
          <button
            onClick={loadAIUsage}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-colors shadow-sm"
          >
            <Activity className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-green-50 p-6 rounded-lg border border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              <span className="font-semibold text-green-900">Total Cost</span>
            </div>
            <div className="text-3xl font-bold text-green-900">
              {formatCost(metrics.totalCost)}
            </div>
            <div className="text-sm text-green-700 mt-1">
              {formatCost(metrics.avgCostPerRequest)}/request
            </div>
          </div>

          <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-blue-900">Total Tokens</span>
            </div>
            <div className="text-3xl font-bold text-blue-900">
              {formatTokens(metrics.totalTokens)}
            </div>
            <div className="text-sm text-blue-700 mt-1">
              {formatTokens(metrics.avgTokensPerRequest)}/request
            </div>
          </div>

          <div className="bg-purple-50 p-6 rounded-lg border border-purple-200">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              <span className="font-semibold text-purple-900">Total Requests</span>
            </div>
            <div className="text-3xl font-bold text-purple-900">
              {metrics.totalRequests.toLocaleString()}
            </div>
            <div className="text-sm text-purple-700 mt-1">
              AI operations
            </div>
          </div>

          <div className="bg-orange-50 p-6 rounded-lg border border-orange-200">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-5 h-5 text-orange-600" />
              <span className="font-semibold text-orange-900">Active Users</span>
            </div>
            <div className="text-3xl font-bold text-orange-900">
              {topUsers.length}
            </div>
            <div className="text-sm text-orange-700 mt-1">
              Using AI features
            </div>
          </div>
        </div>
      )}

      {/* Top 5 Users */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-6 h-6 text-yellow-500" />
          <h3 className="text-lg font-semibold text-gray-900">
            Top 5 Users by AI Usage
          </h3>
        </div>

        {topUsers.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Zap className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p>No AI usage data found for this time period</p>
          </div>
        ) : (
          <div className="space-y-3">
            {topUsers.map((userUsage, index) => (
              <div
                key={userUsage.userId}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                      index === 0 ? 'bg-yellow-100 text-yellow-700' :
                      index === 1 ? 'bg-gray-100 text-gray-700' :
                      index === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      #{index + 1}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">
                        {userUsage.fullName || userUsage.userEmail}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {userUsage.totalRequests.toLocaleString()} requests • {formatTokens(userUsage.totalTokens)} tokens
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Last used: {new Date(userUsage.lastUsed).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-700">
                      {formatCost(userUsage.totalCost)}
                    </div>
                    <div className="text-xs text-gray-600">
                      {formatCost(userUsage.totalCost / userUsage.totalRequests)}/request
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <DollarSign className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-medium mb-1">AI Cost Breakdown</p>
            <p className="text-blue-800">
              Costs include AI processing, SmartScribe transcription, and intelligent automation features.
              Top users are highlighted to help manage AI resource allocation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TenantAIUsageDashboard;
