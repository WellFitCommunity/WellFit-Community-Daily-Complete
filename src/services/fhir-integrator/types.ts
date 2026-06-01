/**
 * FHIR Interoperability Integrator — shared types
 *
 * Extracted from fhirInteroperabilityIntegrator.ts (CLAUDE.md Commandment #12).
 */

export type UnknownRecord = Record<string, unknown>;

export interface FHIRBundleEntry {
  resource?: UnknownRecord;
}

export interface FHIRTelecom {
  system?: string;
  value?: string;
}

export interface FHIRHumanName {
  given?: string[];
  family?: string;
}

export interface FHIRPatient extends UnknownRecord {
  name?: FHIRHumanName[];
  telecom?: FHIRTelecom[];
  birthDate?: string;
}

export interface FHIRObservationCodeCoding {
  system?: string;
  code?: string;
}

export interface FHIRObservationComponent extends UnknownRecord {
  code?: { coding?: Array<{ code?: string }> };
  valueQuantity?: { value?: number };
}

export interface FHIRObservationResource extends UnknownRecord {
  effectiveDateTime?: string;
  issued?: string;
  code?: { coding?: FHIRObservationCodeCoding[] };
  valueQuantity?: { value?: number };
  component?: FHIRObservationComponent[];
}

export interface FHIRImmunizationCoding {
  system?: string;
  code?: string;
  display?: string;
}

export interface FHIRImmunizationResource extends UnknownRecord {
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

export interface FHIRCarePlanCategory extends UnknownRecord {
  coding?: Array<{ code?: string; display?: string }>;
}

export interface FHIRCarePlanActivity extends UnknownRecord {
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

export interface FHIRCarePlanResource extends UnknownRecord {
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

export interface FHIRPatientData {
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
