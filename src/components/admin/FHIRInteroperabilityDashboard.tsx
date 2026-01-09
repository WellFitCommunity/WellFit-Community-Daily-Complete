/**
 * FHIR Interoperability Dashboard
 *
 * Admin interface for managing FHIR connections, synchronization, and patient mappings
 */

import React, { useState, useEffect } from 'react';
import { Activity, Database, RefreshCw, Plus, Settings, Check, X, AlertCircle, Zap } from 'lucide-react';
import {
  useFHIRIntegration,
  SyncHistoryEntry,
  SyncStats,
  PatientMapping,
  ComplianceMetrics
} from '../../hooks/useFHIRIntegration';
import { FHIRConnection } from '../../services/fhirInteroperabilityIntegrator';

// Local type definitions
type TabId = 'overview' | 'connections' | 'sync' | 'mappings' | 'analytics';
type SyncFrequency = 'manual' | 'realtime' | 'hourly' | 'daily';
type EHRSystem = 'EPIC' | 'CERNER' | 'ALLSCRIPTS' | 'CUSTOM';

export const FHIRInteroperabilityDashboard: React.FC = () => {
  const {
    connections,
    loading,
    error,
    syncing,
    syncProgress,
    loadConnections,
    createConnection,
    testConnection,
    deleteConnection,
    syncFromFHIR,
    syncToFHIR,
    syncBidirectional,
    getSyncHistory,
    getSyncStats,
    getAllPatientMappings,
    startAutoSync,
    stopAutoSync,
    getComplianceMetrics
  } = useFHIRIntegration();

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<FHIRConnection | null>(null);
  const [syncHistory, setSyncHistory] = useState<SyncHistoryEntry[]>([]);
  const [patientMappings, setPatientMappings] = useState<PatientMapping[]>([]);
  const [complianceMetrics, setComplianceMetrics] = useState<ComplianceMetrics | null>(null);
  const [syncStats, setSyncStats] = useState<Record<string, SyncStats | null>>({});

  // Load connections on mount
  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  // Load additional data when connection is selected
  useEffect(() => {
    if (selectedConnection) {
      loadSyncHistory(selectedConnection.id);
      loadPatientMappings(selectedConnection.id);
      loadSyncStats(selectedConnection.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Load functions are stable, only reload when connection changes
  }, [selectedConnection]);

  useEffect(() => {
    loadCompliance();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Load on mount only
  }, []);

  const loadSyncHistory = async (connectionId: string) => {
    const history = await getSyncHistory(connectionId, 20);
    setSyncHistory(history);
  };

  const loadPatientMappings = async (connectionId: string) => {
    const mappings = await getAllPatientMappings(connectionId);
    setPatientMappings(mappings);
  };

  const loadSyncStats = async (connectionId: string) => {
    const stats = await getSyncStats(connectionId, 30);
    setSyncStats(prev => ({ ...prev, [connectionId]: stats }));
  };

  const loadCompliance = async () => {
    const metrics = await getComplianceMetrics();
    setComplianceMetrics(metrics);
  };

  const handleTestConnection = async (connectionId: string) => {
    const result = await testConnection(connectionId);
    alert(result.message);
  };

  const handleSync = async (connectionId: string, direction: 'pull' | 'push' | 'bidirectional') => {
    if (direction === 'pull') {
      await syncFromFHIR(connectionId);
    } else if (direction === 'push') {
      const userIds = patientMappings.map(m => m.communityUserId);
      await syncToFHIR(connectionId, userIds);
    } else {
      await syncBidirectional(connectionId);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="bg-white rounded-lg shadow-xs p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Database className="w-8 h-8 text-blue-600" />
                FHIR Interoperability Hub
              </h1>
              <p className="text-gray-600 mt-2">
                Manage EHR connections, synchronize patient data, and monitor FHIR compliance
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Plus className="w-5 h-5" />
              New Connection
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="bg-white rounded-lg shadow-xs border border-gray-200">
          <div className="flex border-b border-gray-200">
            {([
              { id: 'overview' as TabId, label: 'Overview', icon: Activity },
              { id: 'connections' as TabId, label: 'Connections', icon: Database },
              { id: 'sync' as TabId, label: 'Sync Status', icon: RefreshCw },
              { id: 'mappings' as TabId, label: 'Patient Mappings', icon: Settings },
              { id: 'analytics' as TabId, label: 'Analytics', icon: Zap }
            ]).map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 font-medium transition ${
                    activeTab === tab.id
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="max-w-7xl mx-auto mb-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900">Error</h3>
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Sync Progress */}
      {syncProgress && (
        <div className="max-w-7xl mx-auto mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-blue-900">{syncProgress.message}</span>
              <span className="text-blue-700">{syncProgress.progress}%</span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${syncProgress.progress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-7xl mx-auto">
        {activeTab === 'overview' && (
          <OverviewTab
            connections={connections}
            complianceMetrics={complianceMetrics}
            loading={loading}
          />
        )}

        {activeTab === 'connections' && (
          <ConnectionsTab
            connections={connections}
            loading={loading}
            onTest={handleTestConnection}
            onDelete={deleteConnection}
            onSelect={setSelectedConnection}
          />
        )}

        {activeTab === 'sync' && selectedConnection && (
          <SyncTab
            connection={selectedConnection}
            syncHistory={syncHistory}
            syncStats={syncStats[selectedConnection.id]}
            syncing={syncing}
            onSync={handleSync}
            onToggleAutoSync={(freq: 'manual' | 'realtime' | 'hourly' | 'daily') => freq === 'manual' ? stopAutoSync(selectedConnection.id) : startAutoSync(selectedConnection.id, freq)}
          />
        )}

        {activeTab === 'mappings' && selectedConnection && (
          <MappingsTab
            connection={selectedConnection}
            mappings={patientMappings}
            loading={loading}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsTab
            connections={connections}
            syncStats={syncStats}
            complianceMetrics={complianceMetrics}
          />
        )}
      </div>

      {/* Create Connection Modal */}
      {showCreateModal && (
        <CreateConnectionModal
          onClose={() => setShowCreateModal(false)}
          onCreate={createConnection}
        />
      )}
    </div>
  );
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const OverviewTab: React.FC<{
  connections: FHIRConnection[];
  complianceMetrics: ComplianceMetrics | null;
  loading: boolean;
}> = ({ connections, complianceMetrics, loading }) => {
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
            <Database className="w-12 h-12 text-blue-600 opacity-20" />
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
          <button className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Sync All Active
          </button>
          <button className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition flex items-center gap-2">
            <Check className="w-4 h-4" />
            Test All Connections
          </button>
        </div>
      </div>
    </div>
  );
};

const ConnectionsTab: React.FC<{
  connections: FHIRConnection[];
  loading: boolean;
  onTest: (id: string) => void;
  onDelete: (id: string) => void;
  onSelect: (conn: FHIRConnection) => void;
}> = ({ connections, loading, onTest, onDelete, onSelect }) => {
  if (loading) return <div className="text-center py-12">Loading...</div>;

  return (
    <div className="bg-white rounded-lg shadow-xs border border-gray-200">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">EHR System</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sync Frequency</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Sync</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {connections.map(conn => (
              <tr key={conn.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{conn.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{conn.ehrSystem}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                    conn.status === 'active' ? 'bg-green-100 text-green-800' :
                    conn.status === 'error' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {conn.status === 'active' && <Check className="w-3 h-3" />}
                    {conn.status === 'error' && <X className="w-3 h-3" />}
                    {conn.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{conn.syncFrequency}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {conn.lastSync ? new Date(conn.lastSync).toLocaleString() : 'Never'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                  <button
                    onClick={() => onTest(conn.id)}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    Test
                  </button>
                  <button
                    onClick={() => onSelect(conn)}
                    className="text-green-600 hover:text-green-900"
                  >
                    Manage
                  </button>
                  <button
                    onClick={() => onDelete(conn.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const SyncTab: React.FC<{
  connection: FHIRConnection;
  syncHistory: SyncHistoryEntry[];
  syncStats: SyncStats | null | undefined;
  syncing: boolean;
  onSync: (connectionId: string, direction: 'pull' | 'push' | 'bidirectional') => void;
  onToggleAutoSync: (frequency: SyncFrequency) => void;
}> = ({ connection, syncHistory, syncStats, syncing, onSync, onToggleAutoSync }) => {
  const [autoSyncFrequency, setAutoSyncFrequency] = useState<SyncFrequency>(
    connection.syncFrequency || 'manual'
  );

  const handleAutoSyncChange = (frequency: SyncFrequency) => {
    setAutoSyncFrequency(frequency);
    onToggleAutoSync(frequency);
  };

  return (
    <div className="space-y-6">
      {/* Auto-Sync Configuration */}
      <div className="bg-white rounded-lg shadow-xs p-6 border border-gray-200">
        <h2 className="text-xl font-bold mb-4">Auto-Sync Configuration</h2>
        <p className="text-gray-600 mb-4">Configure automatic synchronization frequency for this connection.</p>
        <div className="flex flex-wrap gap-3">
          {([
            { value: 'manual' as SyncFrequency, label: 'Manual Only', description: 'Sync only when triggered manually' },
            { value: 'realtime' as SyncFrequency, label: 'Real-time', description: 'Sync immediately on changes' },
            { value: 'hourly' as SyncFrequency, label: 'Hourly', description: 'Sync every hour' },
            { value: 'daily' as SyncFrequency, label: 'Daily', description: 'Sync once per day' }
          ]).map(option => (
            <button
              key={option.value}
              onClick={() => handleAutoSyncChange(option.value)}
              className={`px-4 py-3 rounded-lg border-2 transition text-left ${
                autoSyncFrequency === option.value
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
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
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            Pull from FHIR
          </button>
          <button
            onClick={() => onSync(connection.id, 'push')}
            disabled={syncing}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            Push to FHIR
          </button>
          <button
            onClick={() => onSync(connection.id, 'bidirectional')}
            disabled={syncing}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
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

const MappingsTab: React.FC<{
  connection: FHIRConnection;
  mappings: PatientMapping[];
  loading: boolean;
}> = ({ connection, mappings, loading }) => {
  if (loading) return <div className="text-center py-12">Loading...</div>;

  return (
    <div className="bg-white rounded-lg shadow-xs border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-bold">Patient Mappings for {connection.name}</h2>
        <p className="text-gray-600 mt-1">{mappings.length} patients mapped</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Community User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">FHIR Patient ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Synced</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {mappings.map((mapping: PatientMapping) => (
              <tr key={mapping.communityUserId} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {mapping.communityUserId}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">
                  {mapping.fhirPatientId}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                    mapped
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {mapping.updatedAt ? new Date(mapping.updatedAt).toLocaleString() : 'Never'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const AnalyticsTab: React.FC<{
  connections: FHIRConnection[];
  syncStats: Record<string, SyncStats | null>;
  complianceMetrics: ComplianceMetrics | null;
}> = ({ connections, syncStats, complianceMetrics }) => {
  // Calculate aggregate stats across all connections
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
    <div className="space-y-6">
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
          <table className="w-full">
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

const CreateConnectionModal: React.FC<{
  onClose: () => void;
  onCreate: (data: Omit<FHIRConnection, 'id' | 'createdAt' | 'updatedAt'>) => Promise<boolean>;
}> = ({ onClose, onCreate }) => {
  const [formData, setFormData] = useState({
    name: '',
    fhirServerUrl: '',
    ehrSystem: 'EPIC' as EHRSystem,
    clientId: '',
    syncFrequency: 'manual' as FHIRConnection['syncFrequency'],
    syncDirection: 'pull' as FHIRConnection['syncDirection'],
    status: 'inactive' as FHIRConnection['status']
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await onCreate(formData);
    if (success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold mb-4">Create FHIR Connection</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Connection Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">FHIR Server URL</label>
            <input
              type="url"
              value={formData.fhirServerUrl}
              onChange={e => setFormData({ ...formData, fhirServerUrl: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">EHR System</label>
            <select
              value={formData.ehrSystem}
              onChange={e => setFormData({ ...formData, ehrSystem: e.target.value as EHRSystem })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="EPIC">Epic</option>
              <option value="CERNER">Cerner</option>
              <option value="ALLSCRIPTS">Allscripts</option>
              <option value="CUSTOM">Custom</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
            <input
              type="text"
              value={formData.clientId}
              onChange={e => setFormData({ ...formData, clientId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              required
            />
          </div>
          <div className="flex gap-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FHIRInteroperabilityDashboard;
