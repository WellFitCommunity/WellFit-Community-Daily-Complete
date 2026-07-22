/**
 * auditLogRead — shared helpers for READING the immutable audit_logs table.
 *
 * Live column truth (verified via information_schema, 2026-07-22):
 *   id, actor_user_id, actor_role, actor_ip_address, actor_user_agent,
 *   event_type, event_category, resource_type, resource_id, table_name,
 *   timestamp, target_user_id, operation, metadata, success, error_code,
 *   error_message, retention_date, checksum, tenant_id
 *
 * There is NO severity column and NO created_at column — audit_logs is an
 * immutable HIPAA record and we do not add columns to it for display
 * purposes. Severity shown in dashboards is DERIVED, deterministically,
 * from event_category + success (see deriveAuditSeverity).
 */

export type AuditSeverity = 'info' | 'warning' | 'error' | 'critical';

/** Live event_category vocabulary (verified against production rows 2026-07-22). */
export const LIVE_AUDIT_CATEGORIES = [
  'AUTHENTICATION',
  'PHI_ACCESS',
  'SYSTEM_EVENT',
  'SECURITY_EVENT',
  'GUARDIAN',
  'CLINICAL',
  'BILLING',
  'ADMIN',
] as const;

export type LiveAuditCategory = (typeof LIVE_AUDIT_CATEGORIES)[number];

/** Canonical read column list for audit_logs (all live columns a viewer needs). */
export const AUDIT_LOG_READ_COLUMNS =
  'id, event_type, event_category, actor_user_id, actor_role, target_user_id, resource_type, resource_id, operation, metadata, actor_ip_address, actor_user_agent, success, error_code, error_message, timestamp';

/**
 * Derive a display severity for an audit event. DERIVED, never stored:
 * failures are errors (security failures critical); security events that
 * succeeded are still warnings; everything else is informational.
 */
export function deriveAuditSeverity(
  eventCategory: string | null,
  succeeded: boolean | null
): AuditSeverity {
  const failed = succeeded === false;
  const isSecurity = eventCategory === 'SECURITY_EVENT';
  if (failed && isSecurity) return 'critical';
  if (failed) return 'error';
  if (isSecurity) return 'warning';
  return 'info';
}
