/**
 * Prior Authorization Analytics & Reporting
 * Statistics, deadline tracking, and claim checks
 */

import { supabase } from '../../../lib/supabaseClient';
import { getErrorMessage } from '../../../lib/getErrorMessage';
import type {
  PriorAuthorization,
  PriorAuthStatistics,
  PriorAuthClaimCheck,
  FHIRApiResponse,
} from './types';

/**
 * Get prior authorization statistics
 */
export async function getStatistics(
  tenantId: string,
  startDate?: string,
  endDate?: string
): Promise<FHIRApiResponse<PriorAuthStatistics>> {
  try {
    const { data, error } = await supabase.rpc('get_prior_auth_statistics', {
      p_tenant_id: tenantId,
      p_start_date: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      p_end_date: endDate || new Date().toISOString().split('T')[0]
    });

    if (error) throw error;

    const stats = data?.[0] || {
      total_submitted: 0,
      total_approved: 0,
      total_denied: 0,
      total_pending: 0,
      approval_rate: 0,
      avg_response_hours: 0,
      sla_compliance_rate: 100,
      by_urgency: {}
    };

    return { success: true, data: stats as PriorAuthStatistics };
  } catch (err: unknown) {
    return {
      success: false,
      error: getErrorMessage(err) || 'Failed to fetch statistics'
    };
  }
}

/**
 * Get prior authorizations approaching deadline
 */
export async function getApproachingDeadline(
  tenantId: string,
  hoursThreshold: number = 24
): Promise<FHIRApiResponse<PriorAuthorization[]>> {
  try {
    const { data, error } = await supabase.rpc('get_prior_auth_approaching_deadline', {
      p_tenant_id: tenantId,
      p_hours_threshold: hoursThreshold
    });

    if (error) throw error;
    return { success: true, data: (data as PriorAuthorization[]) || [] };
  } catch (err: unknown) {
    return {
      success: false,
      error: getErrorMessage(err) || 'Failed to fetch approaching deadline'
    };
  }
}

/**
 * Check if prior authorization is required for a claim
 */
export async function checkForClaim(
  tenantId: string,
  patientId: string,
  serviceCodes: string[],
  dateOfService: string
): Promise<FHIRApiResponse<PriorAuthClaimCheck>> {
  try {
    const { data, error } = await supabase.rpc('check_prior_auth_for_claim', {
      p_tenant_id: tenantId,
      p_patient_id: patientId,
      p_service_codes: serviceCodes,
      p_date_of_service: dateOfService
    });

    if (error) throw error;

    const result = data?.[0] || {
      requires_prior_auth: true,
      missing_codes: serviceCodes
    };

    return { success: true, data: result as PriorAuthClaimCheck };
  } catch (err: unknown) {
    return {
      success: false,
      error: getErrorMessage(err) || 'Failed to check prior authorization requirement'
    };
  }
}
