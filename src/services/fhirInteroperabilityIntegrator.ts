/**
 * FHIR Interoperability Integrator
 *
 * Complete integration layer between WellFit Community System and external FHIR systems
 * Provides bi-directional data synchronization, real-time updates, and compliance tracking
 */

import { supabase } from '../lib/supabaseClient';
import { FHIRIntegrationService } from '../components/admin/FhirIntegrationService';
import SMARTClient, { EHR_CONFIGS as _EHR_CONFIGS } from '../lib/smartOnFhir';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type UnknownRecord = Record<string, unknown>;

interface FHIRBundleEntry {
  resource?: UnknownRecord;
}

interface FHIRTelecom {
  system?: string;
  value?: string;
}

interface FHIRHumanName {
  given?: string[];
  family?: string;
}

interface FHIRPatient extends UnknownRecord {
  name?: FHIRHumanName[];
  telecom?: FHIRTelecom[];
  birthDate?: string;
}

interface FHIRObservationCodeCoding {
  system?: string;
  code?: string;
}

interface FHIRObservationComponent extends UnknownRecord {
  code?: { coding?: Array<{ code?: string }> };
  valueQuantity?: { value?: number };
}

interface FHIRObservationResource extends UnknownRecord {
  effectiveDateTime?: string;
  issued?: string;
  code?: { coding?: FHIRObservationCodeCoding[] };
  valueQuantity?: { value?: number };
  component?: FHIRObservationComponent[];
}

interface FHIRImmunizationCoding {
  system?: string;
  code?: string;
  display?: string;
}

interface FHIRImmunizationResource extends UnknownRecord {
  resourceType?: string;
  id?: string;
  status?: string;
  vaccineCode?: { coding?: FHIRImmunizationCoding[] };
  occurrenceDateTime?: string;
  primarySource?: boolean;
  lotNumber?: string;
  expirationDate?: string;
  manufacturer?: { display?: string };
  site?: { coding?: Array<{ code?: string; display?: string }> };
  route?: { coding?: Array<{ code?: string; display?: string }> };
  doseQuantity?: { value?: number; unit?: string };
  performer?: Array<{ actor?: { display?: string } }>;
  location?: { display?: string };
  note?: Array<{ text?: string }>;
  protocolApplied?: Array<{ doseNumberPositiveInt?: number; seriesDosesPositiveInt?: number }>;
  reaction?: Array<{ date?: string; reported?: boolean }>;
}

interface FHIRCarePlanCategory extends UnknownRecord {
  coding?: Array<{ code?: string; display?: string }>;
}

interface FHIRCarePlanActivity extends UnknownRecord {
  detail?: {
    kind?: string;
    status?: string;
    description?: string;
    scheduledTiming?: {
      repeat?: {
        boundsPeriod?: {
          start?: string;
          end?: string;
        };
      };
    };
  };
}

interface FHIRCarePlanResource extends UnknownRecord {
  resourceType?: string;
  id?: string;
  status?: string;
  intent?: string;
  category?: FHIRCarePlanCategory[];
  title?: string;
  description?: string;
  subject?: { reference?: string; display?: string };
  period?: { start?: string; end?: string };
  created?: string;
  author?: { reference?: string; display?: string };
  careTeam?: Array<{ reference?: string; display?: string }>;
  addresses?: Array<{ reference?: string; display?: string }>;
  goal?: Array<{ reference?: string; display?: string }>;
  activity?: FHIRCarePlanActivity[];
  note?: Array<{ text?: string }>;
}

interface FHIRPatientData {
  patient?: FHIRPatient;
  observations: Array<{ resource?: FHIRObservationResource }>;
  immunizations: Array<{ resource?: FHIRImmunizationResource }>;
  carePlans: Array<{ resource?: FHIRCarePlanResource }>;
}

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

      return this.mapConnectionFromDB(data as UnknownRecord);
    } catch (error) {
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

      return (data || []).map((row) => this.mapConnectionFromDB(row as UnknownRecord));
    } catch (error) {
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
await this.pushBundleToFHIR(
  conn.fhir_server_url,
  bundle,
  conn.access_token,
  (mapping as UnknownRecord | null | undefined)?.fhir_patient_id as string | undefined
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
        await this.syncFromFHIR(connectionId);
      } catch (error) {

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
  ): Promise<FHIRPatientData> {
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
    const patient = (await patientResponse.json()) as FHIRPatient;

    // Fetch observations (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateParam = thirtyDaysAgo.toISOString().split('T')[0];

    const observationsResponse = await fetch(
      `${fhirServerUrl}/Observation?patient=${patientId}&date=ge${dateParam}`,
      { headers }
    );
    const observationsJson = observationsResponse.ok ? ((await observationsResponse.json()) as UnknownRecord) : { entry: [] };
    const observations = (observationsJson.entry as unknown as FHIRBundleEntry[]) || [];

    // Fetch Immunizations
    const immunizationsResponse = await fetch(
      `${fhirServerUrl}/Immunization?patient=${patientId}`,
      { headers }
    );
    const immunizationsJson = immunizationsResponse.ok ? ((await immunizationsResponse.json()) as UnknownRecord) : { entry: [] };
    const immunizations = (immunizationsJson.entry as unknown as FHIRBundleEntry[]) || [];

    // Fetch CarePlans (only active and on-hold)
    const carePlansResponse = await fetch(
      `${fhirServerUrl}/CarePlan?patient=${patientId}&status=active,on-hold`,
      { headers }
    );
    const carePlansJson = carePlansResponse.ok ? ((await carePlansResponse.json()) as UnknownRecord) : { entry: [] };
    const carePlans = (carePlansJson.entry as unknown as FHIRBundleEntry[]) || [];

    return {
      patient,
      observations: observations as Array<{ resource?: FHIRObservationResource }>,
      immunizations: immunizations as Array<{ resource?: FHIRImmunizationResource }>,
      carePlans: carePlans as Array<{ resource?: FHIRCarePlanResource }>
    };
  }

  private async importFHIRData(communityUserId: string, fhirData: FHIRPatientData): Promise<void> {
    const currentUser = (await supabase.auth.getUser()).data.user;
    const startTime = Date.now();

    // SOC 2: Log PHI import attempt
    await this.logAuditEvent('FHIR_IMPORT_STARTED', {
      actor_user_id: currentUser?.id,
      target_user_id: communityUserId,
      timestamp: new Date().toISOString()
    });

    try {
      // Import patient demographics
      if (fhirData.patient) {
        const patient = fhirData.patient;
        const name = patient.name?.[0];
        const telecom = patient.telecom || [];
        const email = telecom.find((t) => t.system === 'email')?.value;
        const phone = telecom.find((t) => t.system === 'phone')?.value;

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
        // Get tenant_id for check_ins (required NOT NULL field)
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('user_id', communityUserId)
          .maybeSingle();

        const tenantId = (userProfile as UnknownRecord | null | undefined)?.tenant_id as string | undefined;

        for (const entry of fhirData.observations) {
          const obs = entry.resource;
          if (!obs) continue;

          const checkInData: Record<string, unknown> = {
            user_id: communityUserId,
            tenant_id: tenantId,
            label: 'FHIR Import',
            source: 'fhir_import',
            created_at: obs.effectiveDateTime || obs.issued || new Date().toISOString(),
            is_emergency: false
          };

          // Skip if no tenant_id (would fail insert anyway)
          if (!tenantId) continue;

          // Map based on LOINC code
          const loincCode = obs.code?.coding?.find((c) => c.system === 'http://loinc.org')?.code;

          switch (loincCode) {
            case '8867-4': // Heart rate
              checkInData.heart_rate = obs.valueQuantity?.value;
              break;
            case '2708-6': // Oxygen saturation
              checkInData.pulse_oximeter = obs.valueQuantity?.value;
              break;
            case '85354-9': // Blood pressure panel
              if (obs.component) {
                const systolic = obs.component.find((c) =>
                  c.code?.coding?.find((cc) => cc.code === '8480-6'));
                const diastolic = obs.component.find((c) =>
                  c.code?.coding?.find((cc) => cc.code === '8462-4'));
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

          const vaccineCode = imm.vaccineCode?.coding?.find((c) =>
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
              .eq('id', (existing as UnknownRecord).id as string);
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
          const categories = plan.category?.map((cat) => cat.coding?.[0]?.code).filter(Boolean) || [];
          const categoryDisplays = plan.category?.map((cat) => cat.coding?.[0]?.display).filter(Boolean) || [];

          // Extract activities from FHIR format
          const activities = plan.activity?.map((a) => ({
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
            addresses_condition_references: plan.addresses?.map((a) => a.reference),
            addresses_condition_displays: plan.addresses?.map((a) => a.display),
            goal_references: plan.goal?.map((g) => g.reference),
            goal_displays: plan.goal?.map((g) => g.display),
            activities: activities,
            note: plan.note?.[0]?.text,
            updated_at: new Date().toISOString()
          };

          if (existingPlan) {
            await supabase
              .from('fhir_care_plans')
              .update(carePlanData)
              .eq('id', (existingPlan as UnknownRecord).id as string);
          } else {
            await supabase
              .from('fhir_care_plans')
              .insert({ ...carePlanData, created_at: new Date().toISOString() });
          }
        }
      }

      // SOC 2: Log successful import completion
      const duration = Date.now() - startTime;
      await this.logAuditEvent('FHIR_IMPORT_COMPLETED', {
        actor_user_id: currentUser?.id,
        target_user_id: communityUserId,
        duration_ms: duration,
        resources_imported: {
          immunizations: fhirData.immunizations?.length || 0,
          carePlans: fhirData.carePlans?.length || 0
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      // SOC 2: Log import failure (no PHI in logs)
      await this.logSecurityEvent('FHIR_IMPORT_FAILED', {
        actor_user_id: currentUser?.id,
        target_user_id: communityUserId,
        error_type: error instanceof Error ? error.constructor.name : 'Unknown',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  // SOC 2: Audit logging helper
  private async logAuditEvent(eventType: string, metadata: UnknownRecord): Promise<void> {
    try {
      await supabase.from('audit_logs').insert({
        event_type: eventType,
        event_category: 'PHI_ACCESS',
        metadata: metadata,
        created_at: new Date().toISOString()
      });
    } catch (err) {

    }
  }

  // SOC 2: Security event logging helper
  private async logSecurityEvent(eventType: string, metadata: UnknownRecord): Promise<void> {
    try {
      await supabase.from('security_events').insert({
        event_type: eventType,
        severity: 'HIGH',
        metadata: metadata,
        created_at: new Date().toISOString()
      });
    } catch (err) {

    }
  }

  private async pushBundleToFHIR(
    fhirServerUrl: string,
    bundle: UnknownRecord,
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

    const bundleEntry = bundle.entry as unknown as Array<{ resource?: UnknownRecord }> | undefined;

    // If we have an existing patient ID, update the bundle references
    if (existingPatientId && bundleEntry) {
      bundle.entry = bundleEntry.map((entry) => {
        const resource = entry.resource as UnknownRecord | undefined;
        const resourceType = (resource?.resourceType as string | undefined) || '';
        if (resource && resourceType === 'Patient') {
          resource.id = existingPatientId;
        }
        return entry;
      }) as unknown as UnknownRecord['entry'];
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

  private mapConnectionFromDB(data: UnknownRecord): FHIRConnection {
    return {
      id: data.id as string,
      name: data.name as string,
      fhirServerUrl: data.fhir_server_url as string,
      ehrSystem: data.ehr_system as FHIRConnection['ehrSystem'],
      clientId: data.client_id as string,
      status: data.status as FHIRConnection['status'],
      lastSync: data.last_sync as string | undefined,
      syncFrequency: data.sync_frequency as FHIRConnection['syncFrequency'],
      syncDirection: data.sync_direction as FHIRConnection['syncDirection'],
      accessToken: data.access_token as string | undefined,
      refreshToken: data.refresh_token as string | undefined,
      tokenExpiry: data.token_expiry as string | undefined,
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string
    };
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const fhirIntegrator = new FHIRInteroperabilityIntegrator();
export default fhirIntegrator;
