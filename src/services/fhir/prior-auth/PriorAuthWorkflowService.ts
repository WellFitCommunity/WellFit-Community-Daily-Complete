/**
 * Prior Authorization Workflow Operations
 * Submit and cancel prior authorization requests
 */

import { supabase } from '../../../lib/supabaseClient';
import { getErrorMessage } from '../../../lib/getErrorMessage';
import { auditLogger } from '../../auditLogger';
import type {
  PriorAuthorization,
  FHIRApiResponse,
  SubmitPriorAuthInput,
} from './types';

/**
 * Submit prior authorization to payer
 * Generates auth number and sets deadline based on urgency
 */
export async function submit(input: SubmitPriorAuthInput): Promise<FHIRApiResponse<PriorAuthorization>> {
  try {
    const now = new Date();
    const authNumber = `PA-${now.getTime()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const traceNumber = `TRN-${now.getTime()}`;

    await auditLogger.phi('PRIOR_AUTH_SUBMIT_START', input.id);

    const { data, error } = await supabase
      .from('prior_authorizations')
      .update({
        status: 'submitted',
        auth_number: authNumber,
        trace_number: traceNumber,
        submitted_at: now.toISOString(),
        updated_by: input.updated_by,
        updated_at: now.toISOString()
      })
      .eq('id', input.id)
      .select()
      .single();

    if (error) throw error;

    await auditLogger.phi('PRIOR_AUTH_SUBMITTED', input.id, {
      auth_number: authNumber,
      urgency: data.urgency,
      decision_due_at: data.decision_due_at
    });

    return { success: true, data: data as PriorAuthorization };
  } catch (err: unknown) {
    await auditLogger.error('PRIOR_AUTH_SUBMIT_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { prior_auth_id: input.id }
    );
    return {
      success: false,
      error: getErrorMessage(err) || 'Failed to submit prior authorization'
    };
  }
}

/**
 * Cancel prior authorization
 */
export async function cancel(id: string, reason?: string, updatedBy?: string): Promise<FHIRApiResponse<PriorAuthorization>> {
  try {
    const { data, error } = await supabase
      .from('prior_authorizations')
      .update({
        status: 'cancelled',
        clinical_notes: reason,
        updated_by: updatedBy,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await auditLogger.phi('PRIOR_AUTH_CANCELLED', id, { reason });

    return { success: true, data: data as PriorAuthorization };
  } catch (err: unknown) {
    return {
      success: false,
      error: getErrorMessage(err) || 'Failed to cancel prior authorization'
    };
  }
}
