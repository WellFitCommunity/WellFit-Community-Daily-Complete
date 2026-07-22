-- Transfer repair — DB posture (tracker: docs/trackers/ems-and-hospital-transfer-repair-tracker-2026-07-22.md)
--
-- Live-verified findings this fixes (Phase-0, 2026-07-22, via `supabase db query --linked`):
--   1. ems_provider_signoffs / ems_department_dispatches / prehospital_handoffs have
--      tenant RLS (`tenant_id = get_current_tenant_id()`, FOR ALL, no separate
--      WITH CHECK → the USING gate applies to INSERT) but NO writer sets tenant_id
--      and the columns have NO default → provider sign-off inserts are RLS-rejected,
--      and auto_dispatch_departments (SECURITY INVOKER) fails the same gate, which
--      ERRORS the paramedic's alert-flagged handoff INSERT itself. Fix: BEFORE INSERT
--      tenant-derive triggers (same pattern as the fhir-sync restore, 20260713100000).
--   2. encounter_billing_suggestions: authenticated has SELECT but NOT INSERT/UPDATE
--      (§2a) — the repaired transfer writers store advisory codes there (decision D2).
--   3. allergy_intolerances: authenticated has ZERO grants — post-acute packet
--      composition (tracker P-1) reads it; RLS policies (user-own / admin) still gate rows.
--   4. hospital_departments has no alert contact columns — decision D1 (Maria:
--      Twilio is built + activated) routes department paging via send-sms/send-email.
--   5. No notify path for new department dispatches → AFTER INSERT pg_net trigger
--      invoking send-department-alert (same pattern as trg_notify_ld_alert, 20260714140000).
--   6. storage bucket 'handoff-attachments' missing (its CREATE only ever existed in
--      _ARCHIVE_SKIPPED) → every handoff attachment upload fails.
--
-- Forward-only; no `-- migrate:down` block (db push executes down blocks — documented footgun).

-- ---------------------------------------------------------------------------
-- 1a. Tenant derive: prehospital_handoffs (from the inserting user's tenant)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.derive_tenant_prehospital_handoff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := get_current_tenant_id();
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.derive_tenant_prehospital_handoff() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_derive_tenant_prehospital ON public.prehospital_handoffs;
CREATE TRIGGER trg_derive_tenant_prehospital
BEFORE INSERT ON public.prehospital_handoffs
FOR EACH ROW EXECUTE FUNCTION public.derive_tenant_prehospital_handoff();

-- ---------------------------------------------------------------------------
-- 1b. Tenant derive: dispatch + sign-off rows inherit the parent handoff's tenant
--     (SECURITY DEFINER so the read of the parent row is not itself RLS-blocked)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.derive_tenant_from_ems_handoff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id
    FROM public.prehospital_handoffs
    WHERE id = NEW.handoff_id;
    IF NEW.tenant_id IS NULL THEN
      NEW.tenant_id := get_current_tenant_id();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.derive_tenant_from_ems_handoff() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_derive_tenant_ems_dispatch ON public.ems_department_dispatches;
CREATE TRIGGER trg_derive_tenant_ems_dispatch
BEFORE INSERT ON public.ems_department_dispatches
FOR EACH ROW EXECUTE FUNCTION public.derive_tenant_from_ems_handoff();

DROP TRIGGER IF EXISTS trg_derive_tenant_ems_signoff ON public.ems_provider_signoffs;
CREATE TRIGGER trg_derive_tenant_ems_signoff
BEFORE INSERT ON public.ems_provider_signoffs
FOR EACH ROW EXECUTE FUNCTION public.derive_tenant_from_ems_handoff();

-- ---------------------------------------------------------------------------
-- 2 + 3. Missing GRANTs (§2a — RLS does not grant privileges)
-- ---------------------------------------------------------------------------
GRANT INSERT, UPDATE ON public.encounter_billing_suggestions TO authenticated;
GRANT SELECT ON public.allergy_intolerances TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Department alert contacts (D1 — Twilio paging via send-sms / send-email)
-- ---------------------------------------------------------------------------
ALTER TABLE public.hospital_departments
  ADD COLUMN IF NOT EXISTS alert_phone text,
  ADD COLUMN IF NOT EXISTS alert_email text;
COMMENT ON COLUMN public.hospital_departments.alert_phone IS
  'SMS pager number for EMS department dispatch alerts (send-department-alert edge fn). E.164 format.';
COMMENT ON COLUMN public.hospital_departments.alert_email IS
  'Email inbox for EMS department dispatch alerts (send-department-alert edge fn).';

-- ---------------------------------------------------------------------------
-- 5. Notify on new department dispatch (async pg_net; insert never blocks on it)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_department_dispatch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://xkybsjnvuohpqpbkikyn.supabase.co/functions/v1/send-department-alert',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'sb_secret_key' LIMIT 1),
        ''
      )
    ),
    body := jsonb_build_object(
      'dispatch_id', NEW.id,
      'handoff_id', NEW.handoff_id,
      'tenant_id', NEW.tenant_id,
      'department_code', NEW.department_code,
      'department_name', NEW.department_name,
      'alert_type', NEW.alert_type,
      'alert_priority', NEW.alert_priority
    )
  );
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_department_dispatch() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_department_dispatch ON public.ems_department_dispatches;
CREATE TRIGGER trg_notify_department_dispatch
AFTER INSERT ON public.ems_department_dispatches
FOR EACH ROW EXECUTE FUNCTION public.notify_department_dispatch();

-- ---------------------------------------------------------------------------
-- 6. Storage bucket for handoff attachments (private; labs/EKG/imaging PDFs+images)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'handoff-attachments', 'handoff-attachments', false, 52428800,
  ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "handoff_attachments_upload" ON storage.objects;
CREATE POLICY "handoff_attachments_upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'handoff-attachments');

DROP POLICY IF EXISTS "handoff_attachments_download" ON storage.objects;
CREATE POLICY "handoff_attachments_download"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'handoff-attachments');

DROP POLICY IF EXISTS "handoff_attachments_delete" ON storage.objects;
CREATE POLICY "handoff_attachments_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'handoff-attachments' AND owner = auth.uid());
