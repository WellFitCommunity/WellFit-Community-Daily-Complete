/**
 * Population Context Fetcher
 *
 * P3-2: Pulls patient demographics, cultural context, and SDOH indicators
 * to provide population-aware calibration context for the Claude-in-Claude
 * calibrate-confidence MCP tool.
 *
 * Data sources:
 * - profiles table (demographics: race, ethnicity, age group)
 * - passive_sdoh_detections (AI-detected SDOH indicators)
 * - cultural-competency MCP server (population-specific factors)
 *
 * Tracker: docs/trackers/claude-in-claude-triage-tracker.md (P3-2)
 * Copyright © 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { supabase } from '../../lib/supabaseClient';
import type { ServiceResult } from '../_base';
import { success, failure } from '../_base';
import { auditLogger } from '../auditLogger';

// ============================================================================
// Types
// ============================================================================

/** Demographics from profiles table (de-identified for calibration) */
interface PatientDemographics {
  age_group: string | null;
  race: string | null;
  ethnicity: string | null;
  birthsex: string | null;
  preferred_language: string | null;
  zip_code: string | null;
}

/** SDOH detection summary (aggregated, no PHI) */
interface SdohSummary {
  total_detections: number;
  high_risk_count: number;
  categories: string[];
  top_indicators: Array<{
    indicator_type: string;
    risk_level: string;
    confidence: number;
  }>;
}

/** Population context shaped for the calibrate-confidence MCP tool */
export interface PopulationContext {
  primary_language?: string;
  community_group?: string;
  setting?: string;
  insurance_category?: string;
}

/** Full calibration context with all data needed for confidence adjustment */
export interface CalibrationContext {
  population_context: PopulationContext;
  sdoh_summary: SdohSummary;
  demographic_completeness: number;
  cultural_factors_available: boolean;
}

// ============================================================================
// Community Group Mapping
// ============================================================================

/**
 * Map patient demographics to a cultural competency population key.
 * These keys match the 8 populations in the cultural-competency MCP server.
 * Returns null if no clear mapping (which is valid — not every patient maps).
 */
function inferCommunityGroup(demographics: PatientDemographics): string | null {
  const { race, ethnicity, age_group } = demographics;

  if (ethnicity === 'Hispanic or Latino' || ethnicity === 'latino') {
    return 'latino';
  }
  if (race === 'Black or African American' || race === 'black_aa') {
    return 'black_aa';
  }
  if (race === 'American Indian or Alaska Native' || race === 'indigenous') {
    return 'indigenous';
  }
  // Age-based inference for elderly populations
  if (age_group === '75+' || age_group === '65-74') {
    return 'isolated_elderly';
  }

  return null;
}

/** Estimate urban/rural/suburban from ZIP code prefix (rough heuristic) */
function inferSetting(_zipCode: string | null): string | undefined {
  // Without a ZIP-to-RUCA database, we can't reliably determine setting.
  // Return undefined so the MCP tool knows this data is missing.
  return undefined;
}

/** Calculate how complete the demographic data is (0-1) */
function calculateCompleteness(demographics: PatientDemographics): number {
  const fields = [
    demographics.age_group,
    demographics.race,
    demographics.ethnicity,
    demographics.birthsex,
    demographics.preferred_language,
    demographics.zip_code,
  ];
  const filled = fields.filter(f => f !== null && f !== undefined && f !== '').length;
  return filled / fields.length;
}

// ============================================================================
// Service
// ============================================================================

export const PopulationContextFetcher = {
  /**
   * Fetch patient demographics from profiles table.
   * Returns only de-identified demographic fields needed for calibration.
   */
  async fetchDemographics(
    patientId: string
  ): Promise<ServiceResult<PatientDemographics>> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('age_group, race, ethnicity, birthsex, preferred_language, zip_code')
        .eq('user_id', patientId)
        .single();

      if (error) {
        return failure('NOT_FOUND', `Patient demographics not found: ${error.message}`, error);
      }

      return success(data as PatientDemographics);
    } catch (err: unknown) {
      await auditLogger.error(
        'POPULATION_DEMOGRAPHICS_FETCH_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { patientId }
      );
      return failure('FETCH_FAILED', 'Failed to fetch patient demographics');
    }
  },

  /**
   * Fetch SDOH indicators for a patient.
   * Returns aggregated summary (counts + categories), not raw detections.
   */
  async fetchSdohSummary(
    patientId: string
  ): Promise<ServiceResult<SdohSummary>> {
    try {
      const { data, error } = await supabase
        .from('passive_sdoh_detections')
        .select('indicator_type, risk_level, confidence_score, status')
        .eq('patient_id', patientId)
        .in('status', ['pending', 'confirmed'])
        .order('confidence_score', { ascending: false })
        .limit(20);

      if (error) {
        // SDOH data is optional — return empty summary on error
        return success({
          total_detections: 0,
          high_risk_count: 0,
          categories: [],
          top_indicators: [],
        });
      }

      const detections = (data ?? []) as Array<{
        indicator_type: string;
        risk_level: string;
        confidence_score: number;
        status: string;
      }>;

      const categories = [...new Set(detections.map(d => d.indicator_type))];
      const highRiskCount = detections.filter(
        d => d.risk_level === 'high' || d.risk_level === 'critical'
      ).length;

      return success({
        total_detections: detections.length,
        high_risk_count: highRiskCount,
        categories,
        top_indicators: detections.slice(0, 5).map(d => ({
          indicator_type: d.indicator_type,
          risk_level: d.risk_level,
          confidence: d.confidence_score,
        })),
      });
    } catch (err: unknown) {
      await auditLogger.error(
        'POPULATION_SDOH_FETCH_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { patientId }
      );
      // Non-fatal: return empty summary
      return success({
        total_detections: 0,
        high_risk_count: 0,
        categories: [],
        top_indicators: [],
      });
    }
  },

  /**
   * Build full calibration context for a patient.
   *
   * Fetches demographics and SDOH in parallel, then assembles the
   * PopulationContext needed by the calibrate-confidence MCP tool.
   */
  async getCalibrationContext(
    patientId: string
  ): Promise<ServiceResult<CalibrationContext>> {
    try {
      const [demoResult, sdohResult] = await Promise.allSettled([
        this.fetchDemographics(patientId),
        this.fetchSdohSummary(patientId),
      ]);

      // Extract demographics (required for meaningful calibration)
      let demographics: PatientDemographics | null = null;
      if (demoResult.status === 'fulfilled' && demoResult.value.success) {
        demographics = demoResult.value.data;
      }

      // Extract SDOH (optional, enhances calibration)
      let sdohSummary: SdohSummary = {
        total_detections: 0,
        high_risk_count: 0,
        categories: [],
        top_indicators: [],
      };
      if (sdohResult.status === 'fulfilled' && sdohResult.value.success) {
        sdohSummary = sdohResult.value.data;
      }

      // Build population context for MCP tool
      const populationContext: PopulationContext = {};

      if (demographics) {
        if (demographics.preferred_language) {
          populationContext.primary_language = demographics.preferred_language;
        }
        const communityGroup = inferCommunityGroup(demographics);
        if (communityGroup) {
          populationContext.community_group = communityGroup;
        }
        const setting = inferSetting(demographics.zip_code);
        if (setting) {
          populationContext.setting = setting;
        }
      }

      const completeness = demographics
        ? calculateCompleteness(demographics)
        : 0;

      await auditLogger.info('POPULATION_CONTEXT_FETCHED', {
        patientId,
        completeness,
        communityGroup: populationContext.community_group ?? 'none',
        sdohDetections: sdohSummary.total_detections,
      });

      return success({
        population_context: populationContext,
        sdoh_summary: sdohSummary,
        demographic_completeness: completeness,
        cultural_factors_available: !!populationContext.community_group,
      });
    } catch (err: unknown) {
      await auditLogger.error(
        'POPULATION_CONTEXT_FETCH_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { patientId }
      );
      return failure('FETCH_FAILED', 'Failed to fetch population context');
    }
  },
};
