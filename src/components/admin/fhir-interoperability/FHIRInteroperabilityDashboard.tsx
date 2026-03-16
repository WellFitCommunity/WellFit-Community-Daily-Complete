/**
 * FHIR Interoperability Dashboard — Main Shell
 *
 * Admin interface for managing FHIR connections, synchronization, and patient mappings.
 * Decomposed from original 821-line god file into focused sub-components.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Activity, Database, RefreshCw, Plus, Settings, AlertCircle, Zap, FileText } from 'lucide-react';
import {
  useFHIRIntegration,
  SyncHistoryEntry,
  SyncStats,
  PatientMapping,
  ComplianceMetrics,
} from '../../../hooks/useFHIRIntegration';
import { FHIRConnection } from '../../../services/fhirInteroperabilityIntegrator';
import { auditLogger } from '../../../services/auditLogger';
import type { TabId } from './types';
import { OverviewTab } from './OverviewTab';
import { ConnectionsTab } from './ConnectionsTab';
import { SyncTab } from './SyncTab';
import { MappingsTab } from './MappingsTab';
import { AnalyticsTab } from './AnalyticsTab';
import { CreateConnectionModal } from './CreateConnectionModal';
import { ResourcesTab } from './ResourcesTab';

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
    getComplianceMetrics,
  } = useFHIRIntegration();

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<FHIRConnection | null>(null);
  const [syncHistory, setSyncHistory] = useState<SyncHistoryEntry[]>([]);
  const [patientMappings, setPatientMappings] = useState<PatientMapping[]>([]);
  const [complianceMetrics, setComplianceMetrics] = useState<ComplianceMetrics | null>(null);
  const [syncStats, setSyncStats] = useState<Record<string, SyncStats | null>>({});
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncAllResult, setSyncAllResult] = useState<{ success: number; errors: number } | null>(null);

  useEffect(() => { loadConnections(); }, [loadConnections]);

  useEffect(() => {
    if (selectedConnection) {
      loadSyncHistory(selectedConnection.id);
      loadPatientMappings(selectedConnection.id);
      loadSyncStats(selectedConnection.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable load functions, reload on connection change
  }, [selectedConnection]);

  useEffect(() => {
    loadCompliance();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
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

  const handleSyncAllActive = useCallback(async () => {
    const activeConns = connections.filter(c => c.status === 'active');
    if (activeConns.length === 0) return;

    setSyncingAll(true);
    setSyncAllResult(null);
    let successCount = 0;
    let errorCount = 0;

    for (const conn of activeConns) {
      try {
        await syncBidirectional(conn.id);
        successCount++;
      } catch (err: unknown) {
        errorCount++;
        await auditLogger.error(
          'FHIR_BULK_SYNC_ERROR',
          err instanceof Error ? err : new Error(String(err)),
          { connectionId: conn.id }
        );
      }
    }

    setSyncingAll(false);
    setSyncAllResult({ success: successCount, errors: errorCount });
    await auditLogger.info('FHIR_BULK_SYNC_COMPLETE', {
      connectionsAttempted: activeConns.length,
      success: successCount,
      errors: errorCount,
    });
  }, [connections, syncBidirectional]);

  const tabs = [
    { id: 'overview' as TabId, label: 'Overview', icon: Activity },
    { id: 'connections' as TabId, label: 'Connections', icon: Database },
    { id: 'sync' as TabId, label: 'Sync Status', icon: RefreshCw },
    { id: 'mappings' as TabId, label: 'Patient Mappings', icon: Settings },
    { id: 'analytics' as TabId, label: 'Analytics', icon: Zap },
    { id: 'resources' as TabId, label: 'Resources', icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6" aria-label="FHIR Interoperability Hub">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="bg-white rounded-lg shadow-xs p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Database className="w-8 h-8 text-[var(--ea-primary)]" />
                FHIR Interoperability Hub
              </h1>
              <p className="text-gray-600 mt-2">
                Manage EHR connections, synchronize patient data, and monitor FHIR compliance
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--ea-primary)] text-white rounded-lg hover:bg-[var(--ea-primary-hover)] transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
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
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 font-medium transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ea-primary,#00857a)] ${
                    activeTab === tab.id
                      ? 'text-[var(--ea-primary)] border-b-2 border-[var(--ea-primary)]'
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
                className="bg-[var(--ea-primary)] h-2 rounded-full transition-all duration-300"
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
            onSyncAllActive={handleSyncAllActive}
            syncingAll={syncingAll}
            syncAllResult={syncAllResult}
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
            onToggleAutoSync={(freq) => freq === 'manual' ? stopAutoSync(selectedConnection.id) : startAutoSync(selectedConnection.id, freq)}
          />
        )}
        {activeTab === 'mappings' && selectedConnection && (
          <MappingsTab connection={selectedConnection} mappings={patientMappings} loading={loading} />
        )}
        {activeTab === 'analytics' && (
          <AnalyticsTab connections={connections} syncStats={syncStats} complianceMetrics={complianceMetrics} />
        )}
        {activeTab === 'resources' && (
          <ResourcesTab />
        )}
      </div>

      {showCreateModal && (
        <CreateConnectionModal
          onClose={() => setShowCreateModal(false)}
          onCreate={createConnection}
        />
      )}
    </div>
  );
};

export default FHIRInteroperabilityDashboard;
