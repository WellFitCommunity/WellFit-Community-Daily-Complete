/**
 * FHIR Sync API
 *
 * RESTful API endpoints for FHIR interoperability operations
 * Handles connection management, synchronization, and patient mapping
 */

import { supabase } from '../lib/supabaseClient';
import { fhirIntegrator, FHIRConnection, SyncResult } from '../services/fhirInteroperabilityIntegrator';

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ============================================================================
// CONNECTION MANAGEMENT API
// ============================================================================

/**
 * Get all FHIR connections for the organization
 */
export async function getFHIRConnections(): Promise<ApiResponse<FHIRConnection[]>> {
  try {
    const connections = await fhirIntegrator.getConnections();
    return {
      success: true,
      data: connections
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch connections'
    };
  }
}

/**
 * Create a new FHIR connection
 */
export async function createFHIRConnection(
  connectionData: Omit<FHIRConnection, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ApiResponse<FHIRConnection>> {
  try {
    const connection = await fhirIntegrator.createConnection(connectionData);
    return {
      success: true,
      data: connection,
      message: 'FHIR connection created successfully'
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create connection'
    };
  }
}

/**
 * Test a FHIR connection
 */
export async function testFHIRConnection(connectionId: string): Promise<ApiResponse> {
  try {
    const result = await fhirIntegrator.testConnection(connectionId);
    return {
      success: result.success,
      data: result.metadata,
      message: result.message
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection test failed'
    };
  }
}

/**
 * Update FHIR connection status
 */
export async function updateFHIRConnectionStatus(
  connectionId: string,
  status: FHIRConnection['status']
): Promise<ApiResponse> {
  try {
    await fhirIntegrator.updateConnectionStatus(connectionId, status);
    return {
      success: true,
      message: 'Connection status updated'
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update status'
    };
  }
}

/**
 * Delete a FHIR connection
 */
export async function deleteFHIRConnection(connectionId: string): Promise<ApiResponse> {
  try {
    // Stop auto-sync first
    fhirIntegrator.stopAutoSync(connectionId);

    // Delete patient mappings
    await supabase
      .from('fhir_patient_mappings')
      .delete()
      .eq('connection_id', connectionId);

    // Delete connection
    const { error } = await supabase
      .from('fhir_connections')
      .delete()
      .eq('id', connectionId);

    if (error) throw error;

    return {
      success: true,
      message: 'Connection deleted successfully'
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete connection'
    };
  }
}

// ============================================================================
// SYNCHRONIZATION API
// ============================================================================

/**
 * Pull data from FHIR server to Community database
 */
export async function syncFromFHIR(
  connectionId: string,
  userIds?: string[]
): Promise<ApiResponse<SyncResult>> {
  try {
    const result = await fhirIntegrator.syncFromFHIR(connectionId, userIds);
    return {
      success: result.status !== 'failed',
      data: result,
      message: `Sync completed: ${result.recordsSucceeded}/${result.recordsProcessed} records synced`
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Sync from FHIR failed'
    };
  }
}

/**
 * Push data from Community database to FHIR server
 */
export async function syncToFHIR(
  connectionId: string,
  userIds: string[]
): Promise<ApiResponse<SyncResult>> {
  try {
    const result = await fhirIntegrator.syncToFHIR(connectionId, userIds);
    return {
      success: result.status !== 'failed',
      data: result,
      message: `Push completed: ${result.recordsSucceeded}/${result.recordsProcessed} records pushed`
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Sync to FHIR failed'
    };
  }
}

/**
 * Bi-directional synchronization
 */
export async function syncBidirectional(
  connectionId: string,
  userIds?: string[]
): Promise<ApiResponse<{ pullResult: SyncResult; pushResult: SyncResult }>> {
  try {
    const results = await fhirIntegrator.syncBidirectional(connectionId, userIds);
    return {
      success: true,
      data: results,
      message: 'Bi-directional sync completed'
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Bi-directional sync failed'
    };
  }
}

/**
 * Get sync history for a connection
 */
export async function getSyncHistory(
  connectionId: string,
  limit: number = 50
): Promise<ApiResponse<any[]>> {
  try {
    const { data, error } = await supabase
      .from('fhir_sync_logs')
      .select('*')
      .eq('connection_id', connectionId)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return {
      success: true,
      data: data || []
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch sync history'
    };
  }
}

// ============================================================================
// PATIENT MAPPING API
// ============================================================================

/**
 * Create patient mapping between community user and FHIR patient
 */
export async function createPatientMapping(
  communityUserId: string,
  fhirPatientId: string,
  connectionId: string
): Promise<ApiResponse> {
  try {
    const mapping = await fhirIntegrator.createPatientMapping(
      communityUserId,
      fhirPatientId,
      connectionId
    );
    return {
      success: true,
      data: mapping,
      message: 'Patient mapping created successfully'
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create patient mapping'
    };
  }
}

/**
 * Get patient mapping
 */
export async function getPatientMapping(
  communityUserId: string,
  connectionId: string
): Promise<ApiResponse> {
  try {
    const mapping = await fhirIntegrator.getPatientMapping(communityUserId, connectionId);
    if (!mapping) {
      return {
        success: false,
        error: 'Patient mapping not found'
      };
    }
    return {
      success: true,
      data: mapping
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch patient mapping'
    };
  }
}

/**
 * Get all patient mappings for a connection
 */
export async function getAllPatientMappings(connectionId: string): Promise<ApiResponse> {
  try {
    const { data, error } = await supabase
      .from('fhir_patient_mappings')
      .select(`
        *,
        profiles:community_user_id (
          first_name,
          last_name,
          email
        )
      `)
      .eq('connection_id', connectionId);

    if (error) throw error;

    return {
      success: true,
      data: data || []
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch patient mappings'
    };
  }
}

/**
 * Delete patient mapping
 */
export async function deletePatientMapping(
  communityUserId: string,
  connectionId: string
): Promise<ApiResponse> {
  try {
    const { error } = await supabase
      .from('fhir_patient_mappings')
      .delete()
      .eq('community_user_id', communityUserId)
      .eq('connection_id', connectionId);

    if (error) throw error;

    return {
      success: true,
      message: 'Patient mapping deleted successfully'
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete patient mapping'
    };
  }
}

// ============================================================================
// AUTO-SYNC MANAGEMENT API
// ============================================================================

/**
 * Start automatic synchronization for a connection
 */
export async function startAutoSync(
  connectionId: string,
  frequency: FHIRConnection['syncFrequency']
): Promise<ApiResponse> {
  try {
    await fhirIntegrator.startAutoSync(connectionId, frequency);

    // Update connection sync frequency
    await supabase
      .from('fhir_connections')
      .update({ sync_frequency: frequency })
      .eq('id', connectionId);

    return {
      success: true,
      message: `Auto-sync started with ${frequency} frequency`
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start auto-sync'
    };
  }
}

/**
 * Stop automatic synchronization for a connection
 */
export async function stopAutoSync(connectionId: string): Promise<ApiResponse> {
  try {
    fhirIntegrator.stopAutoSync(connectionId);

    // Update connection sync frequency to manual
    await supabase
      .from('fhir_connections')
      .update({ sync_frequency: 'manual' })
      .eq('id', connectionId);

    return {
      success: true,
      message: 'Auto-sync stopped'
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to stop auto-sync'
    };
  }
}

// ============================================================================
// ANALYTICS AND REPORTING API
// ============================================================================

/**
 * Get sync statistics for a connection
 */
export async function getSyncStatistics(
  connectionId: string,
  days: number = 30
): Promise<ApiResponse> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const { data, error } = await supabase
      .from('fhir_sync_logs')
      .select('*')
      .eq('connection_id', connectionId)
      .gte('started_at', cutoffDate.toISOString());

    if (error) throw error;

    const logs = data || [];
    const totalSyncs = logs.length;
    const successfulSyncs = logs.filter(l => l.status === 'success').length;
    const failedSyncs = logs.filter(l => l.status === 'failed').length;
    const partialSyncs = logs.filter(l => l.status === 'partial').length;
    const totalRecordsProcessed = logs.reduce((sum, l) => sum + (l.records_processed || 0), 0);
    const totalRecordsSucceeded = logs.reduce((sum, l) => sum + (l.records_succeeded || 0), 0);

    return {
      success: true,
      data: {
        period: `${days} days`,
        totalSyncs,
        successfulSyncs,
        failedSyncs,
        partialSyncs,
        successRate: totalSyncs > 0 ? Math.round((successfulSyncs / totalSyncs) * 100) : 0,
        totalRecordsProcessed,
        totalRecordsSucceeded,
        lastSync: logs[0]?.started_at || null
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch sync statistics'
    };
  }
}

/**
 * Get FHIR compliance metrics
 */
export async function getFHIRComplianceMetrics(): Promise<ApiResponse> {
  try {
    // Get total patients
    const { count: totalPatients } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    // Get mapped patients (have FHIR mapping)
    const { count: mappedPatients } = await supabase
      .from('fhir_patient_mappings')
      .select('community_user_id', { count: 'exact', head: true });

    // Get synced patients (successfully synced in last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { count: syncedPatients } = await supabase
      .from('fhir_patient_mappings')
      .select('*', { count: 'exact', head: true })
      .eq('sync_status', 'synced')
      .gte('last_synced_at', sevenDaysAgo.toISOString());

    return {
      success: true,
      data: {
        totalPatients: totalPatients || 0,
        mappedPatients: mappedPatients || 0,
        syncedPatients: syncedPatients || 0,
        mappingRate: totalPatients ? Math.round(((mappedPatients || 0) / totalPatients) * 100) : 0,
        syncRate: mappedPatients ? Math.round(((syncedPatients || 0) / (mappedPatients || 1)) * 100) : 0,
        complianceScore: totalPatients ? Math.round(((syncedPatients || 0) / totalPatients) * 100) : 0
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch compliance metrics'
    };
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export default {
  // Connection management
  getFHIRConnections,
  createFHIRConnection,
  testFHIRConnection,
  updateFHIRConnectionStatus,
  deleteFHIRConnection,

  // Synchronization
  syncFromFHIR,
  syncToFHIR,
  syncBidirectional,
  getSyncHistory,

  // Patient mapping
  createPatientMapping,
  getPatientMapping,
  getAllPatientMappings,
  deletePatientMapping,

  // Auto-sync
  startAutoSync,
  stopAutoSync,

  // Analytics
  getSyncStatistics,
  getFHIRComplianceMetrics
};
