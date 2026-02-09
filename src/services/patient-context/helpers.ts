/**
 * Helper functions for Patient Context Service
 *
 * Shared utilities used across fetch modules and the orchestrator.
 *
 * @module patient-context/helpers
 * Copyright 2025-2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

import type {
  DataSourceRecord,
  PatientRiskSummary,
  PatientCarePlanSummary,
} from '../../types/patientContext';

/**
 * Assess overall data freshness based on fetch timestamps
 */
export function assessFreshness(
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

/**
 * Default risk summary when no data available
 */
export function getDefaultRiskSummary(): PatientRiskSummary {
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
export function getDefaultCarePlanSummary(): PatientCarePlanSummary {
  return {
    active_plan_id: null,
    plan_type: null,
    plan_status: null,
    primary_goal: null,
    next_review_date: null,
    care_coordinator_name: null,
  };
}
