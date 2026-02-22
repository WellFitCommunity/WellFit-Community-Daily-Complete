/**
 * Prior Authorization Decision & Appeal Operations
 * Record decisions, manage appeals for prior authorization requests
 */

import { supabase } from '../../../lib/supabaseClient';
import { getErrorMessage } from '../../../lib/getErrorMessage';
import { auditLogger } from '../../auditLogger';
import type {
  PriorAuthStatus,
  PriorAuthDecision,
  PriorAuthAppeal,
  FHIRApiResponse,
  RecordDecisionInput,
  CreateAppealInput,
} from './types';

/**
 * Record payer decision on prior authorization
 */
export async function recordDecision(input: RecordDecisionInput): Promise<FHIRApiResponse<PriorAuthDecision>> {
  try {
    await auditLogger.phi('PRIOR_AUTH_DECISION_START', input.prior_auth_id, {
      decision_type: input.decision_type
    });

    // Insert decision record
    const { data: decision, error: decisionError } = await supabase
      .from('prior_auth_decisions')
      .insert({
        prior_auth_id: input.prior_auth_id,
        decision_type: input.decision_type,
        decision_date: new Date().toISOString(),
        decision_reason: input.decision_reason,
        decision_code: input.decision_code,
        auth_number: input.auth_number,
        approved_units: input.approved_units,
        approved_start_date: input.approved_start_date,
        approved_end_date: input.approved_end_date,
        denial_reason_code: input.denial_reason_code,
        denial_reason_description: input.denial_reason_description,
        appeal_deadline: input.appeal_deadline,
        response_payload: input.response_payload,
        x12_278_response: input.x12_278_response,
        reviewer_name: input.reviewer_name,
        reviewer_npi: input.reviewer_npi,
        tenant_id: input.tenant_id,
        created_by: input.created_by
      })
      .select('id, prior_auth_id, decision_type, decision_date, decision_reason, decision_code, auth_number, approved_units, approved_start_date, approved_end_date, denial_reason_code, denial_reason_description, appeal_deadline, response_payload, x12_278_response, reviewer_name, reviewer_npi, created_at, tenant_id')
      .single();

    if (decisionError) throw decisionError;

    // Update prior authorization status
    const newStatus: PriorAuthStatus =
      input.decision_type === 'approved' ? 'approved' :
      input.decision_type === 'denied' ? 'denied' :
      input.decision_type === 'partial_approval' ? 'partial_approval' :
      input.decision_type === 'pended' ? 'pending_additional_info' : 'cancelled';

    const { error: updateError } = await supabase
      .from('prior_authorizations')
      .update({
        status: newStatus,
        auth_number: input.auth_number || undefined,
        approved_units: input.approved_units,
        approved_at: input.decision_type === 'approved' ? new Date().toISOString() : undefined,
        expires_at: input.approved_end_date,
        updated_at: new Date().toISOString()
      })
      .eq('id', input.prior_auth_id);

    if (updateError) throw updateError;

    await auditLogger.phi('PRIOR_AUTH_DECISION_RECORDED', input.prior_auth_id, {
      decision_id: decision.id,
      decision_type: input.decision_type
    });

    return { success: true, data: decision as PriorAuthDecision };
  } catch (err: unknown) {
    await auditLogger.error('PRIOR_AUTH_DECISION_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { prior_auth_id: input.prior_auth_id }
    );
    return {
      success: false,
      error: getErrorMessage(err) || 'Failed to record decision'
    };
  }
}

/**
 * Get decisions for a prior authorization
 */
export async function getDecisions(priorAuthId: string): Promise<FHIRApiResponse<PriorAuthDecision[]>> {
  try {
    const { data, error } = await supabase
      .from('prior_auth_decisions')
      .select('id, prior_auth_id, decision_type, decision_date, decision_reason, decision_code, auth_number, approved_units, approved_start_date, approved_end_date, denial_reason_code, denial_reason_description, appeal_deadline, response_payload, x12_278_response, reviewer_name, reviewer_npi, created_at, tenant_id')
      .eq('prior_auth_id', priorAuthId)
      .order('decision_date', { ascending: false });

    if (error) throw error;
    return { success: true, data: (data as PriorAuthDecision[]) || [] };
  } catch (err: unknown) {
    return {
      success: false,
      error: getErrorMessage(err) || 'Failed to fetch decisions'
    };
  }
}

/**
 * Create an appeal for a denied prior authorization
 */
export async function createAppeal(input: CreateAppealInput): Promise<FHIRApiResponse<PriorAuthAppeal>> {
  try {
    await auditLogger.phi('PRIOR_AUTH_APPEAL_START', input.prior_auth_id);

    // Get current appeal level
    const { data: existingAppeals } = await supabase
      .from('prior_auth_appeals')
      .select('appeal_level')
      .eq('prior_auth_id', input.prior_auth_id)
      .order('appeal_level', { ascending: false })
      .limit(1);

    const nextLevel = (existingAppeals?.[0]?.appeal_level || 0) + 1;

    const { data, error } = await supabase
      .from('prior_auth_appeals')
      .insert({
        prior_auth_id: input.prior_auth_id,
        decision_id: input.decision_id,
        appeal_level: nextLevel,
        status: 'draft',
        appeal_reason: input.appeal_reason,
        appeal_type: input.appeal_type,
        additional_documentation: input.additional_documentation || [],
        clinical_rationale: input.clinical_rationale,
        tenant_id: input.tenant_id,
        created_by: input.created_by
      })
      .select('id, prior_auth_id, decision_id, appeal_level, status, appeal_reason, appeal_type, submitted_at, deadline_at, resolved_at, peer_to_peer_scheduled_at, peer_to_peer_completed_at, peer_to_peer_outcome, additional_documentation, clinical_rationale, outcome, outcome_notes, created_at, updated_at, tenant_id')
      .single();

    if (error) throw error;

    // Update prior auth status
    await supabase
      .from('prior_authorizations')
      .update({
        status: 'appealed',
        updated_at: new Date().toISOString()
      })
      .eq('id', input.prior_auth_id);

    await auditLogger.phi('PRIOR_AUTH_APPEAL_CREATED', input.prior_auth_id, {
      appeal_id: data.id,
      appeal_level: nextLevel
    });

    return { success: true, data: data as PriorAuthAppeal };
  } catch (err: unknown) {
    await auditLogger.error('PRIOR_AUTH_APPEAL_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { prior_auth_id: input.prior_auth_id }
    );
    return {
      success: false,
      error: getErrorMessage(err) || 'Failed to create appeal'
    };
  }
}

/**
 * Submit appeal to payer
 */
export async function submitAppeal(appealId: string): Promise<FHIRApiResponse<PriorAuthAppeal>> {
  try {
    const { data, error } = await supabase
      .from('prior_auth_appeals')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        deadline_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
      })
      .eq('id', appealId)
      .select('id, prior_auth_id, decision_id, appeal_level, status, appeal_reason, appeal_type, submitted_at, deadline_at, resolved_at, peer_to_peer_scheduled_at, peer_to_peer_completed_at, peer_to_peer_outcome, additional_documentation, clinical_rationale, outcome, outcome_notes, created_at, updated_at, tenant_id')
      .single();

    if (error) throw error;

    await auditLogger.phi('PRIOR_AUTH_APPEAL_SUBMITTED', appealId);

    return { success: true, data: data as PriorAuthAppeal };
  } catch (err: unknown) {
    return {
      success: false,
      error: getErrorMessage(err) || 'Failed to submit appeal'
    };
  }
}

/**
 * Get appeals for a prior authorization
 */
export async function getAppeals(priorAuthId: string): Promise<FHIRApiResponse<PriorAuthAppeal[]>> {
  try {
    const { data, error } = await supabase
      .from('prior_auth_appeals')
      .select('id, prior_auth_id, decision_id, appeal_level, status, appeal_reason, appeal_type, submitted_at, deadline_at, resolved_at, peer_to_peer_scheduled_at, peer_to_peer_completed_at, peer_to_peer_outcome, additional_documentation, clinical_rationale, outcome, outcome_notes, created_at, updated_at, tenant_id')
      .eq('prior_auth_id', priorAuthId)
      .order('appeal_level', { ascending: true });

    if (error) throw error;
    return { success: true, data: (data as PriorAuthAppeal[]) || [] };
  } catch (err: unknown) {
    return {
      success: false,
      error: getErrorMessage(err) || 'Failed to fetch appeals'
    };
  }
}
