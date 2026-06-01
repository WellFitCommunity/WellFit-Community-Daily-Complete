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
    await supabase.from('audit_logs').insert({
      event_type: eventType,
      event_category: 'PHI_ACCESS',
      metadata: metadata,
      created_at: new Date().toISOString()
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
    await supabase.from('security_events').insert({
      event_type: eventType,
      severity: 'HIGH',
      metadata: metadata,
      created_at: new Date().toISOString()
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
