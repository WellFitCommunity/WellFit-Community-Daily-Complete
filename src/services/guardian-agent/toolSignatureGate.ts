/**
 * toolSignatureGate — registry-facing surface of the ES256 tool-signing system
 * (Session 2). Re-exports the crypto core (ToolSigning.ts) and provides the
 * failure sink that lands signature violations in the audit trail +
 * security_alerts (Paper Trail Contract), mirroring capabilityViolationSink.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';
import type { SignatureVerdict } from './ToolSigning';

export { verifyToolSignature, getSigningMode, getSignatureRecord } from './ToolSigning';
export type { SignatureVerdict, SigningMode, ToolSignatureRecord } from './ToolSigning';

/**
 * Record a signature failure: audit event + security_alerts row.
 * enforce-mode rejections are high severity; warn-mode findings are medium.
 * Never throws — alert-write failure is itself audit-logged.
 */
export async function reportToolSignatureFailure(
  toolId: string,
  verdict: SignatureVerdict
): Promise<void> {
  const severity = verdict.mode === 'enforce' ? 'high' : 'medium';

  await auditLogger.error(
    'GUARDIAN_TOOL_SIGNATURE_INVALID',
    new Error(verdict.reason ?? 'signature verification failed'),
    { toolId, mode: verdict.mode }
  );

  try {
    const { error } = await supabase.from('security_alerts').insert({
      alert_type: 'security_policy_violation',
      severity,
      status: 'new',
      title:
        verdict.mode === 'enforce'
          ? `Guardian tool ${toolId} REJECTED — invalid/missing signature`
          : `Guardian tool ${toolId} unsigned or signature invalid (warn mode)`,
      description: verdict.reason ?? 'ES256 tool signature verification failed',
      category: 'guardian',
      detection_method: 'tool_signature_gate',
      notification_sent: false,
      metadata: {
        tool_id: toolId,
        mode: verdict.mode,
        source: 'ToolSigning',
      },
    });
    if (error) {
      await auditLogger.error(
        'GUARDIAN_TOOL_SIGNATURE_ALERT_WRITE_FAILED',
        new Error(error.message),
        { toolId }
      );
    }
  } catch (err: unknown) {
    await auditLogger.error(
      'GUARDIAN_TOOL_SIGNATURE_ALERT_WRITE_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { toolId }
    );
  }
}
