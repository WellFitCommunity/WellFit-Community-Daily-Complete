/**
 * useFHIRIntegration Hook
 *
 * React hook for managing FHIR integrations in the UI
 * Provides state management and API interactions for FHIR operations
 */

import { useState, useEffect, useCallback } from 'react';
import fhirSyncAPI from '../api/fhirSync';
import { FHIRConnection, SyncResult } from '../services/fhirInteroperabilityIntegrator';

// ============================================================================
// TYPES
// ============================================================================

interface UseFHIRIntegrationReturn {
  // State
  connections: FHIRConnection[];
  loading: boolean;
  error: string | null;
  syncing: boolean;
  syncProgress: SyncProgress | null;

  // Connection operations
  loadConnections: () => Promise<void>;
  createConnection: (data: Omit<FHIRConnection, 'id' | 'createdAt' | 'updatedAt'>) => Promise<boolean>;
  testConnection: (connectionId: string) => Promise<{ success: boolean; message: string; metadata?: Record<string, unknown> }>;
  deleteConnection: (connectionId: string) => Promise<boolean>;
  updateConnectionStatus: (connectionId: string, status: FHIRConnection['status']) => Promise<boolean>;

  // Sync operations
  syncFromFHIR: (connectionId: string, userIds?: string[]) => Promise<SyncResult | null>;
  syncToFHIR: (connectionId: string, userIds: string[]) => Promise<SyncResult | null>;
  syncBidirectional: (connectionId: string, userIds?: string[]) => Promise<{ pullResult: SyncResult; pushResult: SyncResult } | null>;
  getSyncHistory: (connectionId: string, limit?: number) => Promise<SyncHistoryEntry[]>;
  getSyncStats: (connectionId: string, days?: number) => Promise<SyncStats | null>;

  // Patient mapping
  createPatientMapping: (communityUserId: string, fhirPatientId: string, connectionId: string) => Promise<boolean>;
  getPatientMapping: (communityUserId: string, connectionId: string) => Promise<PatientMapping | null>;
  getAllPatientMappings: (connectionId: string) => Promise<PatientMapping[]>;
  deletePatientMapping: (communityUserId: string, connectionId: string) => Promise<boolean>;

  // Auto-sync
  startAutoSync: (connectionId: string, frequency: FHIRConnection['syncFrequency']) => Promise<boolean>;
  stopAutoSync: (connectionId: string) => Promise<boolean>;

  // Analytics
  getComplianceMetrics: () => Promise<ComplianceMetrics | null>;
}

interface SyncProgress {
  connectionId: string;
  stage: 'preparing' | 'syncing' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  message: string;
  recordsProcessed?: number;
  recordsTotal?: number;
}

interface SyncHistoryEntry {
  id: string;
  connectionId: string;
  direction: 'pull' | 'push' | 'bidirectional';
  status: 'completed' | 'failed' | 'partial';
  recordsSynced: number;
  recordsFailed: number;
  startedAt: string;
  completedAt: string;
  errors?: string[];
}

interface SyncStats {
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  recordsSynced: number;
  lastSyncAt: string | null;
  averageDuration: number;
}

interface PatientMapping {
  communityUserId: string;
  fhirPatientId: string;
  connectionId: string;
  createdAt: string;
  updatedAt: string;
}

interface ComplianceMetrics {
  overallScore: number;
  dataIntegrity: number;
  syncReliability: number;
  errorRate: number;
  lastAssessedAt: string;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useFHIRIntegration(): UseFHIRIntegrationReturn {
  const [connections, setConnections] = useState<FHIRConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);

  // ========================================================================
  // CONNECTION OPERATIONS
  // ========================================================================

  const loadConnections = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fhirSyncAPI.getFHIRConnections();
      if (response.success && response.data) {
        setConnections(response.data);
      } else {
        setError(response.error || 'Failed to load connections');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const createConnection = useCallback(async (
    data: Omit<FHIRConnection, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fhirSyncAPI.createFHIRConnection(data);
      if (response.success) {
        await loadConnections();
        return true;
      } else {
        setError(response.error || 'Failed to create connection');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [loadConnections]);

  const testConnection = useCallback(async (connectionId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fhirSyncAPI.testFHIRConnection(connectionId);
      if (!response.success) {
        setError(response.error || 'Connection test failed');
      }
      return {
        success: response.success,
        message: response.message || '',
        metadata: response.data
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteConnection = useCallback(async (connectionId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fhirSyncAPI.deleteFHIRConnection(connectionId);
      if (response.success) {
        await loadConnections();
        return true;
      } else {
        setError(response.error || 'Failed to delete connection');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [loadConnections]);

  const updateConnectionStatus = useCallback(async (
    connectionId: string,
    status: FHIRConnection['status']
  ): Promise<boolean> => {
    try {
      const response = await fhirSyncAPI.updateFHIRConnectionStatus(connectionId, status);
      if (response.success) {
        await loadConnections();
        return true;
      } else {
        setError(response.error || 'Failed to update status');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [loadConnections]);

  // ========================================================================
  // SYNC OPERATIONS
  // ========================================================================

  const syncFromFHIR = useCallback(async (
    connectionId: string,
    userIds?: string[]
  ): Promise<SyncResult | null> => {
    setSyncing(true);
    setError(null);
    setSyncProgress({
      connectionId,
      stage: 'preparing',
      progress: 0,
      message: 'Preparing to sync from FHIR server...'
    });

    try {
      setSyncProgress({
        connectionId,
        stage: 'syncing',
        progress: 25,
        message: 'Fetching data from FHIR server...'
      });

      const response = await fhirSyncAPI.syncFromFHIR(connectionId, userIds);

      if (response.success && response.data) {
        setSyncProgress({
          connectionId,
          stage: 'processing',
          progress: 75,
          message: 'Processing FHIR data...',
          recordsProcessed: response.data.recordsProcessed
        });

        await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause for UX

        setSyncProgress({
          connectionId,
          stage: 'completed',
          progress: 100,
          message: `Sync completed: ${response.data.recordsSucceeded}/${response.data.recordsProcessed} records synced`,
          recordsProcessed: response.data.recordsProcessed,
          recordsTotal: response.data.recordsProcessed
        });

        await loadConnections();
        return response.data;
      } else {
        setSyncProgress({
          connectionId,
          stage: 'failed',
          progress: 0,
          message: response.error || 'Sync failed'
        });
        setError(response.error || 'Sync failed');
        return null;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setSyncProgress({
        connectionId,
        stage: 'failed',
        progress: 0,
        message
      });
      setError(message);
      return null;
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncProgress(null), 5000); // Clear progress after 5s
    }
  }, [loadConnections]);

  const syncToFHIR = useCallback(async (
    connectionId: string,
    userIds: string[]
  ): Promise<SyncResult | null> => {
    setSyncing(true);
    setError(null);
    setSyncProgress({
      connectionId,
      stage: 'preparing',
      progress: 0,
      message: 'Preparing to push to FHIR server...'
    });

    try {
      setSyncProgress({
        connectionId,
        stage: 'syncing',
        progress: 25,
        message: 'Pushing data to FHIR server...',
        recordsTotal: userIds.length
      });

      const response = await fhirSyncAPI.syncToFHIR(connectionId, userIds);

      if (response.success && response.data) {
        setSyncProgress({
          connectionId,
          stage: 'completed',
          progress: 100,
          message: `Push completed: ${response.data.recordsSucceeded}/${response.data.recordsProcessed} records pushed`,
          recordsProcessed: response.data.recordsProcessed,
          recordsTotal: response.data.recordsProcessed
        });

        await loadConnections();
        return response.data;
      } else {
        setSyncProgress({
          connectionId,
          stage: 'failed',
          progress: 0,
          message: response.error || 'Push failed'
        });
        setError(response.error || 'Push failed');
        return null;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setSyncProgress({
        connectionId,
        stage: 'failed',
        progress: 0,
        message
      });
      setError(message);
      return null;
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncProgress(null), 5000);
    }
  }, [loadConnections]);

  const syncBidirectional = useCallback(async (
    connectionId: string,
    userIds?: string[]
  ) => {
    setSyncing(true);
    setError(null);
    setSyncProgress({
      connectionId,
      stage: 'preparing',
      progress: 0,
      message: 'Starting bi-directional sync...'
    });

    try {
      const response = await fhirSyncAPI.syncBidirectional(connectionId, userIds);

      if (response.success && response.data) {
        setSyncProgress({
          connectionId,
          stage: 'completed',
          progress: 100,
          message: 'Bi-directional sync completed'
        });

        await loadConnections();
        return response.data;
      } else {
        setSyncProgress({
          connectionId,
          stage: 'failed',
          progress: 0,
          message: response.error || 'Bi-directional sync failed'
        });
        setError(response.error || 'Bi-directional sync failed');
        return null;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setSyncProgress({
        connectionId,
        stage: 'failed',
        progress: 0,
        message
      });
      setError(message);
      return null;
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncProgress(null), 5000);
    }
  }, [loadConnections]);

  const getSyncHistory = useCallback(async (
    connectionId: string,
    limit: number = 50
  ): Promise<any[]> => {
    try {
      const response = await fhirSyncAPI.getSyncHistory(connectionId, limit);
      if (response.success && response.data) {
        return response.data;
      } else {
        setError(response.error || 'Failed to fetch sync history');
        return [];
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return [];
    }
  }, []);

  const getSyncStats = useCallback(async (
    connectionId: string,
    days: number = 30
  ): Promise<any> => {
    try {
      const response = await fhirSyncAPI.getSyncStatistics(connectionId, days);
      if (response.success && response.data) {
        return response.data;
      } else {
        setError(response.error || 'Failed to fetch sync statistics');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, []);

  // ========================================================================
  // PATIENT MAPPING OPERATIONS
  // ========================================================================

  const createPatientMapping = useCallback(async (
    communityUserId: string,
    fhirPatientId: string,
    connectionId: string
  ): Promise<boolean> => {
    try {
      const response = await fhirSyncAPI.createPatientMapping(
        communityUserId,
        fhirPatientId,
        connectionId
      );
      return response.success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, []);

  const getPatientMapping = useCallback(async (
    communityUserId: string,
    connectionId: string
  ): Promise<any> => {
    try {
      const response = await fhirSyncAPI.getPatientMapping(communityUserId, connectionId);
      if (response.success) {
        return response.data;
      } else {
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, []);

  const getAllPatientMappings = useCallback(async (connectionId: string): Promise<any[]> => {
    try {
      const response = await fhirSyncAPI.getAllPatientMappings(connectionId);
      if (response.success && response.data) {
        return response.data;
      } else {
        setError(response.error || 'Failed to fetch patient mappings');
        return [];
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return [];
    }
  }, []);

  const deletePatientMapping = useCallback(async (
    communityUserId: string,
    connectionId: string
  ): Promise<boolean> => {
    try {
      const response = await fhirSyncAPI.deletePatientMapping(communityUserId, connectionId);
      return response.success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, []);

  // ========================================================================
  // AUTO-SYNC OPERATIONS
  // ========================================================================

  const startAutoSync = useCallback(async (
    connectionId: string,
    frequency: FHIRConnection['syncFrequency']
  ): Promise<boolean> => {
    try {
      const response = await fhirSyncAPI.startAutoSync(connectionId, frequency);
      if (response.success) {
        await loadConnections();
        return true;
      } else {
        setError(response.error || 'Failed to start auto-sync');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [loadConnections]);

  const stopAutoSync = useCallback(async (connectionId: string): Promise<boolean> => {
    try {
      const response = await fhirSyncAPI.stopAutoSync(connectionId);
      if (response.success) {
        await loadConnections();
        return true;
      } else {
        setError(response.error || 'Failed to stop auto-sync');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [loadConnections]);

  // ========================================================================
  // ANALYTICS
  // ========================================================================

  const getComplianceMetrics = useCallback(async (): Promise<any> => {
    try {
      const response = await fhirSyncAPI.getFHIRComplianceMetrics();
      if (response.success && response.data) {
        return response.data;
      } else {
        setError(response.error || 'Failed to fetch compliance metrics');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, []);

  // ========================================================================
  // EFFECTS
  // ========================================================================

  // Load connections on mount
  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  // ========================================================================
  // RETURN
  // ========================================================================

  return {
    // State
    connections,
    loading,
    error,
    syncing,
    syncProgress,

    // Connection operations
    loadConnections,
    createConnection,
    testConnection,
    deleteConnection,
    updateConnectionStatus,

    // Sync operations
    syncFromFHIR,
    syncToFHIR,
    syncBidirectional,
    getSyncHistory,
    getSyncStats,

    // Patient mapping
    createPatientMapping,
    getPatientMapping,
    getAllPatientMappings,
    deletePatientMapping,

    // Auto-sync
    startAutoSync,
    stopAutoSync,

    // Analytics
    getComplianceMetrics
  };
}

export default useFHIRIntegration;
