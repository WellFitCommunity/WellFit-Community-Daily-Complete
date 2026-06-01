/**
 * EPCS — provider DEA registration + authorization
 *
 * Extracted from epcsService.ts (CLAUDE.md Commandment #12).
 * Behavior unchanged — moved verbatim.
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base';
import { auditLogger } from '../auditLogger';
import type { DEASchedule, ProviderRegistration } from './types';
import { mapProviderRegistration } from './helpers';

/**
 * Get provider's EPCS registration
 */
export async function getProviderRegistration(
  tenantId: string,
  providerId: string
): Promise<ServiceResult<ProviderRegistration | null>> {
  try {
    const { data, error } = await supabase
      .from('epcs_provider_registrations')
      .select('id, tenant_id, provider_id, dea_number, dea_suffix, dea_expiration_date, dea_schedules, state_license_number, state_license_state, state_license_expiration, identity_proofing_method, identity_proofed_date, tfa_method, tfa_device_serial, tfa_enrollment_date, tfa_last_verified, status, status_reason')
      .eq('tenant_id', tenantId)
      .eq('provider_id', providerId)
      .eq('status', 'active')
      .single();

    if (error && error.code !== 'PGRST116') {
      return failure('DATABASE_ERROR', error.message);
    }

    return success(data ? mapProviderRegistration(data) : null);
  } catch (err: unknown) {
    await auditLogger.error(
      'EPCS_REGISTRATION_FETCH_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, providerId }
    );
    return failure('FETCH_FAILED', 'Failed to fetch provider registration');
  }
}

/**
 * Verify provider is authorized to prescribe a specific schedule
 */
export async function verifyProviderAuthorization(
  tenantId: string,
  providerId: string,
  schedule: DEASchedule
): Promise<ServiceResult<{ authorized: boolean; reason?: string; registration?: ProviderRegistration }>> {
  try {
    const regResult = await getProviderRegistration(tenantId, providerId);
    if (!regResult.success) {
      return failure(regResult.error?.code || 'FETCH_FAILED', regResult.error?.message || 'Failed to fetch registration');
    }

    if (!regResult.data) {
      return success({
        authorized: false,
        reason: 'Provider is not registered for EPCS',
      });
    }

    const registration = regResult.data;

    // Check status
    if (registration.status !== 'active') {
      return success({
        authorized: false,
        reason: `Provider registration is ${registration.status}`,
        registration,
      });
    }

    // Check DEA expiration
    if (new Date() > registration.deaExpirationDate) {
      return success({
        authorized: false,
        reason: 'DEA registration has expired',
        registration,
      });
    }

    // Check state license expiration
    if (new Date() > registration.stateLicenseExpiration) {
      return success({
        authorized: false,
        reason: 'State license has expired',
        registration,
      });
    }

    // Check schedule authorization
    if (!registration.deaSchedules.includes(schedule)) {
      return success({
        authorized: false,
        reason: `Provider is not authorized for Schedule ${schedule}`,
        registration,
      });
    }

    return success({
      authorized: true,
      registration,
    });
  } catch (err: unknown) {
    await auditLogger.error(
      'EPCS_AUTHORIZATION_CHECK_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, providerId, schedule }
    );
    return failure('OPERATION_FAILED', 'Failed to verify provider authorization');
  }
}
