-- Add admin_settings.security_rules (tenant-security dashboard rule config)
--
-- Found 2026-07-22: tenantSecurityService reads/upserts a security_rules
-- jsonb on admin_settings that never existed live — every read 400'd and
-- rule saves silently failed. The design (per-admin rule config alongside
-- the other admin_settings prefs, keyed user_id) is sound; the column was
-- simply never migrated. Additive, nullable; defaults handled client-side.
--
-- Forward-only; no `-- migrate:down` block (db push executes down blocks — documented footgun).

ALTER TABLE public.admin_settings
  ADD COLUMN IF NOT EXISTS security_rules jsonb;
COMMENT ON COLUMN public.admin_settings.security_rules IS
  'Per-admin security alert rule configuration (TenantSecurityDashboard).';
