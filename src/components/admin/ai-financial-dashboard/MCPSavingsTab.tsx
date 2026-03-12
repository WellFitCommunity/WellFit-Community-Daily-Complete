/**
 * MCPSavingsTab - MCP Savings tab content for AI Financial Dashboard
 *
 * Purpose: Displays user-level MCP cost savings, efficiency metrics, and daily savings trends
 * Used by: AIFinancialDashboard
 */

import React from 'react';
import {
  EACard,
  EACardHeader,
  EACardContent,
  EATabsContent,
} from '../../envision-atlus';
import {
  DollarSign,
  TrendingDown,
  Zap,
  Target,
  Activity,
  Award,
} from 'lucide-react';
import type { MCPUserMetrics, DailySavings } from './AIFinancialDashboard.types';

interface MCPSavingsTabProps {
  mcpUserMetrics: MCPUserMetrics | null;
  mcpSavingsPercentage: number;
  dailySavings: DailySavings[];
}

const MCPSavingsTab: React.FC<MCPSavingsTabProps> = ({
  mcpUserMetrics,
  mcpSavingsPercentage,
  dailySavings,
}) => {
  return (
    <EATabsContent value="savings" className="space-y-6">
      {!mcpUserMetrics || mcpUserMetrics.total_calls === 0 ? (
        <EACard>
          <EACardContent className="py-12">
            <div className="flex items-center justify-center gap-4">
              <Zap className="w-12 h-12 text-blue-500" />
              <div>
                <h3 className="text-xl font-bold text-white">MCP Cost Optimizer Active</h3>
                <p className="text-slate-400">Start using Claude-powered features to see your cost savings here</p>
              </div>
            </div>
          </EACardContent>
        </EACard>
      ) : (
        <>
          {/* Hero Stats */}
          <EACard className="bg-gradient-to-br from-green-600 via-emerald-600 to-teal-700">
            <EACardContent className="py-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">MCP Cost Savings</h2>
                  <p className="text-green-100">Intelligent caching reducing your AI costs</p>
                </div>
                <DollarSign className="w-16 h-16 text-white/50" />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-green-100 text-sm mb-1">Total Saved</p>
                  <p className="text-5xl font-bold text-white">${(mcpUserMetrics.total_saved ?? 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-green-100 text-sm mb-1">Savings Rate</p>
                  <p className="text-5xl font-bold text-white">{mcpSavingsPercentage.toFixed(0)}%</p>
                </div>
              </div>
            </EACardContent>
          </EACard>

          {/* Efficiency Metrics */}
          <div className="grid grid-cols-3 gap-4">
            <EACard>
              <EACardContent className="py-6">
                <div className="flex items-center justify-between mb-3">
                  <Target className="w-8 h-8 text-blue-400" />
                  <span className="text-3xl font-bold text-blue-400">
                    {(mcpUserMetrics.avg_cache_hit_rate ?? 0).toFixed(0)}%
                  </span>
                </div>
                <h3 className="font-semibold text-white">Cache Hit Rate</h3>
                <p className="text-sm text-slate-400 mt-1">
                  {mcpUserMetrics.total_cached_calls} / {mcpUserMetrics.total_calls} cached
                </p>
              </EACardContent>
            </EACard>

            <EACard>
              <EACardContent className="py-6">
                <div className="flex items-center justify-between mb-3">
                  <Activity className="w-8 h-8 text-purple-400" />
                  <div className="text-right">
                    <div className="font-bold text-white">
                      {mcpUserMetrics.total_haiku_calls} / {mcpUserMetrics.total_sonnet_calls}
                    </div>
                  </div>
                </div>
                <h3 className="font-semibold text-white">Haiku / Sonnet</h3>
                <p className="text-sm text-slate-400 mt-1">
                  {((mcpUserMetrics.total_haiku_calls / (mcpUserMetrics.total_calls || 1)) * 100).toFixed(0)}% using cheaper Haiku
                </p>
              </EACardContent>
            </EACard>

            <EACard>
              <EACardContent className="py-6">
                <div className="flex items-center justify-between mb-3">
                  <Award className="w-8 h-8 text-amber-400" />
                  <span className="text-3xl font-bold text-amber-400">
                    {mcpSavingsPercentage >= 70 ? 'A+' : mcpSavingsPercentage >= 50 ? 'A' : 'B'}
                  </span>
                </div>
                <h3 className="font-semibold text-white">Efficiency Grade</h3>
                <p className="text-sm text-slate-400 mt-1">
                  {mcpSavingsPercentage >= 70 ? 'Excellent' : mcpSavingsPercentage >= 50 ? 'Good' : 'Room to improve'}
                </p>
              </EACardContent>
            </EACard>
          </div>

          {/* Daily Savings Trend */}
          {dailySavings.length > 0 && (
            <EACard>
              <EACardHeader>
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-green-400" />
                  <h3 className="text-lg font-bold text-white">Daily Savings Trend (Last 7 Days)</h3>
                </div>
              </EACardHeader>
              <EACardContent>
                <div className="space-y-3">
                  {dailySavings.slice(0, 7).map((day, index) => (
                    <div key={index} className="flex items-center gap-4">
                      <div className="w-24 text-sm text-slate-400">
                        {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                      <div className="flex-1">
                        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all duration-300"
                            style={{ width: `${day.efficiency_score}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-right w-20">
                        <div className="text-sm font-bold text-green-400">${(day.saved_cost ?? 0).toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </EACardContent>
            </EACard>
          )}
        </>
      )}
    </EATabsContent>
  );
};

export default MCPSavingsTab;
