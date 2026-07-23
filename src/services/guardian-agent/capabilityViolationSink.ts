/**
 * Default violation sink for the CapabilityEnforcer.
 *
 * Kept separate from CapabilityEnforcer.ts so the enforcer itself has no
 * Supabase dependency and stays trivially unit-testable with a mock sink.
 * This factory wires a real violation into the audit trail + security_alerts
 * (the Paper Trail Contract: a capability violation is a recorded security event).
 */
import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';
import type { CapabilityViolation, ViolationSink } from './CapabilityEnforcer';

/**
 * Build a sink that records each capability violation to `security_alerts`
 * (alert_type `security_policy_violation`) and the audit log. A quarantining
 * violation is raised at `critical` severity so it reaches the overnight SMS
 * channel; earlier violations are `high`.
 */
export function createSecurityAlertSink(): ViolationSink {
  return async (violation: CapabilityViolation): Promise<void> => {
    const severity = violation.quarantined ? 'critical' : 'high';

    await auditLogger.error(
      'CAPABILITY_VIOLATION',
      new Error(violation.reason),
      {
        toolId: violation.toolId,
        kind: violation.kind,
        resource: violation.resource,
        violationCount: violation.violationCount,
        quarantined: violation.quarantined,
      },
    );

    try {
      const { error } = await supabase.from('security_alerts').insert({
        alert_type: 'security_policy_violation',
        severity,
        status: 'new',
        title: violation.quarantined
          ? `Guardian tool ${violation.toolId} QUARANTINED after capability violation`
          : `Guardian tool ${violation.toolId} capability violation (${violation.kind})`,
        description: violation.reason,
        category: 'guardian',
        detection_method: 'capability_enforcer',
        notification_sent: false,
        metadata: {
          tool_id: violation.toolId,
          kind: violation.kind,
          resource: violation.resource,
          violation_count: violation.violationCount,
          quarantined: violation.quarantined,
          source: 'CapabilityEnforcer',
        },
      });
      if (error) {
        // Never let alert-write failure mask the violation — it is already in
        // the audit log above; just record that the alert row could not be written.
        await auditLogger.error(
          'CAPABILITY_VIOLATION_ALERT_WRITE_FAILED',
          new Error(error.message),
          { toolId: violation.toolId, kind: violation.kind },
        );
      }
    } catch (err: unknown) {
      await auditLogger.error(
        'CAPABILITY_VIOLATION_ALERT_WRITE_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { toolId: violation.toolId, kind: violation.kind },
      );
    }
  };
}
