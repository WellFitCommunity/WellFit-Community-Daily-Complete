/**
 * Cache & Connection Monitoring Dashboard
 * =================================================================================================
 * Enterprise-grade monitoring for caching and connection pool health
 * =================================================================================================
 */

import React, { useState, useEffect } from 'react';
import { cacheService, CacheStatistics, ConnectionMetrics } from '../../services/caching/CacheService';
import { supabase } from '../../lib/supabaseClient';
import useRealtimeSubscription from '../../hooks/useRealtimeSubscription';

interface SubscriptionHealth {
  component_name: string;
  total_subscriptions: number;
  active_subscriptions: number;
  stale_subscriptions: number;
  avg_age_seconds: number;
}

export const CacheMonitoringDashboard: React.FC = () => {
  const [cacheStats, setCacheStats] = useState<CacheStatistics[]>([]);
  const [connectionMetrics, setConnectionMetrics] = useState<ConnectionMetrics | null>(null);
  const [memoryCacheStats, setMemoryCacheStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Subscribe to subscription health updates
  const { data: subscriptionHealth } = useRealtimeSubscription<SubscriptionHealth>({
    table: 'realtime_subscription_registry',
    event: '*',
    componentName: 'CacheMonitoringDashboard',
    initialFetch: async () => {
      const { data, error } = await supabase
        .from('v_subscription_health_dashboard')
        .select('*');

      if (error) throw error;
      return data || [];
    }
  });

  useEffect(() => {
    loadMetrics();

    // Refresh metrics every 30 seconds
    const interval = setInterval(loadMetrics, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadMetrics = async () => {
    setLoading(true);

    try {
      // Load cache statistics
      const stats = await cacheService.getStatistics();
      setCacheStats(stats);

      // Load connection metrics
      const connMetrics = await cacheService.getConnectionMetrics();
      setConnectionMetrics(connMetrics);

      // Load memory cache stats
      const memStats = cacheService.getMemoryCacheStats();
      setMemoryCacheStats(memStats);
    } catch (error) {
      // Error handled silently - non-critical monitoring failure
    } finally {
      setLoading(false);
    }
  };

  if (loading && !cacheStats.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Cache & Connection Monitoring</h1>
        <p className="text-gray-600 mt-2">Enterprise-grade performance monitoring</p>
      </div>

      {/* Connection Pool Health */}
      {connectionMetrics && (
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Connection Pool Health</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              label="Avg Total Connections"
              value={Math.round(connectionMetrics.avgTotalConnections)}
              color="blue"
            />
            <MetricCard
              label="Peak Total Connections"
              value={connectionMetrics.peakTotalConnections}
              color="orange"
            />
            <MetricCard
              label="Avg Utilization"
              value={`${Math.round(connectionMetrics.avgUtilizationPercent)}%`}
              color={connectionMetrics.avgUtilizationPercent > 80 ? 'red' : 'green'}
            />
            <MetricCard
              label="Peak Utilization"
              value={`${Math.round(connectionMetrics.peakUtilizationPercent)}%`}
              color={connectionMetrics.peakUtilizationPercent > 90 ? 'red' : 'orange'}
            />
          </div>

          {connectionMetrics.peakUtilizationPercent > 80 && (
            <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-400 rounded-sm">
              <p className="text-sm text-red-800">
                ⚠️ <strong>Warning:</strong> Connection pool utilization is high. Consider increasing
                max_connections or optimizing queries.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Memory Cache Stats */}
      {memoryCacheStats && (
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Memory Cache (L1)</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <MetricCard
              label="Current Size"
              value={memoryCacheStats.size}
              color="blue"
            />
            <MetricCard
              label="Max Size"
              value={memoryCacheStats.maxSize}
              color="gray"
            />
            <MetricCard
              label="Utilization"
              value={`${Math.round(memoryCacheStats.utilizationPercent)}%`}
              color={memoryCacheStats.utilizationPercent > 90 ? 'orange' : 'green'}
            />
          </div>
        </div>
      )}

      {/* Cache Statistics by Namespace */}
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Cache Statistics (L2 - PostgreSQL)</h2>

        {cacheStats.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No cache data available</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Namespace
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Entries
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Hits
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg Hits/Entry
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Size (MB)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Recently Used
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {cacheStats.map((stat, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {stat.namespace}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {stat.totalEntries}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {stat.totalHits.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {Math.round(stat.avgHitsPerEntry * 10) / 10}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {Math.round(stat.totalSizeMb * 100) / 100}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {stat.recentlyUsed}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Subscription Health */}
      {subscriptionHealth && subscriptionHealth.length > 0 && (
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Real-time Subscription Health</h2>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Component
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Active
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stale
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg Age (min)
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {subscriptionHealth.map((health, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {health.component_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {health.total_subscriptions}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                      {health.active_subscriptions}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {health.stale_subscriptions > 0 ? (
                        <span className="text-red-600 font-medium">{health.stale_subscriptions}</span>
                      ) : (
                        <span className="text-gray-500">0</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {Math.round(health.avg_age_seconds / 60)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {subscriptionHealth.some(h => h.stale_subscriptions > 0) && (
            <div className="mt-4 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-sm">
              <p className="text-sm text-yellow-800">
                ⚠️ <strong>Notice:</strong> Some subscriptions are stale (no heartbeat in 5+ minutes).
                These will be automatically cleaned up.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Refresh Button */}
      <div className="flex justify-end">
        <button
          onClick={loadMetrics}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Refresh Metrics
        </button>
      </div>
    </div>
  );
};

// Helper component for metric cards
const MetricCard: React.FC<{
  label: string;
  value: string | number;
  color: 'blue' | 'green' | 'orange' | 'red' | 'gray';
}> = ({ label, value, color }) => {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    green: 'bg-green-50 border-green-200 text-green-900',
    orange: 'bg-orange-50 border-orange-200 text-orange-900',
    red: 'bg-red-50 border-red-200 text-red-900',
    gray: 'bg-gray-50 border-gray-200 text-gray-900',
  };

  return (
    <div className={`p-4 rounded-lg border-2 ${colorClasses[color]}`}>
      <div className="text-xs font-medium opacity-75 uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
};

export default CacheMonitoringDashboard;
