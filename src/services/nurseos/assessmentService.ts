// ============================================================================
// NurseOS Assessment Service — ServiceResult Pattern
// ============================================================================

import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';
import { success, failure } from '../_base';
import type { ServiceResult } from '../_base';
import type {
  ProviderBurnoutAssessment,
  BurnoutRiskLevel,
} from '../../types/nurseos';

/**
 * Submit burnout assessment (MBI)
 */
export async function submitBurnoutAssessment(
  assessment: Partial<ProviderBurnoutAssessment>
): Promise<ServiceResult<ProviderBurnoutAssessment>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return failure('UNAUTHORIZED', 'User not authenticated');

    const { data: practitioner, error: practError } = await supabase
      .from('fhir_practitioners')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (practError || !practitioner) {
      return failure('NOT_FOUND', 'Practitioner record not found');
    }

    const assessmentData = {
      ...assessment,
      user_id: user.id,
      practitioner_id: practitioner.id,
      assessment_date: new Date().toISOString(),
    };

    const { data: result, error } = await supabase
      .from('provider_burnout_assessments')
      .insert(assessmentData)
      .select()
      .single();

    if (error) {
      await auditLogger.error('RESILIENCE_ASSESSMENT_SUBMIT_FAILED', error.message, {
        userId: user.id,
        errorCode: error.code,
      });
      return failure('DATABASE_ERROR', `Failed to submit assessment: ${error.message}`, error);
    }

    return success(result as ProviderBurnoutAssessment);
  } catch (err: unknown) {
    await auditLogger.error(
      'RESILIENCE_ASSESSMENT_SUBMIT_ERROR',
      err instanceof Error ? err : new Error(String(err)),
      { context: 'submitBurnoutAssessment' }
    );
    return failure('OPERATION_FAILED', 'Failed to submit assessment', err);
  }
}

/**
 * Get current user's burnout assessments
 */
export async function getMyAssessments(): Promise<ServiceResult<ProviderBurnoutAssessment[]>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return failure('UNAUTHORIZED', 'User not authenticated');

    const { data, error } = await supabase
      .from('provider_burnout_assessments')
      .select('id, practitioner_id, user_id, assessment_date, assessment_type, emotional_exhaustion_score, depersonalization_score, personal_accomplishment_score, composite_burnout_score, risk_level, questionnaire_responses, provider_notes, intervention_triggered, intervention_type, follow_up_scheduled, created_at, updated_at')
      .eq('user_id', user.id)
      .order('assessment_date', { ascending: false });

    if (error) {
      await auditLogger.error('RESILIENCE_ASSESSMENTS_FETCH_FAILED', error.message, {
        userId: user.id,
        errorCode: error.code,
      });
      return failure('DATABASE_ERROR', `Failed to fetch assessments: ${error.message}`, error);
    }

    return success((data || []) as ProviderBurnoutAssessment[]);
  } catch (err: unknown) {
    await auditLogger.error(
      'RESILIENCE_ASSESSMENTS_FETCH_ERROR',
      err instanceof Error ? err : new Error(String(err)),
      { context: 'getMyAssessments' }
    );
    return failure('OPERATION_FAILED', 'Failed to fetch assessments', err);
  }
}

/**
 * Get latest burnout risk level for current user
 */
export async function getLatestBurnoutRisk(): Promise<BurnoutRiskLevel> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 'unknown';

  const { data, error } = await supabase.rpc('get_provider_burnout_risk', {
    p_user_id: user.id,
  });

  if (error) {
    await auditLogger.error('RESILIENCE_BURNOUT_RISK_FAILED', error.message, {
      userId: user.id,
      errorCode: error.code,
    });
    return 'unknown';
  }

  return (data as BurnoutRiskLevel) || 'unknown';
}

/**
 * Check if intervention is needed based on burnout/stress metrics
 */
export async function checkInterventionNeeded(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase.rpc('check_burnout_intervention_needed', {
    p_user_id: user.id,
  });

  if (error) {
    await auditLogger.error('RESILIENCE_INTERVENTION_CHECK_FAILED', error.message, {
      userId: user.id,
      errorCode: error.code,
    });
    return false;
  }

  return data as boolean;
}
