/**
 * SyncTab — Manual sync controls, auto-sync configuration, sync stats and history
 */

import React, { useState } from 'react';
import { RefreshCw, Check } from 'lucide-react';
import type { FHIRConnection } from '../../../services/fhirInteroperabilityIntegrator';
import type { SyncHistoryEntry, SyncStats } from '../../../hooks/useFHIRIntegration';
import type { SyncFrequency } from './types';

interface SyncTabProps {
  connection: FHIRConnection;
  syncHistory: SyncHistoryEntry[];
  syncStats: SyncStats | null | undefined;
  syncing: boolean;
  onSync: (connectionId: string, direction: 'pull' | 'push' | 'bidirectional') => void;
  onToggleAutoSync: (frequency: SyncFrequency) => void;
}

export const SyncTab: React.FC<SyncTabProps> = ({
  connection,
  syncHistory,
  syncStats,
  syncing,
  onSync,
  onToggleAutoSync,
}) => {
  const [autoSyncFrequency, setAutoSyncFrequency] = useState<SyncFrequency>(
    connection.syncFrequency || 'manual'
  );

  const handleAutoSyncChange = (frequency: SyncFrequency) => {
    setAutoSyncFrequency(frequency);
    onToggleAutoSync(frequency);
  };

  return (
    <div className="space-y-6" aria-label="FHIR Sync Status">
      {/* Auto-Sync Configuration */}
      <div className="bg-white rounded-lg shadow-xs p-6 border border-gray-200">
        <h2 className="text-xl font-bold mb-4">Auto-Sync Configuration</h2>
        <p className="text-gray-600 mb-4">Configure automatic synchronization frequency for this connection.</p>
        <div className="flex flex-wrap gap-3">
          {([
            { value: 'manual' as SyncFrequency, label: 'Manual Only', description: 'Sync only when triggered manually' },
            { value: 'realtime' as SyncFrequency, label: 'Real-time', description: 'Sync immediately on changes' },
            { value: 'hourly' as SyncFrequency, label: 'Hourly', description: 'Sync every hour' },
            { value: 'daily' as SyncFrequency, label: 'Daily', description: 'Sync once per day' },
          ]).map(option => (
            <button
              key={option.value}
              onClick={() => handleAutoSyncChange(option.value)}
              className={`px-4 py-3 rounded-lg border-2 transition text-left focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ea-primary,#00857a)] ${
                autoSyncFrequency === option.value
                  ? 'border-[var(--ea-primary)] bg-[var(--ea-primary)]/10 text-[var(--ea-primary)]'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-medium">{option.label}</div>
              <div className="text-xs text-gray-500 mt-1">{option.description}</div>
            </button>
          ))}
        </div>
        {autoSyncFrequency !== 'manual' && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
            <Check className="w-5 h-5 text-green-600" />
            <span className="text-green-700">Auto-sync enabled: {autoSyncFrequency}</span>
          </div>
        )}
      </div>

      {/* Manual Sync Controls */}
      <div className="bg-white rounded-lg shadow-xs p-6 border border-gray-200">
        <h2 className="text-xl font-bold mb-4">Manual Sync Controls</h2>
        <div className="flex gap-4">
          <button
            onClick={() => onSync(connection.id, 'pull')}
            disabled={syncing}
            className="px-4 py-2 bg-[var(--ea-primary)] text-white rounded-lg hover:bg-[var(--ea-primary-hover)] disabled:opacity-50 flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            Pull from FHIR
          </button>
          <button
            onClick={() => onSync(connection.id, 'push')}
            disabled={syncing}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            Push to FHIR
          </button>
          <button
            onClick={() => onSync(connection.id, 'bidirectional')}
            disabled={syncing}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            Bi-directional Sync
          </button>
        </div>
      </div>

      {/* Sync Stats */}
      {syncStats && (
        <div className="bg-white rounded-lg shadow-xs p-6 border border-gray-200">
          <h2 className="text-xl font-bold mb-4">Sync Statistics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-gray-600 text-sm">Total Syncs</p>
              <p className="text-2xl font-bold">{syncStats.totalSyncs}</p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Success Rate</p>
              <p className="text-2xl font-bold text-green-600">
                {syncStats.totalSyncs > 0
                  ? ((syncStats.successfulSyncs / syncStats.totalSyncs) * 100).toFixed(1)
                  : 0}%
              </p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Records Synced</p>
              <p className="text-2xl font-bold">{syncStats.recordsSynced}</p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Avg Duration</p>
              <p className="text-2xl font-bold text-blue-600">{syncStats.averageDuration.toFixed(1)}s</p>
            </div>
          </div>
        </div>
      )}

      {/* Sync History */}
      <div className="bg-white rounded-lg shadow-xs p-6 border border-gray-200">
        <h2 className="text-xl font-bold mb-4">Recent Sync History</h2>
        <div className="space-y-2">
          {syncHistory.map((log: SyncHistoryEntry) => (
            <div key={log.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-sm">
              <div>
                <p className="font-medium">{log.direction}</p>
                <p className="text-sm text-gray-600">
                  {log.recordsSynced}/{log.recordsSynced + log.recordsFailed} records - {new Date(log.startedAt).toLocaleString()}
                </p>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                log.status === 'completed' ? 'bg-green-100 text-green-800' :
                log.status === 'failed' ? 'bg-red-100 text-red-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {log.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
