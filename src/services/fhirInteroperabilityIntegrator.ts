/**
 * FHIR Interoperability Integrator
 *
 * Complete integration layer between WellFit Community System and external FHIR systems
 * Provides bi-directional data synchronization, real-time updates, and compliance tracking
 *
 * Decomposed 2026-06-01 (CLAUDE.md Commandment #12, 600-line limit). This file
 * keeps the FHIRInteroperabilityIntegrator class (connection mgmt, sync
 * orchestration, patient mapping, auto-sync) + the `fhirIntegrator` singleton.
 * Stateless concerns moved to cohesive modules under ./fhir-integrator/*:
 *   - types.ts      all FHIR resource shapes + FHIRConnection/SyncResult/SyncConfig/PatientMapping
 *   - fhirClient.ts fetchPatientDataFromFHIR + pushBundleToFHIR (raw FHIR server I/O)
 *   - importData.ts importFHIRData (bundle → community DB)
 *   - audit.ts      SOC 2 audit/security event logging
 *   - helpers.ts    logSyncResult, getIntervalMs, mapConnectionFromDB
 * The public type surface is re-exported below — import paths unchanged.
 */

import { supabase } from '../lib/supabaseClient';
import { FHIRIntegrationService } from '../components/admin/FhirIntegrationService';
import SMARTClient from '../lib/smartOnFhir';
import type {
  UnknownRecord,
  FHIRConnection,
  SyncResult,
  PatientMapping,
} from './fhir-integrator/types';
import { fetchPatientDataFromFHIR, pushBundleToFHIR } from './fhir-integrator/fhirClient';
import { importFHIRData } from './fhir-integrator/importData';
import { logSyncResult, getIntervalMs, mapConnectionFromDB } from './fhir-integrator/helpers';

// Re-export the public type surface so existing import paths keep working.
export type {
  FHIRConnection,
  SyncResult,
  SyncConfig,
  PatientMapping,
} from './fhir-integrator/types';

// ============================================================================
// MAIN INTEGRATOR CLASS
// ============================================================================

export class FHIRInteroperabilityIntegrator {
  private fhirService: FHIRIntegrationService;
  private smartClients: Map<string, SMARTClient>;
  private syncIntervals: Map<string, NodeJS.Timeout>;

  constructor() {
    this.fhirService = new FHIRIntegrationService();
    this.smartClients = new Map();
    this.syncIntervals = new Map();
  }

  // ========================================================================
  // CONNECTION MANAGEMENT
  // ========================================================================

  /**
   * Create a new FHIR connection
   */
  async createConnection(connection: Omit<FHIRConnection, 'id' | 'createdAt' | 'updatedAt'>): Promise<FHIRConnection> {
    try {
      const { data, error } = await supabase
        .from('fhir_connections')
        .insert({
          name: connection.name,
          fhir_server_url: connection.fhirServerUrl,
          ehr_system: connection.ehrSystem,
          client_id: connection.clientId,
          status: connection.status,
          sync_frequency: connection.syncFrequency,
          sync_direction: connection.syncDirection,
          access_token: connection.accessToken,
          refresh_token: connection.refreshToken,
          token_expiry: connection.tokenExpiry,
        })
        .select()
        .single();

      if (error) throw error;

      // Initialize SMART client
      const smartClient = new SMARTClient(connection.fhirServerUrl, connection.clientId);
      this.smartClients.set(data.id, smartClient);

      // Start auto-sync if configured
      if (connection.syncFrequency !== 'manual') {
        await this.startAutoSync(data.id, connection.syncFrequency);
      }

      return mapConnectionFromDB(data as UnknownRecord);
    } catch (error: unknown) {
      throw new Error(`Failed to create connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all FHIR connections
   */
  async getConnections(): Promise<FHIRConnection[]> {
    try {
      const { data, error } = await supabase
        .from('fhir_connections')
        .select('id, name, fhir_server_url, ehr_system, client_id, status, last_sync, sync_frequency, sync_direction, access_token, refresh_token, token_expiry, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((row) => mapConnectionFromDB(row as UnknownRecord));
    } catch (error: unknown) {
      return [];
    }
  }

  /**
   * Update connection status
   */
  async updateConnectionStatus(connectionId: string, status: FHIRConnection['status']): Promise<void> {
    await supabase
      .from('fhir_connections')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', connectionId);
  }

  /**
   * Test FHIR connection
   */
  async testConnection(connectionId: string): Promise<{ success: boolean; message: string; metadata?: UnknownRecord }> {
    try {
      const { data: conn, error } = await supabase
        .from('fhir_connections')
        .select('id, name, fhir_server_url, ehr_system, client_id, status, last_sync, sync_frequency, sync_direction, access_token, refresh_token, token_expiry, created_at, updated_at')
        .eq('id', connectionId)
        .single();

      if (error || !conn) {
        return { success: false, message: 'Connection not found' };
      }

      // Try to discover SMART endpoints
      const smartClient = new SMARTClient(conn.fhir_server_url, conn.client_id);
      const endpoints = await smartClient.discoverEndpoints();

      // Try a test query (CapabilityStatement)
      const response = await fetch(`${conn.fhir_server_url}/metadata`, {
        headers: {
          'Accept': 'application/fhir+json',
          ...(conn.access_token && { 'Authorization': `Bearer ${conn.access_token}` })
        }
      });

      if (!response.ok) {
        return {
          success: false,
          message: `FHIR server returned ${response.status}: ${response.statusText}`
        };
      }

      const metadataJson = (await response.json()) as UnknownRecord;

      await this.updateConnectionStatus(connectionId, 'active');

      const software = metadataJson.software as UnknownRecord | undefined;

      return {
        success: true,
        message: 'Connection successful',
        metadata: {
          fhirVersion: metadataJson.fhirVersion,
          software: software ? (software.name as unknown) : undefined,
          endpoints
        }
      };
    } catch (error: unknown) {
      await this.updateConnectionStatus(connectionId, 'error');
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ========================================================================
  // DATA SYNCHRONIZATION
  // ========================================================================

  /**
   * Perform full synchronization from FHIR to Community
   */
  async syncFromFHIR(connectionId: string, userIds?: string[]): Promise<SyncResult> {
    const startTime = new Date().toISOString();
    const result: SyncResult = {
      connectionId,
      syncType: userIds ? 'incremental' : 'full',
      direction: 'pull',
      startTime,
      endTime: '',
      status: 'success',
      recordsProcessed: 0,
      recordsSucceeded: 0,
      recordsFailed: 0,
      errors: [],
      summary: {
        patientsSync: 0,
        observationsSync: 0,
        encountersSync: 0,
        otherResourcesSync: 0
      }
    };

    try {
      // Get connection details
      const { data: conn, error: connError } = await supabase
        .from('fhir_connections')
        .select('id, fhir_server_url, access_token')
        .eq('id', connectionId)
        .single();

      if (connError || !conn) {
        throw new Error('Connection not found');
      }

      // Get patient mappings
      let query = supabase
        .from('fhir_patient_mappings')
        .select('id, community_user_id, fhir_patient_id, connection_id, last_synced_at, sync_status')
        .eq('connection_id', connectionId);

      if (userIds && userIds.length > 0) {
        query = query.in('community_user_id', userIds);
      }

      const { data: mappings, error: mapError } = await query;

      if (mapError) throw mapError;

      if (!mappings || mappings.length === 0) {
        result.endTime = new Date().toISOString();
        return result;
      }

      // Sync each patient
      for (const mapping of mappings) {
        try {
          result.recordsProcessed++;

          // Fetch FHIR data for this patient
          const patientData = await fetchPatientDataFromFHIR(
            conn.fhir_server_url,
            mapping.fhir_patient_id,
            conn.access_token
          );

          // Import to community database
          await importFHIRData(mapping.community_user_id, patientData);

          // Update mapping
          await supabase
            .from('fhir_patient_mappings')
            .update({
              last_synced_at: new Date().toISOString(),
              sync_status: 'synced'
            })
            .eq('id', mapping.id);

          result.recordsSucceeded++;
          result.summary.patientsSync++;
        } catch (error: unknown) {
          result.recordsFailed++;
          result.errors.push({
            resourceType: 'Patient',
            resourceId: mapping.fhir_patient_id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Update connection last sync
      await supabase
        .from('fhir_connections')
        .update({ last_sync: new Date().toISOString() })
        .eq('id', connectionId);

      result.status = result.recordsFailed === 0 ? 'success' :
                     result.recordsSucceeded > 0 ? 'partial' : 'failed';
    } catch (error: unknown) {
      result.status = 'failed';
      result.errors.push({
        resourceType: 'System',
        resourceId: connectionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    result.endTime = new Date().toISOString();

    // Log sync result
    await logSyncResult(result);

    return result;
  }

  /**
   * Push data from Community to FHIR
   */
  async syncToFHIR(connectionId: string, userIds: string[]): Promise<SyncResult> {
    const startTime = new Date().toISOString();
    const result: SyncResult = {
      connectionId,
      syncType: 'manual',
      direction: 'push',
      startTime,
      endTime: '',
      status: 'success',
      recordsProcessed: 0,
      recordsSucceeded: 0,
      recordsFailed: 0,
      errors: [],
      summary: {
        patientsSync: 0,
        observationsSync: 0,
        encountersSync: 0,
        otherResourcesSync: 0
      }
    };

    try {
      const { data: conn, error: connError } = await supabase
        .from('fhir_connections')
        .select('id, fhir_server_url, access_token')
        .eq('id', connectionId)
        .single();

      if (connError || !conn) {
        throw new Error('Connection not found');
      }

      for (const userId of userIds) {
        try {
          result.recordsProcessed++;

        // Export patient data as FHIR bundle (with ALL resources including Immunization and CarePlan)
const rawBundle: unknown = await this.fhirService.exportPatientDataComplete(userId);

const bundle: UnknownRecord =
  rawBundle && typeof rawBundle === 'object'
    ? (rawBundle as UnknownRecord)
    : {};

// Get patient mapping
const { data: mapping } = await supabase
  .from('fhir_patient_mappings')
  .select('fhir_patient_id')
  .eq('community_user_id', userId)
  .eq('connection_id', connectionId)
  .single();

// Push to FHIR server
await pushBundleToFHIR(
  conn.fhir_server_url,
  bundle,
  conn.access_token,
  (mapping as UnknownRecord | null | undefined)?.fhir_patient_id as string | undefined
);


          result.recordsSucceeded++;
          result.summary.patientsSync++;
        } catch (error: unknown) {
          result.recordsFailed++;
          result.errors.push({
            resourceType: 'Patient',
            resourceId: userId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      result.status = result.recordsFailed === 0 ? 'success' :
                     result.recordsSucceeded > 0 ? 'partial' : 'failed';
    } catch (error: unknown) {
      result.status = 'failed';
      result.errors.push({
        resourceType: 'System',
        resourceId: connectionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    result.endTime = new Date().toISOString();
    await logSyncResult(result);

    return result;
  }

  /**
   * Bi-directional sync
   */
  async syncBidirectional(connectionId: string, userIds?: string[]): Promise<{
    pullResult: SyncResult;
    pushResult: SyncResult;
  }> {
    // First pull from FHIR
    const pullResult = await this.syncFromFHIR(connectionId, userIds);

    // Then push to FHIR (only users that were successfully pulled)
    const successfulUserIds = userIds || [];
    const pushResult = await this.syncToFHIR(connectionId, successfulUserIds);

    return { pullResult, pushResult };
  }

  // ========================================================================
  // PATIENT MAPPING
  // ========================================================================

  /**
   * Create patient mapping between community user and FHIR patient
   */
  async createPatientMapping(
    communityUserId: string,
    fhirPatientId: string,
    connectionId: string
  ): Promise<PatientMapping> {
    const { data, error } = await supabase
      .from('fhir_patient_mappings')
      .insert({
        community_user_id: communityUserId,
        fhir_patient_id: fhirPatientId,
        connection_id: connectionId,
        sync_status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    return {
      communityUserId: data.community_user_id,
      fhirPatientId: data.fhir_patient_id,
      connectionId: data.connection_id,
      lastSyncedAt: data.last_synced_at,
      syncStatus: data.sync_status
    };
  }

  /**
   * Get patient mapping
   */
  async getPatientMapping(communityUserId: string, connectionId: string): Promise<PatientMapping | null> {
    const { data, error } = await supabase
      .from('fhir_patient_mappings')
      .select('community_user_id, fhir_patient_id, connection_id, last_synced_at, sync_status')
      .eq('community_user_id', communityUserId)
      .eq('connection_id', connectionId)
      .single();

    if (error || !data) return null;

    return {
      communityUserId: data.community_user_id,
      fhirPatientId: data.fhir_patient_id,
      connectionId: data.connection_id,
      lastSyncedAt: data.last_synced_at,
      syncStatus: data.sync_status
    };
  }

  // ========================================================================
  // AUTO-SYNC MANAGEMENT
  // ========================================================================

  /**
   * Start automatic synchronization
   */
  async startAutoSync(connectionId: string, frequency: FHIRConnection['syncFrequency']): Promise<void> {
    // Stop existing sync if any
    this.stopAutoSync(connectionId);

    const intervalMs = getIntervalMs(frequency);
    if (intervalMs === 0) return; // Manual sync

    const interval = setInterval(async () => {
      try {
        await this.syncFromFHIR(connectionId);
      } catch (error: unknown) {

      }
    }, intervalMs);

    this.syncIntervals.set(connectionId, interval);
  }

  /**
   * Stop automatic synchronization
   */
  stopAutoSync(connectionId: string): void {
    const interval = this.syncIntervals.get(connectionId);
    if (interval) {
      clearInterval(interval);
      this.syncIntervals.delete(connectionId);
    }
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const fhirIntegrator = new FHIRInteroperabilityIntegrator();
export default fhirIntegrator;
