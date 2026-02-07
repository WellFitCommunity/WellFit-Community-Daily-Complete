-- Add notes column to check_ins (was in original schema design but missing from DB)
-- Maps to activity_notes from CheckInTracker form

BEGIN;

ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS notes TEXT;
COMMENT ON COLUMN check_ins.notes IS 'Free-text notes about the day (activity notes, concerns)';

-- Must drop and recreate view because column order changed
DROP VIEW IF EXISTS v_latest_check_in;

CREATE VIEW v_latest_check_in
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
  ci.notes,
  ci.is_emergency,
  ci.source,
  ci.device_label,
  ci.created_at
FROM check_ins ci
ORDER BY ci.user_id, ci.timestamp DESC;

COMMENT ON VIEW v_latest_check_in IS
  'Latest check-in per user. Tenant isolation via security_invoker RLS on check_ins.';

COMMIT;
