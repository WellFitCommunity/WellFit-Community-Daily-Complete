// src/components/admin/ApiKeyManager/HeaderStats.tsx
//
// Page header (title + refresh controls) and the 5-card stats strip.

import React from 'react';
import type { ApiKey } from './types';
import { LoadingSpinner } from './GenerateKeyForm';

export interface StatsSummary {
  total: number;
  active: number;
  inactive: number;
  totalUsage: number;
  recentlyUsed: number;
}

/**
 * Compute the dashboard stats from the current list of API keys.
 */
export function computeStats(apiKeys: ApiKey[]): StatsSummary {
  return {
    total: apiKeys.length,
    active: apiKeys.filter((k) => k.active).length,
    inactive: apiKeys.filter((k) => !k.active).length,
    totalUsage: apiKeys.reduce((sum, k) => sum + k.usage_count, 0),
    recentlyUsed: apiKeys.filter((k) => {
      if (!k.last_used) return false;
      const daysSinceUse =
        (Date.now() - new Date(k.last_used).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceUse <= 7;
    }).length,
  };
}

interface HeaderStatsProps {
  loading: boolean;
  autoRefreshActive: boolean;
  onRefresh: () => void;
  onToggleAutoRefresh: () => void;
  stats: StatsSummary;
}

export const HeaderStats: React.FC<HeaderStatsProps> = ({
  loading,
  autoRefreshActive,
  onRefresh,
  onToggleAutoRefresh,
  stats,
}) => {
  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-gray-900">API Key Manager</h2>
        <div className="flex items-center space-x-2">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 flex items-center space-x-1"
            title="Refresh API keys"
          >
            {loading ? <LoadingSpinner size="sm" /> : <span>🔄</span>}
            <span className="text-sm">Refresh</span>
          </button>

          <button
            onClick={onToggleAutoRefresh}
            className={`px-3 py-2 rounded-lg transition-colors text-sm ${
              autoRefreshActive
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title={autoRefreshActive ? 'Stop auto-refresh' : 'Start auto-refresh (30s)'}
          >
            {autoRefreshActive ? '⏸️ Auto' : '▶️ Auto'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-[var(--ea-primary)]/5 p-4 rounded-lg">
          <div className="text-2xl font-bold text-[var(--ea-primary)]">{stats.total}</div>
          <div className="text-sm text-[var(--ea-primary)]">Total Keys</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          <div className="text-sm text-green-800">Active</div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-red-600">{stats.inactive}</div>
          <div className="text-sm text-red-800">Inactive</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-purple-600">
            {stats.totalUsage.toLocaleString()}
          </div>
          <div className="text-sm text-purple-800">Total Usage</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-yellow-600">{stats.recentlyUsed}</div>
          <div className="text-sm text-yellow-800">Used This Week</div>
        </div>
      </div>
    </>
  );
};

export default HeaderStats;
