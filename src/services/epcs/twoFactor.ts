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

    // DEA 21 CFR 1311.120 requires REAL two-factor verification — the TOTP code
    // must be checked against the prescriber's enrolled secret, which lives
    // server-side (verifying it here would mean shipping the secret to the
    // browser). That secret check is NOT YET WIRED for EPCS, so this control
    // FAILS CLOSED: it never returns valid until a server-side verifier
    // (e.g. an `epcs-verify-tfa` edge function calling `verifyTotpCode`) and
    // EPCS TOTP enrollment are in place. No simulated/auto-approve path exists.
    // Tracked: docs/trackers/god-file-refactor-findings-tracker.md (RF-1).
    void token;
    return success({
      valid: false,
      reason: 'EPCS two-factor verification is not yet wired to a server-side TOTP verifier; controlled-substance signing is disabled until then',
    });
  } catch (err: unknown) {
    await auditLogger.error(
      'EPCS_TFA_VERIFICATION_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, userId, method }
    );
    return failure('UNAUTHORIZED', 'TFA verification failed');
  }
}
