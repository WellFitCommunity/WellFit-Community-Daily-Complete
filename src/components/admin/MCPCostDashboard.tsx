// =====================================================
// MCP COST DASHBOARD
// Purpose: Visualize MCP cost savings and cache efficiency
// =====================================================

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { DollarSign, TrendingDown, Zap, Target, Activity, Award } from 'lucide-react';

interface CostMetrics {
  total_spent: number;
  total_saved: number;
  avg_cache_hit_rate: number;
  total_calls: number;
  total_cached_calls: number;
  total_haiku_calls: number;
  total_sonnet_calls: number;
}

interface DailySavings {
  date: string;
  total_cost: number;
  saved_cost: number;
  cache_hit_rate: number;
  efficiency_score: number;
}

export const MCPCostDashboard: React.FC = () => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<CostMetrics | null>(null);
  const [dailySavings, setDailySavings] = useState<DailySavings[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCostData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchCostData = async () => {
    if (!user) return;

    try {
      // Fetch summary metrics
      const { data: metricsData, error: metricsError } = await supabase
        .from('mcp_cost_savings_summary')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (metricsError && metricsError.code !== 'PGRST116') throw metricsError;
      setMetrics(metricsData);

      // Fetch daily savings
      const { data: savingsData, error: savingsError } = await supabase.rpc(
        'calculate_mcp_daily_savings',
        {
          target_user_id: user.id,
        }
      );

      if (savingsError) throw savingsError;
      setDailySavings(savingsData || []);
    } catch (error) {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-32 bg-gradient-to-r from-green-100 to-emerald-100 rounded-xl"></div>
        <div className="grid grid-cols-3 gap-4">
          <div className="h-24 bg-gray-200 rounded-lg"></div>
          <div className="h-24 bg-gray-200 rounded-lg"></div>
          <div className="h-24 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (!metrics || metrics.total_calls === 0) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 border border-blue-200">
        <div className="flex items-center space-x-3">
          <Zap className="w-8 h-8 text-blue-600" />
          <div>
            <h3 className="font-bold text-gray-800">MCP Cost Optimizer Active</h3>
            <p className="text-sm text-gray-600">
              Start using Claude-powered features to see your cost savings here
            </p>
          </div>
        </div>
      </div>
    );
  }

  const totalPotentialCost = metrics.total_spent + metrics.total_saved;
  const savingsPercentage =
    totalPotentialCost > 0 ? (metrics.total_saved / totalPotentialCost) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Hero Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-green-400 via-emerald-500 to-teal-600 rounded-2xl p-8 text-white shadow-2xl"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold mb-2">MCP Cost Savings</h2>
            <p className="text-green-100">Intelligent caching reducing your AI costs</p>
          </div>
          <DollarSign className="w-16 h-16 opacity-50" />
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-green-100 text-sm mb-1">Total Saved</p>
            <p className="text-5xl font-bold">${(metrics.total_saved ?? 0).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-green-100 text-sm mb-1">Savings Rate</p>
            <p className="text-5xl font-bold">{(savingsPercentage ?? 0).toFixed(0)}%</p>
          </div>
        </div>

        <div className="mt-6 bg-white/20 backdrop-blur-sm rounded-xl p-4">
          <div className="flex justify-between items-center">
            <span className="text-sm">Without MCP:</span>
            <span className="font-bold">${(totalPotentialCost ?? 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-sm">With MCP:</span>
            <span className="font-bold text-green-200">${(metrics.total_spent ?? 0).toFixed(2)}</span>
          </div>
        </div>
      </motion.div>

      {/* Efficiency Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Cache Hit Rate */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 border border-blue-200 hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center justify-between mb-3">
            <Target className="w-8 h-8 text-blue-600" />
            <span className="text-3xl font-bold text-blue-600">
              {(metrics.avg_cache_hit_rate ?? 0).toFixed(0)}%
            </span>
          </div>
          <h3 className="font-semibold text-gray-800">Cache Hit Rate</h3>
          <p className="text-sm text-gray-600 mt-1">
            {metrics.total_cached_calls} / {metrics.total_calls} cached responses
          </p>
        </motion.div>

        {/* Model Distribution */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200 hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center justify-between mb-3">
            <Activity className="w-8 h-8 text-purple-600" />
            <div className="text-right">
              <div className="text-sm text-gray-600">Haiku / Sonnet</div>
              <div className="font-bold text-gray-800">
                {metrics.total_haiku_calls} / {metrics.total_sonnet_calls}
              </div>
            </div>
          </div>
          <h3 className="font-semibold text-gray-800">Model Usage</h3>
          <p className="text-sm text-gray-600 mt-1">
            {(((metrics.total_haiku_calls ?? 0) / (metrics.total_calls || 1)) * 100).toFixed(0)}% using cheaper
            Haiku
          </p>
        </motion.div>

        {/* Efficiency Score */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-6 border border-amber-200 hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center justify-between mb-3">
            <Award className="w-8 h-8 text-amber-600" />
            <span className="text-3xl font-bold text-amber-600">
              {savingsPercentage >= 70 ? 'A+' : savingsPercentage >= 50 ? 'A' : 'B'}
            </span>
          </div>
          <h3 className="font-semibold text-gray-800">Efficiency Grade</h3>
          <p className="text-sm text-gray-600 mt-1">
            {savingsPercentage >= 70
              ? 'Excellent optimization'
              : savingsPercentage >= 50
                ? 'Good optimization'
                : 'Room for improvement'}
          </p>
        </motion.div>
      </div>

      {/* Daily Savings Trend */}
      {dailySavings.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-xl p-6 border border-gray-200 shadow-md"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-green-600" />
              Daily Savings Trend (Last 7 Days)
            </h3>
          </div>

          <div className="space-y-3">
            {dailySavings.slice(0, 7).map((day, index) => (
              <div key={index} className="flex items-center gap-4">
                <div className="w-24 text-sm text-gray-600">
                  {new Date(day.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-2 bg-gray-200 rounded-full flex-1 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${day.efficiency_score}%` }}
                        transition={{ duration: 0.8, delay: index * 0.1 }}
                        className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full"
                      ></motion.div>
                    </div>
                    <span className="text-xs font-bold text-gray-700 w-12 text-right">
                      {day.efficiency_score}%
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm font-bold text-green-600">
                    ${(day.saved_cost ?? 0).toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-500">${(day.total_cost ?? 0).toFixed(2)} spent</div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Tips for Better Savings */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-200"
      >
        <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
          <Zap className="w-5 h-5 text-indigo-600" />
          Optimization Tips
        </h3>
        <ul className="space-y-2 text-sm text-gray-700">
          {(metrics.avg_cache_hit_rate ?? 0) < 50 && (
            <li>
              • <span className="font-semibold">Low cache hit rate:</span> Try using similar
              workflows to benefit from caching
            </li>
          )}
          {(((metrics.total_sonnet_calls ?? 0) / (metrics.total_calls || 1)) * 100) > 70 && (
            <li>
              • <span className="font-semibold">High Sonnet usage:</span> Consider using Haiku for
              simpler tasks (60% cheaper)
            </li>
          )}
          {savingsPercentage < 50 && (
            <li>
              • <span className="font-semibold">Improve efficiency:</span> Use MCP-optimized
              endpoints for repetitive tasks
            </li>
          )}
          {savingsPercentage >= 70 && (
            <li>
              • <span className="font-semibold text-green-600">Excellent work!</span> You're
              maximizing MCP benefits
            </li>
          )}
        </ul>
      </motion.div>
    </div>
  );
};
