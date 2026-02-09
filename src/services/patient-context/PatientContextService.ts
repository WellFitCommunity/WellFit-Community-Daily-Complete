/**
 * Patient Context Service — Orchestrator
 *
 * CANONICAL ENTRY POINT for all patient data access.
 *
 * ATLUS Requirements:
 * - Unity: Single source of truth for patient context
 * - Accountability: Full traceability via context_meta
 *
 * This class orchestrates parallel fetches across all context modules
 * and assembles the final PatientContext with metadata.
 *
 * @module patient-context/PatientContextService
 * Copyright 2025-2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';
import { ServiceResult, success, failure } from '../_base/ServiceResult';
import type {
  PatientId,
  PatientContext,
  PatientContextMeta,
  PatientContextOptions,
  DataSourceRecord,
} from '../../types/patientContext';
import { DEFAULT_PATIENT_CONTEXT_OPTIONS } from '../../types/patientContext';
import { assessFreshness } from './helpers';
import { fetchDemographics } from './fetchDemographics';
import { fetchHospitalDetails } from './fetchHospitalDetails';
import { fetchContacts } from './fetchContacts';
import { fetchTimeline } from './fetchTimeline';
import { fetchRiskSummary } from './fetchRiskSummary';
import { fetchCarePlanSummary } from './fetchCarePlanSummary';

export class PatientContextService {
  /**
   * Fetch canonical patient context
   *
   * This is THE method to use for getting patient data.
   * Do not query patient tables directly.
   */
  async getPatientContext(
    patientId: PatientId,
    options: PatientContextOptions = {}
  ): Promise<ServiceResult<PatientContext>> {
    const startTime = Date.now();
    const requestId = `pctx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const opts: Required<PatientContextOptions> = {
      ...DEFAULT_PATIENT_CONTEXT_OPTIONS,
      ...options,
    };

    const dataSources: DataSourceRecord[] = [];
    const warnings: string[] = [];

    try {
      // 1. Fetch core demographics (always required)
      const demographicsResult = await fetchDemographics(patientId);
      dataSources.push(demographicsResult.source);

      if (!demographicsResult.success || !demographicsResult.data) {
        await auditLogger.warn('PATIENT_CONTEXT_NOT_FOUND', {
          requestId,
          patientId,
        });
        return failure('NOT_FOUND', `Patient not found: ${patientId}`);
      }

      const demographics = demographicsResult.data;

      // 2. Fetch optional sections in parallel
      const [
        hospitalDetailsResult,
        contactsResult,
        timelineResult,
        riskResult,
        carePlanResult,
      ] = await Promise.all([
        opts.includeHospitalDetails
          ? fetchHospitalDetails(patientId)
          : Promise.resolve(null),
        opts.includeContacts
          ? fetchContacts(patientId)
          : Promise.resolve(null),
        opts.includeTimeline
          ? fetchTimeline(patientId, opts.timelineDays, opts.maxTimelineEvents)
          : Promise.resolve(null),
        opts.includeRisk
          ? fetchRiskSummary(patientId)
          : Promise.resolve(null),
        opts.includeCarePlan
          ? fetchCarePlanSummary(patientId)
          : Promise.resolve(null),
      ]);

      // Collect data sources and warnings
      if (hospitalDetailsResult) {
        dataSources.push(hospitalDetailsResult.source);
        if (!hospitalDetailsResult.success) warnings.push('Hospital details fetch failed');
      }
      if (contactsResult) {
        dataSources.push(contactsResult.source);
        if (!contactsResult.success) warnings.push('Contacts fetch failed');
      }
      if (timelineResult) {
        dataSources.push(timelineResult.source);
        if (!timelineResult.success) warnings.push('Timeline fetch failed');
      }
      if (riskResult) {
        dataSources.push(riskResult.source);
        if (!riskResult.success) warnings.push('Risk summary fetch failed');
      }
      if (carePlanResult) {
        dataSources.push(carePlanResult.source);
        if (!carePlanResult.success) warnings.push('Care plan fetch failed');
      }

      // Propagate source-level warnings (e.g., partial FHIR failures)
      for (const src of dataSources) {
        if (src.note && src.success) {
          warnings.push(src.note);
        }
      }

      // 3. Build context metadata
      const fetchDuration = Date.now() - startTime;

      const contextMeta: PatientContextMeta = {
        generated_at: new Date().toISOString(),
        request_id: requestId,
        options_requested: opts,
        data_sources: dataSources,
        data_freshness: assessFreshness(dataSources),
        freshness_threshold_minutes: 5,
        warnings,
        fetch_duration_ms: fetchDuration,
      };

      // 4. Assemble final context
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
