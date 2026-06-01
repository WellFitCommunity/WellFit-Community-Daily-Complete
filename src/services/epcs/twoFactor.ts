/**
 * EPCS — two-factor authentication verification (21 CFR 1311.120)
 *
 * Extracted from epcsService.ts (CLAUDE.md Commandment #12).
 * Behavior unchanged — moved verbatim.
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base';
import { auditLogger } from '../auditLogger';
import type { TFAMethod } from './types';

/**
 * Verify two-factor authentication
 * In production, this would integrate with the actual 2FA provider (RSA, Symantec, etc.)
 */
export async function verifyTwoFactorAuth(
  tenantId: string,
  userId: string,
  method: TFAMethod,
  token: string
): Promise<ServiceResult<{ valid: boolean; reason?: string }>> {
  try {
    // Get provider registration to verify TFA is set up
    const { data: registration, error } = await supabase
      .from('epcs_provider_registrations')
      .select('tfa_method, tfa_device_serial')
      .eq('tenant_id', tenantId)
      .eq('provider_id', userId)
      .eq('status', 'active')
      .single();

    if (error || !registration) {
      return success({ valid: false, reason: 'Provider not registered for EPCS' });
    }

    // Verify method matches registration
    if (registration.tfa_method !== method) {
      return success({
        valid: false,
        reason: `TFA method mismatch. Expected: ${registration.tfa_method}`,
      });
    }

    // In production, call actual TFA provider API here
    // For now, simulate validation (token must be 6+ digits)
    if (!/^\d{6,8}$/.test(token)) {
      return success({ valid: false, reason: 'Invalid token format' });
    }

    // Simulate successful verification
    return success({ valid: true });
  } catch (err: unknown) {
    await auditLogger.error(
      'EPCS_TFA_VERIFICATION_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, userId, method }
    );
    return failure('UNAUTHORIZED', 'TFA verification failed');
  }
}
