/**
 * AnalyticsTab — FHIR compliance overview, aggregate sync stats, per-connection performance
 */

import React from 'react';
import type { FHIRConnection } from '../../../services/fhirInteroperabilityIntegrator';
import type { SyncStats, ComplianceMetrics } from '../../../hooks/useFHIRIntegration';

interface AnalyticsTabProps {
  connections: FHIRConnection[];
  syncStats: Record<string, SyncStats | null>;
  complianceMetrics: ComplianceMetrics | null;
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({
  connections,
  syncStats,
  complianceMetrics,
}) => {
  const statsValues = Object.values(syncStats).filter((s): s is SyncStats => s !== null);
  const totalSyncs = statsValues.reduce((sum: number, stats: SyncStats) => sum + (stats.totalSyncs || 0), 0);
  const avgSuccessRate = statsValues.length > 0
    ? statsValues.reduce((sum: number, stats: SyncStats) => {
        const rate = stats.totalSyncs > 0 ? (stats.successfulSyncs / stats.totalSyncs) * 100 : 0;
        return sum + rate;
      }, 0) / statsValues.length
    : 0;
  const totalRecordsProcessed = statsValues.reduce((sum: number, stats: SyncStats) => sum + (stats.recordsSynced || 0), 0);

  return (
    <div className="space-y-6" aria-label="FHIR Analytics">
      {/* Compliance Overview */}
      <div className="bg-white rounded-lg shadow-xs p-6 border border-gray-200">
        <h2 className="text-xl font-bold mb-4">FHIR Compliance Overview</h2>
        {complianceMetrics && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-gray-600 text-sm">Overall Score</p>
              <p className="text-2xl font-bold text-purple-600">{complianceMetrics.overallScore}%</p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Data Integrity</p>
              <p className="text-2xl font-bold text-blue-600">{complianceMetrics.dataIntegrity}%</p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Sync Reliability</p>
              <p className="text-2xl font-bold text-green-600">{complianceMetrics.syncReliability}%</p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Error Rate</p>
              <p className="text-2xl font-bold text-red-600">{complianceMetrics.errorRate}%</p>
            </div>
            <div className="col-span-2">
              <p className="text-gray-600 text-sm">Last Assessed</p>
              <p className="text-lg font-medium">{complianceMetrics.lastAssessedAt ? new Date(complianceMetrics.lastAssessedAt).toLocaleString() : 'Never'}</p>
            </div>
          </div>
        )}
      </div>

      {/* Aggregate Sync Statistics */}
      <div className="bg-white rounded-lg shadow-xs p-6 border border-gray-200">
        <h2 className="text-xl font-bold mb-4">Aggregate Sync Statistics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-gray-600 text-sm">Total Connections</p>
            <p className="text-2xl font-bold">{connections.length}</p>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-gray-600 text-sm">Total Syncs (30d)</p>
            <p className="text-2xl font-bold text-blue-600">{totalSyncs}</p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="text-gray-600 text-sm">Avg Success Rate</p>
            <p className="text-2xl font-bold text-green-600">{avgSuccessRate.toFixed(1)}%</p>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg">
            <p className="text-gray-600 text-sm">Records Processed</p>
            <p className="text-2xl font-bold text-purple-600">{totalRecordsProcessed.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Per-Connection Stats */}
      <div className="bg-white rounded-lg shadow-xs p-6 border border-gray-200">
        <h2 className="text-xl font-bold mb-4">Connection Performance</h2>
        <div className="overflow-x-auto">
          <table className="w-full" aria-label="Connection performance statistics">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Connection</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Syncs</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Success Rate</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Records</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Sync</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {connections.map(conn => {
                const stats = syncStats[conn.id];
                const successRate = stats && stats.totalSyncs > 0
                  ? (stats.successfulSyncs / stats.totalSyncs) * 100
                  : 0;
                return (
                  <tr key={conn.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{conn.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        conn.status === 'active' ? 'bg-green-100 text-green-800' :
                        conn.status === 'error' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {conn.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">{stats?.totalSyncs || 0}</td>
                    <td className="px-4 py-3">
                      <span className={successRate >= 90 ? 'text-green-600' : successRate >= 70 ? 'text-yellow-600' : 'text-red-600'}>
                        {successRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3">{stats?.recordsSynced?.toLocaleString() || 0}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {conn.lastSync ? new Date(conn.lastSync).toLocaleDateString() : 'Never'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
