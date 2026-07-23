/**
 * Shared Guardian capability enforcement wiring.
 *
 * The ExecutionSandbox owns its own enforcer for the (currently unused) tool
 * framework. The ACTUAL autonomous healer is `RuntimeHealer`, which reaches the
 * database via the ambient `supabase` singleton and does NOT go through the
 * sandbox. For overnight Option B autonomy that healer must still be confined to
 * a declared table set — a bug or compromise must not let it touch an arbitrary
 * table. This module provides the shared enforcer (backed by the real
 * security_alerts sink) and a pre-scoped client the healer uses in place of the
 * raw `supabase` client.
 */
import { supabase } from '../../lib/supabaseClient';
import { CapabilityEnforcer, type CapabilityBearer } from './CapabilityEnforcer';
import { createSecurityAlertSink } from './capabilityViolationSink';

/** Process-wide enforcer for non-sandbox Guardian subsystems. */
export const guardianCapabilityEnforcer = new CapabilityEnforcer({
  sink: createSecurityAlertSink(),
});

/**
 * The RuntimeHealer's declared database footprint (live-verified from its
 * actual `.from()` usage 2026-07-23): it READS `profiles` (health probes) and
 * WRITES `security_notifications` (in-app alert panel). Anything else is a
 * capability violation. Update this ONLY when the healer's real table usage
 * changes — widening it silently defeats the confinement.
 */
export const RUNTIME_HEALER_CAPABILITY: CapabilityBearer = {
  id: 'guardian-runtime-healer',
  capabilities: {
    reads: ['profiles'],
    writes: ['security_notifications'],
    egress: [],
    databaseTables: ['profiles', 'security_notifications'],
  },
};

/**
 * Capability-scoped Supabase client for the RuntimeHealer. `.from(table)` is
 * gated by RUNTIME_HEALER_CAPABILITY: reads outside the declared tables and
 * writes to non-writable tables throw a CapabilityViolationError, are recorded
 * to security_alerts, and count toward quarantine.
 */
export const healerScopedDb = guardianCapabilityEnforcer.wrapDatabaseClient(
  RUNTIME_HEALER_CAPABILITY,
  supabase,
);
