/**
 * Fetch patient timeline summary (check-ins, vitals, encounters, alerts)
 *
 * Integrates with:
 * - check_ins table (community daily wellness check-ins)
 * - ObservationService (FHIR vital signs → last_vitals)
 * - EncounterService (FHIR encounters → last_encounter)
 * - care_team_alerts table (active alert count)
 *
 * @module patient-context/fetchTimeline
 * Copyright 2025-2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';
import { ObservationService } from '../fhir/ObservationService';
import { EncounterService } from '../fhir/EncounterService';
import type {
  PatientId,
  PatientTimelineSummary,
  TimelineEvent,
} from '../../types/patientContext';
import type { Observation } from '../../types/fhir';
import type { CheckInRow, FetchResult } from './types';

// LOINC codes for vital sign extraction
const LOINC_SYSTOLIC_BP = '8480-6';
const LOINC_DIASTOLIC_BP = '8462-4';
const LOINC_HEART_RATE = '8867-4';
const LOINC_TEMPERATURE = '8310-5';
const LOINC_OXYGEN_SATURATION = '2708-6';

/**
 * Extract latest vital signs from FHIR Observation array
 *
 * Maps LOINC codes to the last_vitals shape:
 * - 8480-6 (systolic) + 8462-4 (diastolic) → blood_pressure as "120/80"
 * - 8867-4 → heart_rate
 * - 8310-5 → temperature
 * - 2708-6 → oxygen_saturation
 */
function extractLatestVitals(observations: Observation[]): PatientTimelineSummary['last_vitals'] {
  if (!observations.length) return null;

  let systolic: number | null = null;
  let diastolic: number | null = null;
  let heartRate: number | null = null;
  let temperature: number | null = null;
  let oxygenSaturation: number | null = null;
  let latestTimestamp: string | null = null;

  // Observations are returned newest-first by ObservationService
  for (const obs of observations) {
    const value = obs.value_quantity_value ?? null;
    if (value === null) continue;

    // Track the most recent timestamp
    if (!latestTimestamp && obs.effective_datetime) {
      latestTimestamp = obs.effective_datetime;
    }

    switch (obs.code) {
      case LOINC_SYSTOLIC_BP:
        if (systolic === null) systolic = value;
        break;
      case LOINC_DIASTOLIC_BP:
        if (diastolic === null) diastolic = value;
        break;
      case LOINC_HEART_RATE:
        if (heartRate === null) heartRate = value;
        break;
      case LOINC_TEMPERATURE:
        if (temperature === null) temperature = value;
        break;
      case LOINC_OXYGEN_SATURATION:
        if (oxygenSaturation === null) oxygenSaturation = value;
        break;
    }
  }

  if (!latestTimestamp) return null;

  const bloodPressure =
    systolic !== null && diastolic !== null ? `${systolic}/${diastolic}` : null;

  return {
    timestamp: latestTimestamp,
    blood_pressure: bloodPressure,
    heart_rate: heartRate,
    temperature,
    oxygen_saturation: oxygenSaturation,
  };
}

/**
 * Extract last encounter from EncounterService results
 */
function extractLastEncounter(
  encounters: Record<string, unknown>[]
): PatientTimelineSummary['last_encounter'] {
  if (!encounters.length) return null;

  const latest = encounters[0];
  const timestamp = latest.period_start ? String(latest.period_start) : null;
  if (!timestamp) return null;

  return {
    timestamp,
    encounter_type: String(latest.class_display ?? latest.type_display ?? 'Visit'),
    provider_name: latest.participant_display ? String(latest.participant_display) : null,
    diagnosis_summary: latest.reason_code_display ? String(latest.reason_code_display) : null,
  };
}

/**
 * Fetch timeline summary with FHIR integrations
 */
export async function fetchTimeline(
  patientId: PatientId,
  days: number,
  maxEvents: number
): Promise<FetchResult<PatientTimelineSummary>> {
  const fetchedAt = new Date().toISOString();
  const warnings: string[] = [];

  try {
    // Fetch last check-in from community check_ins table
    const { data: checkInData } = await supabase
      .from('check_ins')
      .select('id, user_id, created_at, label, emotional_state, heart_rate, bp_systolic, bp_diastolic, glucose_mg_dl, pulse_oximeter, notes, is_emergency')
      .eq('user_id', patientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const lastCheckIn = checkInData as CheckInRow | null;

    // Build recent events from check-in
    const events: TimelineEvent[] = [];
    if (lastCheckIn) {
      events.push({
        event_id: String(lastCheckIn.id),
        event_type: 'check_in',
        timestamp: lastCheckIn.created_at,
        description: lastCheckIn.label ?? 'Daily check-in completed',
        severity: lastCheckIn.is_emergency ? 'critical' : 'info',
        related_entity_id: String(lastCheckIn.id),
        related_entity_type: 'check_ins',
      });
    }

    // Calculate days since last contact
    let daysSinceLastContact: number | null = null;
    if (lastCheckIn) {
      const lastDate = new Date(lastCheckIn.created_at);
      const now = new Date();
      daysSinceLastContact = Math.floor(
        (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    // Fetch last vitals from FHIR ObservationService (graceful degradation)
    let lastVitals: PatientTimelineSummary['last_vitals'] = null;
    try {
      const vitalsResult = await ObservationService.getVitalSigns(patientId, days);
      if (vitalsResult.success && vitalsResult.data) {
        lastVitals = extractLatestVitals(vitalsResult.data);
      } else if (vitalsResult.error) {
        warnings.push(`Vitals fetch: ${vitalsResult.error}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      warnings.push(`Vitals fetch failed: ${msg}`);
      await auditLogger.warn('PATIENT_CONTEXT_VITALS_FETCH_FAILED', {
        patientId,
        error: msg,
      });
    }

    // Fetch last encounter from EncounterService (graceful degradation)
    let lastEncounter: PatientTimelineSummary['last_encounter'] = null;
    try {
      const encounters = await EncounterService.getAll(patientId);
      lastEncounter = extractLastEncounter(encounters);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      warnings.push(`Encounter fetch failed: ${msg}`);
      await auditLogger.warn('PATIENT_CONTEXT_ENCOUNTER_FETCH_FAILED', {
        patientId,
        error: msg,
      });
    }

    // Fetch active alerts count (graceful degradation)
    let activeAlertsCount = 0;
    try {
      const { count, error: alertError } = await supabase
        .from('care_team_alerts')
        .select('id', { count: 'exact', head: true })
        .eq('patient_id', patientId)
        .eq('status', 'active');

      if (!alertError && count !== null) {
        activeAlertsCount = count;
      } else if (alertError) {
        warnings.push(`Alerts count: ${alertError.message}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      warnings.push(`Alert count failed: ${msg}`);
      await auditLogger.warn('PATIENT_CONTEXT_ALERTS_FETCH_FAILED', {
        patientId,
        error: msg,
      });
    }

    const timeline: PatientTimelineSummary = {
      last_check_in: lastCheckIn
        ? {
            timestamp: lastCheckIn.created_at,
            wellness_score: null,
            mood: lastCheckIn.emotional_state,
            concerns: lastCheckIn.notes ? [lastCheckIn.notes] : [],
          }
        : null,
      last_vitals: lastVitals,
      last_encounter: lastEncounter,
      active_alerts_count: activeAlertsCount,
      recent_events: events.slice(0, maxEvents),
      days_since_last_contact: daysSinceLastContact,
    };

    const dataSources = ['check_ins', 'fhir_observations', 'encounters', 'care_team_alerts'];

    return {
      success: true,
      data: timeline,
      source: {
        source: dataSources.join(' + '),
        fetched_at: fetchedAt,
        success: true,
        record_count: events.length,
        note: warnings.length > 0 ? warnings.join('; ') : null,
      },
    };
  } catch (err: unknown) {
    return {
      success: false,
      data: null,
      source: {
        source: 'check_ins',
        fetched_at: fetchedAt,
        success: false,
        record_count: 0,
        note: err instanceof Error ? err.message : 'Unknown error',
      },
    };
  }
}
