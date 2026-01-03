-- =============================================================================
-- Enforce Audit Log Immutability
-- =============================================================================
-- Purpose: Add triggers to prevent UPDATE and DELETE on critical audit tables.
--          This ensures audit trails cannot be tampered with.
--
-- HIPAA Reference: 45 CFR 164.312(b) - Audit controls
-- SOC2 Reference: CC7.2 - System operations monitoring
-- Security Principle: Append-only audit logs for non-repudiation
--
-- Tables Protected:
--   - audit_logs (main application audit)
--   - security_events (security-related events)
--   - phi_access_log (PHI access tracking)
--   - claude_api_audit (AI API usage audit)
--   - login_attempts (authentication audit)
--   - admin_audit_logs (admin action tracking)
--   - super_admin_audit_log (super admin actions)
--   - passkey_audit_log (passkey/WebAuthn audit)
--   - consent_log (patient consent tracking - HIPAA critical)
--   - caregiver_access_log (caregiver PHI access)
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Create the immutability enforcement function
-- =============================================================================
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Provide clear error message with context
  RAISE EXCEPTION '[AUDIT_IMMUTABILITY_VIOLATION] % operations on audit table "%" are prohibited. Audit logs are immutable for HIPAA/SOC2 compliance.',
    TG_OP, TG_TABLE_NAME
    USING HINT = 'Audit records cannot be modified or deleted. This is enforced for regulatory compliance.';

  -- This line is never reached, but required for BEFORE triggers
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION prevent_audit_log_modification() IS
  'HIPAA/SOC2 compliance: Prevents any modification or deletion of audit records. Enforces append-only audit trail.';

-- =============================================================================
-- 2. Apply triggers to audit_logs
-- =============================================================================
DROP TRIGGER IF EXISTS prevent_audit_logs_update ON audit_logs;
DROP TRIGGER IF EXISTS prevent_audit_logs_delete ON audit_logs;

CREATE TRIGGER prevent_audit_logs_update
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();

CREATE TRIGGER prevent_audit_logs_delete
  BEFORE DELETE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();

-- =============================================================================
-- 3. Apply triggers to security_events
-- =============================================================================
DROP TRIGGER IF EXISTS prevent_security_events_update ON security_events;
DROP TRIGGER IF EXISTS prevent_security_events_delete ON security_events;

CREATE TRIGGER prevent_security_events_update
  BEFORE UPDATE ON security_events
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();

CREATE TRIGGER prevent_security_events_delete
  BEFORE DELETE ON security_events
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();

-- =============================================================================
-- 4. Apply triggers to phi_access_log
-- =============================================================================
DROP TRIGGER IF EXISTS prevent_phi_access_log_update ON phi_access_log;
DROP TRIGGER IF EXISTS prevent_phi_access_log_delete ON phi_access_log;

CREATE TRIGGER prevent_phi_access_log_update
  BEFORE UPDATE ON phi_access_log
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();

CREATE TRIGGER prevent_phi_access_log_delete
  BEFORE DELETE ON phi_access_log
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();

-- =============================================================================
-- 5. Apply triggers to claude_api_audit
-- =============================================================================
DROP TRIGGER IF EXISTS prevent_claude_api_audit_update ON claude_api_audit;
DROP TRIGGER IF EXISTS prevent_claude_api_audit_delete ON claude_api_audit;

CREATE TRIGGER prevent_claude_api_audit_update
  BEFORE UPDATE ON claude_api_audit
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();

CREATE TRIGGER prevent_claude_api_audit_delete
  BEFORE DELETE ON claude_api_audit
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();

-- =============================================================================
-- 6. Apply triggers to login_attempts
-- =============================================================================
DROP TRIGGER IF EXISTS prevent_login_attempts_update ON login_attempts;
DROP TRIGGER IF EXISTS prevent_login_attempts_delete ON login_attempts;

CREATE TRIGGER prevent_login_attempts_update
  BEFORE UPDATE ON login_attempts
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();

CREATE TRIGGER prevent_login_attempts_delete
  BEFORE DELETE ON login_attempts
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();

-- =============================================================================
-- 7. Apply triggers to admin_audit_logs
-- =============================================================================
DROP TRIGGER IF EXISTS prevent_admin_audit_logs_update ON admin_audit_logs;
DROP TRIGGER IF EXISTS prevent_admin_audit_logs_delete ON admin_audit_logs;

CREATE TRIGGER prevent_admin_audit_logs_update
  BEFORE UPDATE ON admin_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();

CREATE TRIGGER prevent_admin_audit_logs_delete
  BEFORE DELETE ON admin_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();

-- =============================================================================
-- 8. Apply triggers to super_admin_audit_log
-- =============================================================================
DROP TRIGGER IF EXISTS prevent_super_admin_audit_log_update ON super_admin_audit_log;
DROP TRIGGER IF EXISTS prevent_super_admin_audit_log_delete ON super_admin_audit_log;

CREATE TRIGGER prevent_super_admin_audit_log_update
  BEFORE UPDATE ON super_admin_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();

CREATE TRIGGER prevent_super_admin_audit_log_delete
  BEFORE DELETE ON super_admin_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();

-- =============================================================================
-- 9. Apply triggers to passkey_audit_log
-- =============================================================================
DROP TRIGGER IF EXISTS prevent_passkey_audit_log_update ON passkey_audit_log;
DROP TRIGGER IF EXISTS prevent_passkey_audit_log_delete ON passkey_audit_log;

CREATE TRIGGER prevent_passkey_audit_log_update
  BEFORE UPDATE ON passkey_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();

CREATE TRIGGER prevent_passkey_audit_log_delete
  BEFORE DELETE ON passkey_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();

-- =============================================================================
-- 10. Apply triggers to consent_log (HIPAA critical - patient consent records)
-- =============================================================================
DROP TRIGGER IF EXISTS prevent_consent_log_update ON consent_log;
DROP TRIGGER IF EXISTS prevent_consent_log_delete ON consent_log;

CREATE TRIGGER prevent_consent_log_update
  BEFORE UPDATE ON consent_log
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();

CREATE TRIGGER prevent_consent_log_delete
  BEFORE DELETE ON consent_log
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();

-- =============================================================================
-- 11. Apply triggers to caregiver_access_log
-- =============================================================================
DROP TRIGGER IF EXISTS prevent_caregiver_access_log_update ON caregiver_access_log;
DROP TRIGGER IF EXISTS prevent_caregiver_access_log_delete ON caregiver_access_log;

CREATE TRIGGER prevent_caregiver_access_log_update
  BEFORE UPDATE ON caregiver_access_log
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();

CREATE TRIGGER prevent_caregiver_access_log_delete
  BEFORE DELETE ON caregiver_access_log
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();

-- =============================================================================
-- 12. Verification: List all protected tables
-- =============================================================================
DO $$
DECLARE
  protected_count INTEGER;
BEGIN
  SELECT COUNT(DISTINCT tgrelid) INTO protected_count
  FROM pg_trigger
  WHERE tgname LIKE 'prevent_%_update' OR tgname LIKE 'prevent_%_delete';

  RAISE NOTICE 'Audit log immutability migration complete. % tables now protected.', protected_count;
END $$;

COMMIT;

-- =============================================================================
-- Post-migration verification (run manually)
-- =============================================================================
--
-- Test that UPDATE is blocked:
--   UPDATE audit_logs SET action = 'tampered' WHERE id = (SELECT id FROM audit_logs LIMIT 1);
--   Expected: ERROR [AUDIT_IMMUTABILITY_VIOLATION]
--
-- Test that DELETE is blocked:
--   DELETE FROM audit_logs WHERE id = (SELECT id FROM audit_logs LIMIT 1);
--   Expected: ERROR [AUDIT_IMMUTABILITY_VIOLATION]
--
-- Test that INSERT still works:
--   INSERT INTO audit_logs (action, user_id) VALUES ('test', gen_random_uuid());
--   Expected: Success
--
-- =============================================================================
