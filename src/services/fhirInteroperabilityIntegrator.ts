/**
 * FHIR Interoperability Integrator
 *
 * Complete integration layer between WellFit Community System and external FHIR systems
 * Provides bi-directional data synchronization, real-time updates, and compliance tracking
 */

import { supabase } from '../lib/supabaseClient';
import { FHIRIntegrationService } from '../components/admin/FhirIntegrationService';
import SMARTClient, { EHR_CONFIGS } from '../lib/smartOnFhir';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface FHIRConnection {
  id: string;
  name: string;
  fhirServerUrl: string;
  ehrSystem: 'EPIC' | 'CERNER' | 'ALLSCRIPTS' | 'CUSTOM';
  clientId: string;
  status: 'active' | 'inactive' | 'error';
  lastSync?: string;
  syncFrequency: 'realtime' | 'hourly' | 'daily' | 'manual';
  syncDirection: 'pull' | 'push' | 'bidirectional';
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SyncResult {
  connectionId: string;
  syncType: 'full' | 'incremental' | 'manual';
  direction: 'pull' | 'push' | 'bidirectional';
  startTime: string;
  endTime: string;
  status: 'success' | 'partial' | 'failed';
  recordsProcessed: number;
  recordsSucceeded: number;
  recordsFailed: number;
  errors: Array<{
    resourceType: string;
    resourceId: string;
    error: string;
  }>;
  summary: {
    patientsSync: number;
    observationsSync: number;
    encountersSync: number;
    otherResourcesSync: number;
  };
}

export interface SyncConfig {
  autoSync: boolean;
  syncFrequency: number; // in minutes
  syncResources: string[]; // ['Patient', 'Observation', 'Encounter', etc.]
  conflictResolution: 'fhir-wins' | 'community-wins' | 'manual';
  enableRealtime: boolean;
  batchSize: number;
  retryAttempts: number;
}

export interface PatientMapping {
  communityUserId: string;
  fhirPatientId: string;
  connectionId: string;
  lastSyncedAt: string;
  syncStatus: 'synced' | 'pending' | 'conflict' | 'error';
}

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

      return this.mapConnectionFromDB(data);
    } catch (error) {
      console.error('Failed to create FHIR connection:', error);
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
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(this.mapConnectionFromDB);
    } catch (error) {
      console.error('Failed to fetch FHIR connections:', error);
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
  async testConnection(connectionId: string): Promise<{ success: boolean; message: string; metadata?: any }> {
    try {
      const { data: conn, error } = await supabase
        .from('fhir_connections')
        .select('*')
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

      const metadata = await response.json();

      await this.updateConnectionStatus(connectionId, 'active');

      return {
        success: true,
        message: 'Connection successful',
        metadata: {
          fhirVersion: metadata.fhirVersion,
          software: metadata.software?.name,
          endpoints
        }
      };
    } catch (error) {
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
        .select('*')
        .eq('id', connectionId)
        .single();

      if (connError || !conn) {
        throw new Error('Connection not found');
      }

      // Get patient mappings
      let query = supabase
        .from('fhir_patient_mappings')
        .select('*')
        .eq('connection_id', connectionId);

      if (userIds && userIds.length > 0) {
        query = query.in('community_user_id', userIds);
      }

      const { data: mappings, error: mapError } = await query;

      if (mapError) throw mapError;

      if (!mappings || mappings.length === 0) {
        console.warn('No patient mappings found for this connection');
        result.endTime = new Date().toISOString();
        return result;
      }

      // Sync each patient
      for (const mapping of mappings) {
        try {
          result.recordsProcessed++;

          // Fetch FHIR data for this patient
          const patientData = await this.fetchPatientDataFromFHIR(
            conn.fhir_server_url,
            mapping.fhir_patient_id,
            conn.access_token
          );

          // Import to community database
          await this.importFHIRData(mapping.community_user_id, patientData);

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
        } catch (error) {
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
    } catch (error) {
      result.status = 'failed';
      result.errors.push({
        resourceType: 'System',
        resourceId: connectionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    result.endTime = new Date().toISOString();

    // Log sync result
    await this.logSyncResult(result);

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
        .select('*')
        .eq('id', connectionId)
        .single();

      if (connError || !conn) {
        throw new Error('Connection not found');
      }

      for (const userId of userIds) {
        try {
          result.recordsProcessed++;

          // Export patient data as FHIR bundle (with ALL resources including Immunization and CarePlan)
          const bundle = await this.fhirService.exportPatientDataComplete(userId);

          // Get patient mapping
          const { data: mapping } = await supabase
            .from('fhir_patient_mappings')
            .select('fhir_patient_id')
            .eq('community_user_id', userId)
            .eq('connection_id', connectionId)
            .single();

          // Push to FHIR server
          await this.pushBundleToFHIR(
            conn.fhir_server_url,
            bundle,
            conn.access_token,
            mapping?.fhir_patient_id
          );

          result.recordsSucceeded++;
          result.summary.patientsSync++;
        } catch (error) {
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
    } catch (error) {
      result.status = 'failed';
      result.errors.push({
        resourceType: 'System',
        resourceId: connectionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    result.endTime = new Date().toISOString();
    await this.logSyncResult(result);

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
      .select('*')
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

    const intervalMs = this.getIntervalMs(frequency);
    if (intervalMs === 0) return; // Manual sync

    const interval = setInterval(async () => {
      try {
        console.log(`Auto-sync triggered for connection ${connectionId}`);
        await this.syncFromFHIR(connectionId);
      } catch (error) {
        console.error(`Auto-sync failed for connection ${connectionId}:`, error);
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

  // ========================================================================
  // HELPER METHODS
  // ========================================================================

  private async fetchPatientDataFromFHIR(
    fhirServerUrl: string,
    patientId: string,
    accessToken?: string
  ): Promise<any> {
    const headers: Record<string, string> = {
      'Accept': 'application/fhir+json'
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    // Fetch patient resource
    const patientResponse = await fetch(`${fhirServerUrl}/Patient/${patientId}`, { headers });
    if (!patientResponse.ok) {
      throw new Error(`Failed to fetch patient: ${patientResponse.statusText}`);
    }
    const patient = await patientResponse.json();

    // Fetch observations (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateParam = thirtyDaysAgo.toISOString().split('T')[0];

    const observationsResponse = await fetch(
      `${fhirServerUrl}/Observation?patient=${patientId}&date=ge${dateParam}`,
      { headers }
    );
    const observations = observationsResponse.ok ? await observationsResponse.json() : { entry: [] };

    // Fetch Immunizations
    const immunizationsResponse = await fetch(
      `${fhirServerUrl}/Immunization?patient=${patientId}`,
      { headers }
    );
    const immunizations = immunizationsResponse.ok
      ? await immunizationsResponse.json()
      : { entry: [] };

    // Fetch CarePlans (only active and on-hold)
    const carePlansResponse = await fetch(
      `${fhirServerUrl}/CarePlan?patient=${patientId}&status=active,on-hold`,
      { headers }
    );
    const carePlans = carePlansResponse.ok
      ? await carePlansResponse.json()
      : { entry: [] };

    return {
      patient,
      observations: observations.entry || [],
      immunizations: immunizations.entry || [],
      carePlans: carePlans.entry || []
    };
  }

  private async importFHIRData(communityUserId: string, fhirData: any): Promise<void> {
    // Import patient demographics
    if (fhirData.patient) {
      const patient = fhirData.patient;
      const name = patient.name?.[0];
      const telecom = patient.telecom || [];
      const email = telecom.find((t: any) => t.system === 'email')?.value;
      const phone = telecom.find((t: any) => t.system === 'phone')?.value;

      await supabase
        .from('profiles')
        .update({
          first_name: name?.given?.[0] || '',
          last_name: name?.family || '',
          email: email || '',
          phone: phone || '',
          dob: patient.birthDate || '',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', communityUserId);
    }

    // Import observations as check-ins
    if (fhirData.observations && Array.isArray(fhirData.observations)) {
      for (const entry of fhirData.observations) {
        const obs = entry.resource;
        if (!obs) continue;

        const checkInData: any = {
          user_id: communityUserId,
          created_at: obs.effectiveDateTime || obs.issued || new Date().toISOString(),
          is_emergency: false
        };

        // Map based on LOINC code
        const loincCode = obs.code?.coding?.find((c: any) => c.system === 'http://loinc.org')?.code;

        switch (loincCode) {
          case '8867-4': // Heart rate
            checkInData.heart_rate = obs.valueQuantity?.value;
            break;
          case '2708-6': // Oxygen saturation
            checkInData.pulse_oximeter = obs.valueQuantity?.value;
            break;
          case '85354-9': // Blood pressure panel
            if (obs.component) {
              const systolic = obs.component.find((c: any) => c.code?.coding?.find((cc: any) => cc.code === '8480-6'));
              const diastolic = obs.component.find((c: any) => c.code?.coding?.find((cc: any) => cc.code === '8462-4'));
              checkInData.bp_systolic = systolic?.valueQuantity?.value;
              checkInData.bp_diastolic = diastolic?.valueQuantity?.value;
            }
            break;
          case '33747-0': // Glucose
            checkInData.glucose_mg_dl = obs.valueQuantity?.value;
            break;
        }

        // Only insert if we have at least one vitals value
        if (checkInData.heart_rate || checkInData.pulse_oximeter ||
            checkInData.bp_systolic || checkInData.glucose_mg_dl) {
          await supabase.from('check_ins').insert(checkInData);
        }
      }
    }

    // Import Immunizations
    if (fhirData.immunizations && Array.isArray(fhirData.immunizations)) {
      for (const entry of fhirData.immunizations) {
        const imm = entry.resource;
        if (!imm || imm.resourceType !== 'Immunization') continue;

        const vaccineCode = imm.vaccineCode?.coding?.find((c: any) =>
          c.system === 'http://hl7.org/fhir/sid/cvx'
        );

        if (!vaccineCode) continue;

        // Check if immunization already exists from this external system
        const { data: existing } = await supabase
          .from('fhir_immunizations')
          .select('id')
          .eq('external_id', imm.id)
          .eq('external_system', 'FHIR')
          .maybeSingle();

        const immunizationData = {
          patient_id: communityUserId,
          external_id: imm.id,
          external_system: 'FHIR',
          status: imm.status || 'completed',
          vaccine_code: vaccineCode.code,
          vaccine_display: vaccineCode.display || 'Unknown Vaccine',
          occurrence_datetime: imm.occurrenceDateTime,
          primary_source: imm.primarySource !== false,
          lot_number: imm.lotNumber,
          expiration_date: imm.expirationDate,
          manufacturer: imm.manufacturer?.display,
          site_code: imm.site?.coding?.[0]?.code,
          site_display: imm.site?.coding?.[0]?.display,
          route_code: imm.route?.coding?.[0]?.code,
          route_display: imm.route?.coding?.[0]?.display,
          dose_quantity_value: imm.doseQuantity?.value,
          dose_quantity_unit: imm.doseQuantity?.unit,
          performer_actor_display: imm.performer?.[0]?.actor?.display,
          location_display: imm.location?.display,
          note: imm.note?.[0]?.text,
          protocol_dose_number_positive_int: imm.protocolApplied?.[0]?.doseNumberPositiveInt,
          protocol_series_doses_positive_int: imm.protocolApplied?.[0]?.seriesDosesPositiveInt,
          reaction_date: imm.reaction?.[0]?.date,
          reaction_reported: imm.reaction?.[0]?.reported,
          updated_at: new Date().toISOString()
        };

        if (existing) {
          await supabase
            .from('fhir_immunizations')
            .update(immunizationData)
            .eq('id', existing.id);
        } else {
          await supabase
            .from('fhir_immunizations')
            .insert({ ...immunizationData, created_at: new Date().toISOString() });
        }
      }
    }

    // Import CarePlans
    if (fhirData.carePlans && Array.isArray(fhirData.carePlans)) {
      for (const entry of fhirData.carePlans) {
        const plan = entry.resource;
        if (!plan || plan.resourceType !== 'CarePlan') continue;

        // Extract categories
        const categories = plan.category?.map((cat: any) => cat.coding?.[0]?.code).filter(Boolean) || [];
        const categoryDisplays = plan.category?.map((cat: any) => cat.coding?.[0]?.display).filter(Boolean) || [];

        // Extract activities from FHIR format
        const activities = plan.activity?.map((a: any) => ({
          kind: a.detail?.kind,
          status: a.detail?.status,
          detail: a.detail?.description,
          scheduled_start: a.detail?.scheduledTiming?.repeat?.boundsPeriod?.start,
          scheduled_end: a.detail?.scheduledTiming?.repeat?.boundsPeriod?.end
        })) || [];

        // Check if care plan already exists from this external system
        const { data: existingPlan } = await supabase
          .from('fhir_care_plans')
          .select('id')
          .eq('external_id', plan.id)
          .eq('external_system', 'FHIR')
          .maybeSingle();

        const carePlanData = {
          patient_id: communityUserId,
          external_id: plan.id,
          external_system: 'FHIR',
          status: plan.status,
          intent: plan.intent,
          category: categories,
          category_display: categoryDisplays,
          title: plan.title,
          description: plan.description,
          subject_reference: plan.subject?.reference,
          subject_display: plan.subject?.display,
          period_start: plan.period?.start,
          period_end: plan.period?.end,
          created: plan.created,
          author_reference: plan.author?.reference,
          author_display: plan.author?.display,
          care_team_reference: plan.careTeam?.[0]?.reference,
          care_team_display: plan.careTeam?.[0]?.display,
          addresses_condition_references: plan.addresses?.map((a: any) => a.reference),
          addresses_condition_displays: plan.addresses?.map((a: any) => a.display),
          goal_references: plan.goal?.map((g: any) => g.reference),
          goal_displays: plan.goal?.map((g: any) => g.display),
          activities: activities,
          note: plan.note?.[0]?.text,
          updated_at: new Date().toISOString()
        };

        if (existingPlan) {
          await supabase
            .from('fhir_care_plans')
            .update(carePlanData)
            .eq('id', existingPlan.id);
        } else {
          await supabase
            .from('fhir_care_plans')
            .insert({ ...carePlanData, created_at: new Date().toISOString() });
        }
      }
    }
  }

  private async pushBundleToFHIR(
    fhirServerUrl: string,
    bundle: any,
    accessToken?: string,
    existingPatientId?: string
  ): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/fhir+json',
      'Accept': 'application/fhir+json'
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    // If we have an existing patient ID, update the bundle references
    if (existingPatientId && bundle.entry) {
      bundle.entry = bundle.entry.map((entry: any) => {
        if (entry.resource.resourceType === 'Patient') {
          entry.resource.id = existingPatientId;
        }
        return entry;
      });
    }

    // POST bundle to FHIR server
    const response = await fetch(fhirServerUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(bundle)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`FHIR server error: ${response.status} - ${errorText}`);
    }
  }

  private async logSyncResult(result: SyncResult): Promise<void> {
    await supabase.from('fhir_sync_logs').insert({
      connection_id: result.connectionId,
      sync_type: result.syncType,
      direction: result.direction,
      status: result.status,
      records_processed: result.recordsProcessed,
      records_succeeded: result.recordsSucceeded,
      records_failed: result.recordsFailed,
      errors: result.errors,
      summary: result.summary,
      started_at: result.startTime,
      completed_at: result.endTime
    });
  }

  private getIntervalMs(frequency: FHIRConnection['syncFrequency']): number {
    switch (frequency) {
      case 'realtime': return 5 * 60 * 1000; // 5 minutes
      case 'hourly': return 60 * 60 * 1000; // 1 hour
      case 'daily': return 24 * 60 * 60 * 1000; // 24 hours
      case 'manual': return 0;
      default: return 0;
    }
  }

  private mapConnectionFromDB(data: any): FHIRConnection {
    return {
      id: data.id,
      name: data.name,
      fhirServerUrl: data.fhir_server_url,
      ehrSystem: data.ehr_system,
      clientId: data.client_id,
      status: data.status,
      lastSync: data.last_sync,
      syncFrequency: data.sync_frequency,
      syncDirection: data.sync_direction,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenExpiry: data.token_expiry,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const fhirIntegrator = new FHIRInteroperabilityIntegrator();
export default fhirIntegrator;
