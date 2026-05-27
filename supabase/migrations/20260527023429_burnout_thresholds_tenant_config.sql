-- ============================================================================
-- Burnout Thresholds — Tenant-Configurable Clinical Thresholds
-- ============================================================================
-- Purpose:
--   Add a JSONB column to tenant_module_config so each tenant can configure
--   the clinical escalation thresholds used by AdminBurnoutRadar instead of
--   relying on the hardcoded defaults baked into the component.
--
-- Default values match the previously hardcoded thresholds in
-- src/components/wellness/AdminBurnoutRadar.tsx so behavior is unchanged
-- for any tenant that has not overridden them.
--
-- Field meanings:
--   stress_high              — avg team stress >= this triggers HIGH ALERT
--                              and the "stress rising" alert severity = critical
--                              (scale 1-10)
--   energy_low               — avg team energy <= this is the low-energy
--                              threshold (scale 1-10)
--   mood_low                 — avg team mood/morale <= this is the low-mood
--                              threshold (scale 1-10)
--   high_risk_percent_alert  — percentage of staff at high/critical burnout
--                              risk above which the dashboard escalates
--                              the overall risk label to HIGH ALERT
-- ============================================================================

ALTER TABLE public.tenant_module_config
  ADD COLUMN IF NOT EXISTS burnout_thresholds JSONB
  DEFAULT '{"stress_high": 7, "energy_low": 4, "mood_low": 4, "high_risk_percent_alert": 30}'::jsonb;

COMMENT ON COLUMN public.tenant_module_config.burnout_thresholds IS
  'Tenant-configurable clinical thresholds for AdminBurnoutRadar. Keys: stress_high, energy_low, mood_low, high_risk_percent_alert. NULL falls back to component defaults.';

-- Backfill existing rows that were created before this column existed.
UPDATE public.tenant_module_config
SET burnout_thresholds = '{"stress_high": 7, "energy_low": 4, "mood_low": 4, "high_risk_percent_alert": 30}'::jsonb
WHERE burnout_thresholds IS NULL;
