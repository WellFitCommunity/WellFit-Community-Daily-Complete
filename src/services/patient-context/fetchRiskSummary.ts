/**
 * Fetch patient risk assessment summary
 *
 * @module patient-context/fetchRiskSummary
 * Copyright 2025-2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { supabase } from '../../lib/supabaseClient';
import type {
  PatientId,
  PatientRiskSummary,
  PatientRiskLevel,
} from '../../types/patientContext';
import { getDefaultRiskSummary } from './helpers';
import type { FetchResult } from './types';

/**
 * Fetch risk assessment summary from patient_risk_registry
 */
export async function fetchRiskSummary(
  patientId: PatientId
): Promise<FetchResult<PatientRiskSummary>> {
  const fetchedAt = new Date().toISOString();

  try {
    // Try patient_risk_registry first
    const { data: riskData, error: riskError } = await supabase
      .from('patient_risk_registry')
      .select('risk_level, risk_score, risk_factors, last_assessment_date, readmission_risk_30day, fall_risk_score')
      .eq('patient_id', patientId)
      .order('last_assessment_date', { ascending: false })
      .limit(1)
      .single();

    if (riskError && riskError.code !== 'PGRST116') {
      return {
        success: true,
        data: getDefaultRiskSummary(),
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
        data: getDefaultRiskSummary(),
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
      data: getDefaultRiskSummary(),
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
