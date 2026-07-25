/**
 * FHIR Integrator — SOC 2 audit/security event logging
 *
 * Extracted from fhirInteroperabilityIntegrator.ts (CLAUDE.md Commandment #12).
 * Behavior unchanged — moved verbatim from private methods (no `this` used).
 */

import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';
import type { UnknownRecord } from './types';

// SOC 2: Audit logging helper
export async function logAuditEvent(eventType: string, metadata: UnknownRecord): Promise<void> {
  try {
    // audit_logs authenticated-INSERT RLS requires actor_user_id = auth.uid();
    // supply it (getSession is the client-safe uid source). `created_at` is not a
    // column — the real column is `timestamp` (defaults to now()), so it is omitted.
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from('audit_logs').insert({
      event_type: eventType,
      event_category: 'PHI_ACCESS',
      actor_user_id: session?.user?.id ?? null,
      metadata: metadata,
    });
  } catch (err: unknown) {
    // RF-5: a dropped audit write must itself be audited (don't fail the main
    // op, but don't swallow silently — SOC 2). Route to the app auditLogger sink.
    await auditLogger.error(
      'FHIR_AUDIT_WRITE_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { eventType }
    );
  }
}

// SOC 2: Security event logging helper
export async function logSecurityEvent(eventType: string, metadata: UnknownRecord): Promise<void> {
  try {
    // Live shape: description is NOT NULL and there is no created_at column
    // (the table stamps `timestamp` itself) — the old payload failed on every insert.
    await supabase.from('security_events').insert({
      event_type: eventType,
      severity: 'HIGH',
      description: `FHIR integrator security event: ${eventType}`,
      metadata: metadata
    });
  } catch (err: unknown) {
    // RF-5: see logAuditEvent — surface a dropped security-event write.
    await auditLogger.error(
      'FHIR_SECURITY_EVENT_WRITE_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { eventType }
    );
  }
}
