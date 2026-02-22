/**
 * Enhanced FHIR Service — SMART on FHIR Synchronization
 *
 * Handles SMART session data sync and EHR integration,
 * including patient-to-WellFit mapping and observation sync.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { DataCache } from './data-fetching';
import type {
  SmartSession,
  ComprehensivePatientData,
  VitalsEntry
} from './types';

/** FHIR Observation type for SMART sync */
type FhirObservation = {
  id?: string;
  code?: { coding?: Array<{ display?: string }>; text?: string };
  valueQuantity?: { value?: number; unit?: string };
  valueString?: string;
  effectiveDateTime?: string;
  issued?: string;
  status?: string;
};

/**
 * Sync data from a SMART on FHIR session into WellFit.
 */
export async function syncWithSmartSession(
  _supabaseClient: SupabaseClient,
  dataCache: DataCache,
  smartSession: SmartSession
): Promise<{
  patientData: ComprehensivePatientData;
  observations: VitalsEntry[];
  synchronized: boolean;
}> {
  try {
    // Validate SMART session
    if (!smartSession?.accessToken || !smartSession?.patient) {
      throw new Error('Invalid SMART session: missing accessToken or patient');
    }

    // Extract patient ID from session
    const patientId = smartSession.patient;
    const fhirServerUrl = (smartSession.fhirServerUrl || smartSession.serverUrl) as string | undefined;
    const patientName = (smartSession.patientName || 'SMART Patient') as string;
    const sessionExpiry = (smartSession.expiresAt || new Date(Date.now() + 3600000).toISOString()) as string;
    const scope = (smartSession.scope || 'patient/*.read') as string;

    // Fetch patient data from FHIR server (simulated for demo)
    // Map to ComprehensivePatientData structure
    const patientData: ComprehensivePatientData = {
      profile: {
        id: patientId,
        user_id: patientId,
        first_name: patientName,
        // Store FHIR metadata in profile
      },
      vitals: [],
      checkIns: [],
      medications: [],
      conditions: []
    };

    // Fetch observations (simulated - in production would call FHIR server)
    const rawObservations = (smartSession.observations || []) as unknown[];
    const observations: VitalsEntry[] = rawObservations.map((obs: unknown) => {
      const o = obs as Record<string, unknown>;
      return {
        created_at: (o.effectiveDateTime || o.issued || new Date().toISOString()) as string | undefined,
      };
    });

    // Store sync metadata
    const fhirMetadata = {
      serverUrl: fhirServerUrl,
      sessionExpiry,
      scope
    };

    // Sync to WellFit
    await syncPatientToWellFit(
      dataCache,
      { id: patientId, name: patientName, ...fhirMetadata },
      rawObservations as FhirObservation[]
    );

    return {
      patientData,
      observations,
      synchronized: true
    };

  } catch (error: unknown) {
    throw new Error(`Failed to sync SMART data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Helper method for EHR integration - syncs FHIR patient and observations to WellFit.
 */
async function syncPatientToWellFit(
  dataCache: DataCache,
  fhirPatient: {
    id?: string;
    name?: { given?: string[]; family?: string } | string;
    serverUrl?: string;
  },
  observations: FhirObservation[]
): Promise<void> {
  // Map FHIR patient to WellFit profile format
  const patientName = typeof fhirPatient.name === 'object' ? fhirPatient.name : undefined;
  const wellFitProfile = {
    external_fhir_id: fhirPatient.id,
    first_name: patientName?.given?.[0] || (typeof fhirPatient.name === 'string' ? fhirPatient.name : 'Unknown'),
    last_name: patientName?.family || '',
    fhir_server_url: fhirPatient.serverUrl,
    last_synced_at: new Date().toISOString()
  };

  // Map observations to WellFit health observations
  const _healthObservations = observations.map((obs) => ({
    external_fhir_id: obs.id,
    patient_fhir_id: fhirPatient.id,
    observation_type: obs.code?.coding?.[0]?.display || obs.code?.text || 'Unknown',
    value: obs.valueQuantity?.value || obs.valueString || null,
    unit: obs.valueQuantity?.unit || null,
    effective_date: obs.effectiveDateTime || obs.issued || new Date().toISOString(),
    status: obs.status || 'final'
  }));

  // In production, this would upsert to Supabase with sync metadata
  // For now, cache the synced data as ComprehensivePatientData
  const cachedData: ComprehensivePatientData = {
    profile: {
      id: fhirPatient.id,
      user_id: fhirPatient.id,
      first_name: wellFitProfile.first_name,
      last_name: wellFitProfile.last_name,
    },
    vitals: observations.map(obs => ({
      created_at: obs.effectiveDateTime || obs.issued,
    })),
    checkIns: [],
    medications: [],
    conditions: []
  };
  dataCache.setCache(`smart-sync-${fhirPatient.id}`, cachedData, 3600000); // 1 hour TTL
}
