/**
 * tenantResolver - Resolves and caches the current user's tenant_id for Guardian writes.
 *
 * Purpose: guardian_telemetry, system_recordings and session_recordings all carry
 * tenant-scoped RLS (tenant_id = get_current_tenant_id()). Guardian's browser-side
 * writers historically either omitted tenant_id or hardcoded a slug
 * ('wellfit-primary'), so every insert from a non-super-admin session was silently
 * rejected by RLS. All Guardian browser writers must resolve the real tenant here.
 *
 * Used by: AuditLogger (guardian telemetry), recorderPersistence (Guardian Eyes).
 */

import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';

let cachedTenantId: string | null = null;
let cachedForUserId: string | null = null;

/**
 * Resolve the signed-in user's tenant_id (uuid string), cached per user.
 * Returns null when there is no session or no profile row — callers should
 * still attempt their write (super admins pass RLS without a tenant match)
 * but must log the failure instead of swallowing it.
 */
export async function resolveTenantId(): Promise<string | null> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? null;
    if (!userId) return null;

    if (cachedForUserId === userId) return cachedTenantId;

    const { data, error } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('user_id', userId)
      .single();

    if (error) {
      await auditLogger.warn('GUARDIAN_TENANT_RESOLUTION_FAILED', {
        message: error.message,
      });
      return null;
    }

    cachedTenantId = (data as { tenant_id: string | null } | null)?.tenant_id ?? null;
    cachedForUserId = userId;
    return cachedTenantId;
  } catch (err: unknown) {
    await auditLogger.error(
      'GUARDIAN_TENANT_RESOLUTION_FAILED',
      err instanceof Error ? err : new Error(String(err))
    );
    return null;
  }
}

/**
 * Synchronous accessor for code paths that build log entries synchronously.
 * Returns the last resolved tenant_id, or null if resolution hasn't completed.
 */
export function getCachedTenantId(): string | null {
  return cachedTenantId;
}

/** Test-only: reset the cache between tests. */
export function _resetTenantCache(): void {
  cachedTenantId = null;
  cachedForUserId = null;
}
