-- 44 live RLS policies gate on user_roles.role (the TEXT staff-designation column,
-- CHECK-constrained to 15 clinical/admin values) — but that column was NULL for the
-- platform's real staff, including BOTH super admins (role_id=2 → roles.name
-- 'super_admin', role text NULL). Result: result_acknowledgments, escalation log
-- reads, medication_alert_overrides, nurse question views, guardian admin panels,
-- consent-signature storage reads etc. denied the very users they were built for.
-- (Found 2026-07-23 by the L-2 live probe: INSERT ... RETURNING on
-- result_escalation_log failed the SELECT policy for Akima.)
--
-- Design note: role text is a STAFF designation — seniors/caregivers/volunteers
-- correctly stay NULL (their names are not in the CHECK vocabulary). The 4 rows
-- with explicit text values are left untouched (never overwrite explicit grants).

-- 1) Backfill NULL staff designations from roles.name where the name is a legal
--    designation (live preview 2026-07-23: 2 super_admin + 6 admin rows).
UPDATE public.user_roles ur
SET role = r.name
FROM public.roles r
WHERE r.id = ur.role_id
  AND ur.role IS NULL
  AND r.name IN (
    'admin','super_admin','it_admin','nurse','nurse_practitioner','physician',
    'doctor','physician_assistant','clinical_supervisor','department_head',
    'physical_therapist','case_manager','social_worker',
    'community_health_worker','chw'
  );

-- 2) Keep-in-sync: default the staff designation from role_id on future
--    inserts/updates — ONLY when role text was not explicitly provided, and only
--    for legal designations. Never overwrites an explicit value.
CREATE OR REPLACE FUNCTION public.sync_user_roles_staff_designation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_name text;
BEGIN
  IF NEW.role IS NULL AND NEW.role_id IS NOT NULL THEN
    SELECT name INTO v_name FROM public.roles WHERE id = NEW.role_id;
    IF v_name IN (
      'admin','super_admin','it_admin','nurse','nurse_practitioner','physician',
      'doctor','physician_assistant','clinical_supervisor','department_head',
      'physical_therapist','case_manager','social_worker',
      'community_health_worker','chw'
    ) THEN
      NEW.role := v_name;
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_sync_user_roles_staff_designation ON public.user_roles;
CREATE TRIGGER trg_sync_user_roles_staff_designation
BEFORE INSERT OR UPDATE OF role_id ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.sync_user_roles_staff_designation();

COMMENT ON FUNCTION public.sync_user_roles_staff_designation() IS
  'Defaults user_roles.role (staff designation text, checked by 44 RLS policies) '
  'from roles.name when not explicitly set. Added 2026-07-23 after the designation '
  'was found NULL for all real staff.';
