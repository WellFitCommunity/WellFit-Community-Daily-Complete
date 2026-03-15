/**
 * OverviewTab — Connection stats, compliance metrics, and quick actions
 */

import React from 'react';
import { Database, RefreshCw, Settings, Check, AlertCircle, Zap } from 'lucide-react';
import type { FHIRConnection } from '../../../services/fhirInteroperabilityIntegrator';
import type { ComplianceMetrics } from '../../../hooks/useFHIRIntegration';

interface OverviewTabProps {
  connections: FHIRConnection[];
  complianceMetrics: ComplianceMetrics | null;
  loading: boolean;
  onSyncAllActive?: () => void;
  syncingAll?: boolean;
  syncAllResult?: { success: number; errors: number } | null;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  connections,
  complianceMetrics,
  loading,
  onSyncAllActive,
  syncingAll,
  syncAllResult,
}) => {
  if (loading) return <div className="text-center py-12">Loading...</div>;

  const activeConnections = connections.filter(c => c.status === 'active').length;
  const recentSyncs = connections.filter(c => c.lastSync).length;
  const errorConnections = connections.filter(c => c.status === 'error').length;

  return (
    <div className="space-y-6">
      {/* Connection Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-xs p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Active Connections</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{activeConnections}</p>
            </div>
            <Database className="w-12 h-12 text-[var(--ea-primary)] opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-xs p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Recent Syncs</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{recentSyncs}</p>
              <p className="text-xs text-gray-500 mt-1">Connections with sync history</p>
            </div>
            <RefreshCw className="w-12 h-12 text-green-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-xs p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Data Integrity</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{complianceMetrics?.dataIntegrity || 0}%</p>
            </div>
            <Settings className="w-12 h-12 text-purple-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-xs p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Compliance Score</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{complianceMetrics?.overallScore || 0}%</p>
            </div>
            <Zap className="w-12 h-12 text-yellow-600 opacity-20" />
          </div>
        </div>
      </div>

      {/* Connection Health */}
      {errorConnections > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">Connection Issues</h3>
            <p className="text-red-700">{errorConnections} connection(s) have errors that need attention.</p>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-xs p-6 border border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={onSyncAllActive}
            disabled={syncingAll || activeConnections === 0}
            className="px-4 py-2 bg-[var(--ea-primary)]/10 text-[var(--ea-primary)] rounded-lg hover:bg-[var(--ea-primary)]/20 transition flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncingAll ? 'animate-spin' : ''}`} />
            {syncingAll ? 'Syncing...' : 'Sync All Active'}
          </button>
          <button className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition flex items-center gap-2">
            <Check className="w-4 h-4" />
            Test All Connections
          </button>
        </div>
        {syncAllResult && (
          <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm">
            <span className="text-green-700 font-medium">{syncAllResult.success} synced</span>
            {syncAllResult.errors > 0 && (
              <span className="text-red-700 font-medium ml-3">{syncAllResult.errors} failed</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
