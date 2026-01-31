/**
 * Patient Context Service
 *
 * CANONICAL ENTRY POINT for all patient data access.
 *
 * ATLUS Requirements:
 * - Unity: Single source of truth for patient context
 * - Accountability: Full traceability via context_meta
 *
 * ============================================================================
 * DO NOT QUERY PATIENT TABLES DIRECTLY FROM OTHER SERVICES
 * ============================================================================
 *
 * Use this service as the single entry point for patient context.
 * This ensures:
 * 1. Consistent data shapes across all modules
 * 2. Centralized joins (no ad-hoc scattered queries)
 * 3. Traceability metadata on every fetch
 * 4. Proper audit logging
 *
 * @example
 * // Basic usage
 * const result = await patientContextService.getPatientContext(patientId);
 * if (result.success) {
 *   const { demographics, contacts, timeline, context_meta } = result.data;
 * }
 *
 * @example
 * // Minimal fetch (demographics only)
 * const result = await patientContextService.getPatientContext(patientId, {
 *   includeContacts: false,
 *   includeTimeline: false,
 * });
 *
 * @module patientContextService
 * Copyright 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure } from './_base/ServiceResult';
import {
  PatientId,
  PatientContext,
  PatientDemographics,
  HospitalPatientDetails,
  PatientContactGraph,
  PatientContact,
  ContactRelationType,
  PatientTimelineSummary,
  TimelineEvent,
  PatientRiskSummary,
  PatientCarePlanSummary,
  PatientContextMeta,
  PatientContextOptions,
  DataSourceRecord,
  DEFAULT_PATIENT_CONTEXT_OPTIONS,
  PatientRiskLevel,
} from '../types/patientContext';

// =============================================================================
// INTERNAL TYPES
// =============================================================================

/**
 * Internal profile row shape (from profiles table)
 *
 * Note: Currently (Phase 1), profiles.user_id === patient_id (same UUID).
 * This mapping is abstracted here so when caregiver/proxy access is added,
 * only this service needs to change - not consumers.
 */
interface ProfileRow {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  dob: string | null;
  gender: string | null;
  phone: string | null;
  preferred_language: string | null;
  enrollment_type: 'app' | 'hospital' | null;
  tenant_id: string | null;
  mrn: string | null;
  hospital_unit: string | null;
  room_number: string | null;
  bed_number: string | null;
  acuity_level: number | null;
  code_status: string | null;
  admission_date: string | null;
  attending_physician_id: string | null;
}

/**
 * Internal admission row shape
 */
interface AdmissionRow {
  id: string;
  patient_id: string;
  room_number: string | null;
  facility_unit: string | null;
  admission_date: string;
  is_active: boolean;
  admission_diagnosis: string | null;
  attending_physician_id: string | null;
}

/**
 * Internal check-in row shape
 */
interface CheckInRow {
  id: string;
  user_id: string;
  check_in_date: string;
  wellness_score: number | null;
  mood: string | null;
  concerns: string[] | null;
}

/**
 * Internal care plan row shape
 */
interface CarePlanRow {
  id: string;
  patient_id: string;
  plan_type: string;
  status: string;
  title: string;
  goals: unknown;
  next_review_date: string | null;
  primary_coordinator_id: string | null;
}

// =============================================================================
// SERVICE CLASS
// =============================================================================

class PatientContextService {
  /**
   * Fetch canonical patient context
   *
   * This is THE method to use for getting patient data.
   * Do not query patient tables directly.
   *
   * @param patientId - The patient's UUID (from auth.users.id)
   * @param options - What data to include (defaults are sensible)
   * @returns ServiceResult containing PatientContext or error
   */
  async getPatientContext(
    patientId: PatientId,
    options: PatientContextOptions = {}
  ): Promise<ServiceResult<PatientContext>> {
    const startTime = Date.now();
    const requestId = `pctx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    // Merge with defaults
    const opts: Required<PatientContextOptions> = {
      ...DEFAULT_PATIENT_CONTEXT_OPTIONS,
      ...options,
    };

    const dataSources: DataSourceRecord[] = [];
    const warnings: string[] = [];

    try {
      // -----------------------------------------------------------------------
      // 1. Fetch core demographics (always required)
      // -----------------------------------------------------------------------
      const demographicsResult = await this.fetchDemographics(patientId);
      dataSources.push(demographicsResult.source);

      if (!demographicsResult.success || !demographicsResult.data) {
        await auditLogger.warn('PATIENT_CONTEXT_NOT_FOUND', {
          requestId,
          patientId,
        });
        return failure('NOT_FOUND', `Patient not found: ${patientId}`);
      }

      const demographics = demographicsResult.data;

      // -----------------------------------------------------------------------
      // 2. Fetch optional sections in parallel
      // -----------------------------------------------------------------------
      const [
        hospitalDetailsResult,
        contactsResult,
        timelineResult,
        riskResult,
        carePlanResult,
      ] = await Promise.all([
        opts.includeHospitalDetails
          ? this.fetchHospitalDetails(patientId)
          : Promise.resolve(null),
        opts.includeContacts
          ? this.fetchContacts(patientId)
          : Promise.resolve(null),
        opts.includeTimeline
          ? this.fetchTimeline(patientId, opts.timelineDays, opts.maxTimelineEvents)
          : Promise.resolve(null),
        opts.includeRisk
          ? this.fetchRiskSummary(patientId)
          : Promise.resolve(null),
        opts.includeCarePlan
          ? this.fetchCarePlanSummary(patientId)
          : Promise.resolve(null),
      ]);

      // Collect data sources
      if (hospitalDetailsResult) {
        dataSources.push(hospitalDetailsResult.source);
        if (!hospitalDetailsResult.success) {
          warnings.push('Hospital details fetch failed');
        }
      }
      if (contactsResult) {
        dataSources.push(contactsResult.source);
        if (!contactsResult.success) {
          warnings.push('Contacts fetch failed');
        }
      }
      if (timelineResult) {
        dataSources.push(timelineResult.source);
        if (!timelineResult.success) {
          warnings.push('Timeline fetch failed');
        }
      }
      if (riskResult) {
        dataSources.push(riskResult.source);
        if (!riskResult.success) {
          warnings.push('Risk summary fetch failed');
        }
      }
      if (carePlanResult) {
        dataSources.push(carePlanResult.source);
        if (!carePlanResult.success) {
          warnings.push('Care plan fetch failed');
        }
      }

      // -----------------------------------------------------------------------
      // 3. Build context metadata
      // -----------------------------------------------------------------------
      const fetchDuration = Date.now() - startTime;
      const generatedAt = new Date().toISOString();

      const contextMeta: PatientContextMeta = {
        generated_at: generatedAt,
        request_id: requestId,
        options_requested: opts,
        data_sources: dataSources,
        data_freshness: this.assessFreshness(dataSources),
        freshness_threshold_minutes: 5,
        warnings,
        fetch_duration_ms: fetchDuration,
      };

      // -----------------------------------------------------------------------
      // 4. Assemble final context
      // -----------------------------------------------------------------------
      const context: PatientContext = {
        demographics,
        hospital_details: hospitalDetailsResult?.data ?? null,
        contacts: contactsResult?.data ?? null,
        timeline: timelineResult?.data ?? null,
        risk: riskResult?.data ?? null,
        care_plan: carePlanResult?.data ?? null,
        context_meta: contextMeta,
      };

      // Log PHI access
      await auditLogger.phi('READ', patientId, {
        resourceType: 'patient_context',
        requestId,
        optionsUsed: opts,
        fetchDurationMs: fetchDuration,
      });

      return success(context);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('PATIENT_CONTEXT_FETCH_ERROR', error, {
        patientId,
        requestId,
      });
      return failure('DATABASE_ERROR', error.message, error);
    }
  }

  // ===========================================================================
  // PRIVATE FETCH METHODS
  // ===========================================================================

  /**
   * Fetch core demographics from profiles table
   */
  private async fetchDemographics(
    patientId: PatientId
  ): Promise<{
    success: boolean;
    data: PatientDemographics | null;
    source: DataSourceRecord;
  }> {
    const fetchedAt = new Date().toISOString();

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          user_id,
          first_name,
          last_name,
          dob,
          gender,
          phone,
          preferred_language,
          enrollment_type,
          tenant_id,
          mrn
        `)
        .eq('user_id', patientId)
        .single();

      if (error) {
        return {
          success: false,
          data: null,
          source: {
            source: 'profiles',
            fetched_at: fetchedAt,
            success: false,
            record_count: 0,
            note: error.message,
          },
        };
      }

      const row = data as ProfileRow;

      const demographics: PatientDemographics = {
        patient_id: row.user_id, // Note: user_id IS patient_id
        first_name: row.first_name,
        last_name: row.last_name,
        dob: row.dob,
        gender: row.gender,
        phone: row.phone,
        preferred_language: row.preferred_language,
        enrollment_type: row.enrollment_type,
        tenant_id: row.tenant_id,
        mrn: row.mrn,
      };

      return {
        success: true,
        data: demographics,
        source: {
          source: 'profiles',
          fetched_at: fetchedAt,
          success: true,
          record_count: 1,
          note: null,
        },
      };
    } catch (err: unknown) {
      return {
        success: false,
        data: null,
        source: {
          source: 'profiles',
          fetched_at: fetchedAt,
          success: false,
          record_count: 0,
          note: err instanceof Error ? err.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Fetch hospital-specific details
   */
  private async fetchHospitalDetails(
    patientId: PatientId
  ): Promise<{
    success: boolean;
    data: HospitalPatientDetails | null;
    source: DataSourceRecord;
  }> {
    const fetchedAt = new Date().toISOString();

    try {
      // First get active admission
      const { data: admissionData, error: admissionError } = await supabase
        .from('patient_admissions')
        .select('*')
        .eq('patient_id', patientId)
        .eq('is_active', true)
        .single();

      // Also get profile hospital fields as fallback
      const { data: profileData } = await supabase
        .from('profiles')
        .select(`
          hospital_unit,
          room_number,
          bed_number,
          acuity_level,
          code_status,
          admission_date,
          attending_physician_id
        `)
        .eq('user_id', patientId)
        .single();

      const profile = profileData as ProfileRow | null;
      const admission = admissionData as AdmissionRow | null;

      // Use admission data if active, otherwise use profile
      const details: HospitalPatientDetails = {
        hospital_unit: admission?.facility_unit ?? profile?.hospital_unit ?? null,
        room_number: admission?.room_number ?? profile?.room_number ?? null,
        bed_number: profile?.bed_number ?? null,
        acuity_level: profile?.acuity_level ?? null,
        code_status: profile?.code_status ?? null,
        admission_date: admission?.admission_date ?? profile?.admission_date ?? null,
        attending_physician_id:
          admission?.attending_physician_id ?? profile?.attending_physician_id ?? null,
        primary_diagnosis: admission?.admission_diagnosis ?? null,
        is_admitted: !admissionError && !!admission,
      };

      return {
        success: true,
        data: details,
        source: {
          source: 'patient_admissions + profiles',
          fetched_at: fetchedAt,
          success: true,
          record_count: admission ? 1 : 0,
          note: admission ? 'Active admission found' : 'No active admission',
        },
      };
    } catch (err: unknown) {
      return {
        success: false,
        data: null,
        source: {
          source: 'patient_admissions',
          fetched_at: fetchedAt,
          success: false,
          record_count: 0,
          note: err instanceof Error ? err.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Fetch patient contacts (caregivers, emergency contacts, providers)
   */
  private async fetchContacts(
    patientId: PatientId
  ): Promise<{
    success: boolean;
    data: PatientContactGraph | null;
    source: DataSourceRecord;
  }> {
    const fetchedAt = new Date().toISOString();

    try {
      // Query caregiver_access table for registered caregivers
      const { data: caregiverData, error: caregiverError } = await supabase
        .from('caregiver_access')
        .select('*')
        .eq('senior_id', patientId)
        .eq('is_active', true);

      // Query emergency_contacts table if it exists
      const { data: emergencyData } = await supabase
        .from('emergency_contacts')
        .select('*')
        .eq('patient_id', patientId);

      // Transform caregivers
      const caregivers: PatientContact[] = (caregiverData || []).map((row: Record<string, unknown>) => ({
        contact_id: String(row.id ?? ''),
        user_id: String(row.caregiver_id ?? ''),
        relationship: 'caregiver' as ContactRelationType,
        name: String(row.caregiver_name ?? row.name ?? 'Caregiver'),
        phone: row.phone ? String(row.phone) : null,
        email: row.email ? String(row.email) : null,
        permission_level: 'full_access' as const,
        is_primary: Boolean(row.is_primary ?? false),
        notifications_enabled: true,
        preferred_contact_method: null,
        notes: null,
        created_at: String(row.created_at ?? fetchedAt),
        updated_at: row.updated_at ? String(row.updated_at) : null,
      }));

      // Transform emergency contacts
      const emergencyContacts: PatientContact[] = (emergencyData || []).map((row: Record<string, unknown>) => ({
        contact_id: String(row.id ?? ''),
        user_id: null,
        relationship: 'emergency_contact' as ContactRelationType,
        name: String(row.name ?? 'Emergency Contact'),
        phone: row.phone ? String(row.phone) : null,
        email: row.email ? String(row.email) : null,
        permission_level: 'emergency_only' as const,
        is_primary: Boolean(row.is_primary ?? false),
        notifications_enabled: true,
        preferred_contact_method: 'phone',
        notes: row.relationship_to_patient ? String(row.relationship_to_patient) : null,
        created_at: String(row.created_at ?? fetchedAt),
        updated_at: row.updated_at ? String(row.updated_at) : null,
      }));

      const contactGraph: PatientContactGraph = {
        emergency_contacts: emergencyContacts,
        caregivers,
        providers: [], // TODO: Integrate with practitioner services
        care_team: [], // TODO: Integrate with care coordination
        summary: {
          total_contacts: caregivers.length + emergencyContacts.length,
          active_caregivers: caregivers.length,
          active_providers: 0,
        },
      };

      return {
        success: true,
        data: contactGraph,
        source: {
          source: 'caregiver_access + emergency_contacts',
          fetched_at: fetchedAt,
          success: !caregiverError,
          record_count: caregivers.length + emergencyContacts.length,
          note: caregiverError ? caregiverError.message : null,
        },
      };
    } catch (err: unknown) {
      return {
        success: false,
        data: null,
        source: {
          source: 'caregiver_access',
          fetched_at: fetchedAt,
          success: false,
          record_count: 0,
          note: err instanceof Error ? err.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Fetch timeline summary (recent events, last check-in, etc.)
   */
  private async fetchTimeline(
    patientId: PatientId,
    days: number,
    maxEvents: number
  ): Promise<{
    success: boolean;
    data: PatientTimelineSummary | null;
    source: DataSourceRecord;
  }> {
    const fetchedAt = new Date().toISOString();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    try {
      // Fetch last check-in
      const { data: checkInData } = await supabase
        .from('daily_check_ins')
        .select('*')
        .eq('user_id', patientId)
        .order('check_in_date', { ascending: false })
        .limit(1)
        .single();

      const lastCheckIn = checkInData as CheckInRow | null;

      // Fetch recent events (simplified - would expand for full implementation)
      const events: TimelineEvent[] = [];

      if (lastCheckIn) {
        events.push({
          event_id: lastCheckIn.id,
          event_type: 'check_in',
          timestamp: lastCheckIn.check_in_date,
          description: `Daily check-in completed`,
          severity: 'info',
          related_entity_id: lastCheckIn.id,
          related_entity_type: 'daily_check_ins',
        });
      }

      // Calculate days since last contact
      let daysSinceLastContact: number | null = null;
      if (lastCheckIn) {
        const lastDate = new Date(lastCheckIn.check_in_date);
        const now = new Date();
        daysSinceLastContact = Math.floor(
          (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
        );
      }

      const timeline: PatientTimelineSummary = {
        last_check_in: lastCheckIn
          ? {
              timestamp: lastCheckIn.check_in_date,
              wellness_score: lastCheckIn.wellness_score,
              mood: lastCheckIn.mood,
              concerns: lastCheckIn.concerns || [],
            }
          : null,
        last_vitals: null, // TODO: Integrate with vitals observations
        last_encounter: null, // TODO: Integrate with encounters
        active_alerts_count: 0, // TODO: Integrate with alerts
        recent_events: events.slice(0, maxEvents),
        days_since_last_contact: daysSinceLastContact,
      };

      return {
        success: true,
        data: timeline,
        source: {
          source: 'daily_check_ins',
          fetched_at: fetchedAt,
          success: true,
          record_count: events.length,
          note: null,
        },
      };
    } catch (err: unknown) {
      return {
        success: false,
        data: null,
        source: {
          source: 'daily_check_ins',
          fetched_at: fetchedAt,
          success: false,
          record_count: 0,
          note: err instanceof Error ? err.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Fetch risk assessment summary
   */
  private async fetchRiskSummary(
    patientId: PatientId
  ): Promise<{
    success: boolean;
    data: PatientRiskSummary | null;
    source: DataSourceRecord;
  }> {
    const fetchedAt = new Date().toISOString();

    try {
      // Try patient_risk_registry first
      const { data: riskData, error: riskError } = await supabase
        .from('patient_risk_registry')
        .select('*')
        .eq('patient_id', patientId)
        .order('last_assessment_date', { ascending: false })
        .limit(1)
        .single();

      if (riskError && riskError.code !== 'PGRST116') {
        // Table might not exist or other error - return default
        return {
          success: true,
          data: this.getDefaultRiskSummary(),
          source: {
            source: 'patient_risk_registry',
            fetched_at: fetchedAt,
            success: true,
            record_count: 0,
            note: 'No risk assessment found, using defaults',
          },
        };
      }

      if (!riskData) {
        return {
          success: true,
          data: this.getDefaultRiskSummary(),
          source: {
            source: 'patient_risk_registry',
            fetched_at: fetchedAt,
            success: true,
            record_count: 0,
            note: 'No risk assessment found',
          },
        };
      }

      const row = riskData as Record<string, unknown>;

      const riskSummary: PatientRiskSummary = {
        risk_level: (row.risk_level as PatientRiskLevel) || 'low',
        risk_score: typeof row.risk_score === 'number' ? row.risk_score : null,
        risk_factors: Array.isArray(row.risk_factors) ? row.risk_factors as string[] : [],
        last_assessment_date: row.last_assessment_date ? String(row.last_assessment_date) : null,
        readmission_risk_30day:
          typeof row.readmission_risk_30day === 'number' ? row.readmission_risk_30day : null,
        fall_risk_score: typeof row.fall_risk_score === 'number' ? row.fall_risk_score : null,
      };

      return {
        success: true,
        data: riskSummary,
        source: {
          source: 'patient_risk_registry',
          fetched_at: fetchedAt,
          success: true,
          record_count: 1,
          note: null,
        },
      };
    } catch (err: unknown) {
      return {
        success: false,
        data: this.getDefaultRiskSummary(),
        source: {
          source: 'patient_risk_registry',
          fetched_at: fetchedAt,
          success: false,
          record_count: 0,
          note: err instanceof Error ? err.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Fetch care plan summary
   */
  private async fetchCarePlanSummary(
    patientId: PatientId
  ): Promise<{
    success: boolean;
    data: PatientCarePlanSummary | null;
    source: DataSourceRecord;
  }> {
    const fetchedAt = new Date().toISOString();

    try {
      const { data: planData, error: planError } = await supabase
        .from('care_coordination_plans')
        .select('*')
        .eq('patient_id', patientId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (planError && planError.code !== 'PGRST116') {
        return {
          success: true,
          data: this.getDefaultCarePlanSummary(),
          source: {
            source: 'care_coordination_plans',
            fetched_at: fetchedAt,
            success: true,
            record_count: 0,
            note: 'No active care plan found',
          },
        };
      }

      if (!planData) {
        return {
          success: true,
          data: this.getDefaultCarePlanSummary(),
          source: {
            source: 'care_coordination_plans',
            fetched_at: fetchedAt,
            success: true,
            record_count: 0,
            note: 'No active care plan',
          },
        };
      }

      const row = planData as CarePlanRow;

      // Extract primary goal from goals array
      let primaryGoal: string | null = null;
      if (row.goals && Array.isArray(row.goals) && row.goals.length > 0) {
        const firstGoal = row.goals[0] as Record<string, unknown>;
        primaryGoal = firstGoal.goal ? String(firstGoal.goal) : null;
      }

      const carePlanSummary: PatientCarePlanSummary = {
        active_plan_id: row.id,
        plan_type: row.plan_type,
        plan_status: row.status as PatientCarePlanSummary['plan_status'],
        primary_goal: primaryGoal,
        next_review_date: row.next_review_date,
        care_coordinator_name: null, // Would require join with profiles
      };

      return {
        success: true,
        data: carePlanSummary,
        source: {
          source: 'care_coordination_plans',
          fetched_at: fetchedAt,
          success: true,
          record_count: 1,
          note: null,
        },
      };
    } catch (err: unknown) {
      return {
        success: false,
        data: this.getDefaultCarePlanSummary(),
        source: {
          source: 'care_coordination_plans',
          fetched_at: fetchedAt,
          success: false,
          record_count: 0,
          note: err instanceof Error ? err.message : 'Unknown error',
        },
      };
    }
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  /**
   * Default risk summary when no data available
   */
  private getDefaultRiskSummary(): PatientRiskSummary {
    return {
      risk_level: 'low',
      risk_score: null,
      risk_factors: [],
      last_assessment_date: null,
      readmission_risk_30day: null,
      fall_risk_score: null,
    };
  }

  /**
   * Default care plan summary when no data available
   */
  private getDefaultCarePlanSummary(): PatientCarePlanSummary {
    return {
      active_plan_id: null,
      plan_type: null,
      plan_status: null,
      primary_goal: null,
      next_review_date: null,
      care_coordinator_name: null,
    };
  }

  /**
   * Assess overall data freshness
   */
  private assessFreshness(
    sources: DataSourceRecord[]
  ): 'real_time' | 'recent' | 'stale' {
    const fiveMinutesAgo = new Date();
    fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);

    const allRecent = sources.every((s) => {
      const fetchTime = new Date(s.fetched_at);
      return fetchTime > fiveMinutesAgo;
    });

    if (allRecent) return 'real_time';

    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const anyStale = sources.some((s) => {
      const fetchTime = new Date(s.fetched_at);
      return fetchTime < oneHourAgo;
    });

    return anyStale ? 'stale' : 'recent';
  }

  // ===========================================================================
  // CONVENIENCE METHODS
  // ===========================================================================

  /**
   * Quick check if patient exists
   */
  async patientExists(patientId: PatientId): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('user_id', patientId)
        .single();

      return !error && !!data;
    } catch {
      return false;
    }
  }

  /**
   * Get minimal patient context (just demographics)
   */
  async getMinimalContext(
    patientId: PatientId
  ): Promise<ServiceResult<PatientContext>> {
    return this.getPatientContext(patientId, {
      includeContacts: false,
      includeTimeline: false,
      includeRisk: false,
      includeCarePlan: false,
      includeHospitalDetails: false,
    });
  }

  /**
   * Get full patient context (all sections)
   */
  async getFullContext(
    patientId: PatientId
  ): Promise<ServiceResult<PatientContext>> {
    return this.getPatientContext(patientId, {
      includeContacts: true,
      includeTimeline: true,
      includeRisk: true,
      includeCarePlan: true,
      includeHospitalDetails: true,
    });
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const patientContextService = new PatientContextService();

// Export class for testing
export { PatientContextService };
