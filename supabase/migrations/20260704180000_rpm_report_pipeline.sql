-- Migration: RPM weekly report pipeline — schedule + delivery record + review attribution
--
-- BLE/RPM tracker Session E part 2. Adds the persistence + scheduling half of the
-- automated RPM/vitals report pipeline (the "Generate" logic lives in
-- src/services/rpmReportService.ts + the rpm-weekly-report edge function):
--
--   • rpm_report_settings  — per-tenant recipient + cadence (§1.9: never hardcoded;
--                            today WellFit admin, future the doctor's office).
--   • rpm_reports          — one row per report generated + sent, carrying the
--                            billing trail (transmission_days / 99454) AND the
--                            review-attribution columns (reviewed_by / reviewed_at)
--                            that credit a provider for CPT 99457/99458 review.
--   • log_rpm_report_review — SECURITY DEFINER RPC a report-viewer calls to stamp
--                            "who reviewed it and when" (the billing-credit trail).
--   • cron 'rpm-weekly-report' — weekly trigger of the edge function.
--
-- Tier 3 (new tables + cron), Maria-approved 2026-07-04. End-to-end delivery is NOT
-- yet live-proven: the live DB has 0 active enrollments + 0 device readings. Live
-- data arrives the week of 2026-07-07; the empty-run path (cron fires -> 0 reports)
-- is provable now. RLS follows governance §B4 (clinicians read community/RPM data
-- within their tenant).

-- =============================================================================
-- 1) Per-tenant report routing (§1.9)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.rpm_report_settings (
  tenant_id        UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  recipient_emails TEXT[] NOT NULL DEFAULT '{}',
  cadence          TEXT NOT NULL DEFAULT 'weekly' CHECK (cadence IN ('weekly', 'monthly')),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.rpm_report_settings IS
  'Per-tenant RPM report routing. recipient_emails empty -> edge fn falls back to ADMIN_EMAILS.';

ALTER TABLE public.rpm_report_settings ENABLE ROW LEVEL SECURITY;

-- Tenant admins manage their own routing; service role (edge fn) bypasses RLS.
CREATE POLICY "rpm_settings_tenant_admin_all" ON public.rpm_report_settings
  FOR ALL
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin())
  WITH CHECK (tenant_id = get_current_tenant_id() AND is_tenant_admin());

-- =============================================================================
-- 2) Generated + sent reports (billing trail + review attribution)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.rpm_reports (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  enrollment_id      UUID REFERENCES public.rpm_enrollments(id) ON DELETE SET NULL,
  patient_id         UUID NOT NULL,
  period_start       DATE NOT NULL,
  period_end         DATE NOT NULL,
  transmission_days  INTEGER NOT NULL DEFAULT 0,
  required_days      INTEGER NOT NULL DEFAULT 16,
  is_billable_99454  BOOLEAN NOT NULL DEFAULT FALSE,
  monitoring_minutes INTEGER NOT NULL DEFAULT 0,
  payload            JSONB NOT NULL DEFAULT '{}'::jsonb,
  recipients         TEXT[] NOT NULL DEFAULT '{}',
  sent_at            TIMESTAMPTZ,
  reviewed_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.rpm_reports IS
  'One row per RPM report generated + emailed. reviewed_by/at is the CPT 99457/99458 review-credit trail.';

ALTER TABLE public.rpm_reports ENABLE ROW LEVEL SECURITY;

-- Read-only for clinicians/admins within the tenant. Inserts are service-role only
-- (edge fn bypasses RLS); reviews are stamped exclusively via log_rpm_report_review
-- (SECURITY DEFINER) so there is deliberately NO authenticated INSERT/UPDATE policy.
CREATE POLICY "rpm_reports_tenant_read" ON public.rpm_reports
  FOR SELECT
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

CREATE INDEX IF NOT EXISTS idx_rpm_reports_tenant ON public.rpm_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rpm_reports_patient ON public.rpm_reports(patient_id);
CREATE INDEX IF NOT EXISTS idx_rpm_reports_enrollment ON public.rpm_reports(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_rpm_reports_created ON public.rpm_reports(created_at DESC);

-- =============================================================================
-- 3) Review attribution RPC (billing-credit stamp)
-- =============================================================================
-- A tenant admin/clinician who opens a report calls this to record that THEY
-- reviewed it. Identity comes from auth.uid() (never client-supplied). Idempotent:
-- the first reviewer wins; re-calls are a no-op so credit is not reassigned.
CREATE OR REPLACE FUNCTION public.log_rpm_report_review(p_report_id UUID)
RETURNS TABLE (report_id UUID, reviewed_by UUID, reviewed_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_tenant UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT r.tenant_id INTO v_tenant FROM public.rpm_reports r WHERE r.id = p_report_id;
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Report not found';
  END IF;

  -- Caller must be a tenant admin of the report's tenant.
  IF v_tenant <> get_current_tenant_id() OR NOT is_tenant_admin() THEN
    RAISE EXCEPTION 'Not authorized to review this report';
  END IF;

  UPDATE public.rpm_reports r
     SET reviewed_by = v_uid,
         reviewed_at = now()
   WHERE r.id = p_report_id
     AND r.reviewed_by IS NULL;  -- first reviewer wins (idempotent)

  RETURN QUERY
    SELECT r.id, r.reviewed_by, r.reviewed_at
    FROM public.rpm_reports r
    WHERE r.id = p_report_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_rpm_report_review(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_rpm_report_review(UUID) TO authenticated;

-- =============================================================================
-- 4) Default routing row for the WellFit tenant (WF-0001) + weekly schedule
-- =============================================================================
INSERT INTO public.rpm_report_settings (tenant_id, recipient_emails, cadence, is_active)
VALUES ('2b902657-6a20-4435-a78a-576f397517ca', '{}', 'weekly', TRUE)
ON CONFLICT (tenant_id) DO NOTHING;

-- Weekly: Mondays 13:00 UTC (~8am Central). Auth mirrors guardian-daily-summary —
-- Bearer <vault sb_secret_key>; the edge function verifies it in-function.
SELECT cron.schedule(
  'rpm-weekly-report',
  '0 13 * * 1',
  $CRON$
  SELECT net.http_post(
    url := 'https://xkybsjnvuohpqpbkikyn.supabase.co/functions/v1/rpm-weekly-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'sb_secret_key' LIMIT 1),
        ''
      )
    ),
    body := jsonb_build_object('trigger', 'cron')
  );
  $CRON$
);
