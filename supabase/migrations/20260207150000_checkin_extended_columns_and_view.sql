-- Phase 5: Add extended check-in fields + v_latest_check_in view
-- Fixes: create-checkin edge function was missing tenant_id, weight, and
-- activity/social/symptoms columns. This migration adds the columns so
-- the edge function can store the full check-in payload in check_ins.

BEGIN;

-- =============================================================================
-- 1. Add extended columns to check_ins
-- =============================================================================

ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS physical_activity TEXT;
ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS social_engagement TEXT;
ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS symptoms TEXT;

COMMENT ON COLUMN check_ins.physical_activity IS 'Physical activity type (e.g., Walking, Swimming)';
COMMENT ON COLUMN check_ins.social_engagement IS 'Social connection type (e.g., Spent time with family)';
COMMENT ON COLUMN check_ins.symptoms IS 'Symptom description (free text, max 500 chars)';

-- =============================================================================
-- 2. v_latest_check_in — Latest check-in per user, tenant-scoped
--    security_invoker = on: RLS on check_ins applies to the caller,
--    which already filters by tenant_id = get_current_tenant_id()
--    and user_id = auth.uid() OR is_tenant_admin().
-- =============================================================================

CREATE OR REPLACE VIEW v_latest_check_in
WITH (security_invoker = on) AS
SELECT DISTINCT ON (ci.user_id)
  ci.id,
  ci.user_id,
  ci.tenant_id,
  ci.timestamp,
  ci.label,
  ci.emotional_state,
  ci.heart_rate,
  ci.pulse_oximeter,
  ci.bp_systolic,
  ci.bp_diastolic,
  ci.glucose_mg_dl,
  ci.weight,
  ci.physical_activity,
  ci.social_engagement,
  ci.symptoms,
  ci.is_emergency,
  ci.source,
  ci.device_label,
  ci.created_at
FROM check_ins ci
ORDER BY ci.user_id, ci.timestamp DESC;

COMMENT ON VIEW v_latest_check_in IS
  'Latest check-in per user. Tenant isolation via security_invoker RLS on check_ins.';

COMMIT;
