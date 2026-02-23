/**
 * Enhanced FHIR Service — Data Fetching
 *
 * Handles fetching comprehensive patient data, population data,
 * recent check-ins, and cache management.
 *
 * MIGRATION (Phase 3): Now delegates to patientContextService for
 * patient data fetching. Adapter preserves ComprehensivePatientData
 * shape for backward compatibility with all downstream consumers.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { patientContextService } from '../../../services/patient-context';
import type { PatientContext } from '../../../types/patientContext';
import type {
  ComprehensivePatientData,
  CheckInRecord,
  CacheEntry,
  VitalsEntry,
} from './types';

/**
 * Cache management utilities for the enhanced FHIR service.
 */
export class DataCache {
  private cache: Map<string, CacheEntry>;

  constructor() {
    this.cache = new Map();
  }

  getFromCache<T extends ComprehensivePatientData | ComprehensivePatientData[]>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.timestamp + cached.ttl) {
      return cached.data as T;
    }
    this.cache.delete(key);
    return null;
  }

  setCache(key: string, data: ComprehensivePatientData | ComprehensivePatientData[], ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }
}

/**
 * Adapt PatientContext (canonical) to ComprehensivePatientData (legacy shape).
 *
 * Preserves the exact interface consumers expect (profile, checkIns, vitals,
 * healthEntries) while sourcing data from the canonical patientContextService.
 */
function adaptContextToLegacy(context: PatientContext): ComprehensivePatientData {
  const { demographics, timeline, self_reports } = context;

  // Build profile from demographics (matches PatientProfile interface)
  // Convert null → undefined to match PatientProfile's optional fields
  const profile = {
    id: demographics.patient_id,
    user_id: demographics.patient_id,
    first_name: demographics.first_name ?? undefined,
    last_name: demographics.last_name ?? undefined,
    dob: demographics.dob ?? undefined,
    phone: demographics.phone ?? undefined,
  };

  // Build self-report entries (healthEntries) from canonical self_reports
  const healthEntries: VitalsEntry[] = (self_reports?.recent_reports ?? []).map(report => ({
    created_at: report.created_at,
    bp_systolic: report.bp_systolic ?? undefined,
    bp_diastolic: report.bp_diastolic ?? undefined,
    heart_rate: report.heart_rate ?? undefined,
    blood_sugar: report.blood_sugar ?? undefined,
    blood_oxygen: report.blood_oxygen ?? undefined,
    weight: report.weight ?? undefined,
    mood: report.mood ?? undefined,
    physical_activity: report.physical_activity ?? undefined,
    social_engagement: report.social_engagement ?? undefined,
    symptoms: report.symptoms ?? undefined,
    activity_description: report.activity_description ?? undefined,
  }));

  // Build check-in records from timeline events
  const checkIns: CheckInRecord[] = (timeline?.recent_events ?? [])
    .filter(e => e.event_type === 'check_in')
    .map(e => ({
      user_id: demographics.patient_id,
      created_at: e.timestamp,
    }));

  // Merge all vitals (check-ins + self-reports), sorted newest first
  const allVitals: VitalsEntry[] = [
    ...checkIns.map(ci => ({ created_at: ci.created_at } as VitalsEntry)),
    ...healthEntries,
  ].sort((a, b) =>
    new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
  );

  return {
    profile,
    checkIns,
    vitals: allVitals,
    healthEntries,
  };
}

/**
 * Fetch comprehensive patient data including profile, check-ins, and self-reports.
 *
 * Delegates to patientContextService.getPatientContext() and adapts the result
 * to the legacy ComprehensivePatientData shape for backward compatibility.
 *
 * @param _supabaseClient - Retained for API compatibility (no longer used internally)
 * @param dataCache - Cache instance for TTL-based caching
 * @param userId - Patient UUID
 */
export async function fetchComprehensivePatientData(
  _supabaseClient: SupabaseClient,
  dataCache: DataCache,
  userId: string
): Promise<ComprehensivePatientData> {
  const cacheKey = `patient-${userId}`;
  const cached = dataCache.getFromCache<ComprehensivePatientData>(cacheKey);
  if (cached) return cached;

  const result = await patientContextService.getPatientContext(userId, {
    includeTimeline: true,
    includeSelfReports: true,
    includeHospitalDetails: false,
    includeContacts: false,
    includeRisk: false,
    includeCarePlan: false,
    maxSelfReports: 50,
  });

  if (!result.success) {
    throw new Error(`Failed to fetch patient context: ${result.error}`);
  }

  const data = adaptContextToLegacy(result.data);
  dataCache.setCache(cacheKey, data, 300000); // 5 minutes TTL
  return data;
}

/**
 * Fetch population-level data for all patients.
 *
 * Uses getBatchDemographics() for efficient bulk profile fetch,
 * then parallel getPatientContext() calls for full data.
 *
 * @param supabaseClient - Used only for initial patient ID list query
 * @param dataCache - Cache instance for TTL-based caching
 */
export async function fetchPopulationData(
  supabaseClient: SupabaseClient,
  dataCache: DataCache
): Promise<ComprehensivePatientData[]> {
  const cacheKey = 'population-data';
  const cached = dataCache.getFromCache<ComprehensivePatientData[]>(cacheKey);
  if (cached) return cached;

  // Get all patient IDs (minimal query)
  const { data: profiles } = await supabaseClient
    .from('profiles')
    .select('user_id');

  const patientIds = (profiles ?? []).map(
    (p: { user_id: string }) => p.user_id
  );

  if (patientIds.length === 0) {
    return [];
  }

  // Parallel fetch: each patient gets a full context call
  // (patientContextService handles its own per-patient caching internally)
  const results = await Promise.all(
    patientIds.map(async (patientId) => {
      try {
        return await fetchComprehensivePatientData(
          supabaseClient,
          dataCache,
          patientId
        );
      } catch {
        // Return minimal data if fetch fails for this patient
        return {
          profile: { id: patientId, user_id: patientId },
          checkIns: [],
          vitals: [],
          healthEntries: [],
        };
      }
    })
  );

  dataCache.setCache(cacheKey, results, 600000); // 10 minutes TTL
  return results;
}

/**
 * Fetch check-ins from the last 15 minutes for real-time monitoring.
 *
 * NOTE: This is intentionally NOT migrated to patientContextService.
 * It queries a time-window across ALL patients (not per-patient context).
 * Per CLAUDE.md: "Direct query is OK" for single-purpose lookups.
 */
export async function fetchRecentCheckIns(
  supabaseClient: SupabaseClient
): Promise<CheckInRecord[]> {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

  const { data } = await supabaseClient
    .from('check_ins')
    .select('user_id, created_at, id')
    .gte('created_at', fifteenMinutesAgo.toISOString());

  return data || [];
}
