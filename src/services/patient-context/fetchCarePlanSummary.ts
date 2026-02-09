/**
 * Fetch patient care plan summary
 *
 * @module patient-context/fetchCarePlanSummary
 * Copyright 2025-2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { supabase } from '../../lib/supabaseClient';
import type {
  PatientId,
  PatientCarePlanSummary,
} from '../../types/patientContext';
import { getDefaultCarePlanSummary } from './helpers';
import type { CarePlanRow, FetchResult } from './types';

/**
 * Fetch care plan summary from care_coordination_plans
 */
export async function fetchCarePlanSummary(
  patientId: PatientId
): Promise<FetchResult<PatientCarePlanSummary>> {
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
        data: getDefaultCarePlanSummary(),
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
        data: getDefaultCarePlanSummary(),
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
      care_coordinator_name: null,
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
      data: getDefaultCarePlanSummary(),
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
