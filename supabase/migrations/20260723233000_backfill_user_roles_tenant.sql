-- Second stacked gap behind the 44 dead role-gated RLS policies (see
-- 20260723230000): user_roles_select requires tenant_id = get_current_tenant_id(),
-- but user_roles.tenant_id was NULL for 67/70 rows — so NO user could see their
-- own role row, and every `EXISTS (SELECT 1 FROM user_roles WHERE user_id =
-- auth.uid() AND role = ...)` policy across the platform evaluated false for
-- everyone. Live-proven 2026-07-23: as Akima (super_admin),
-- `SELECT count(*) FROM user_roles WHERE user_id = auth.uid()` returned 0.

-- 1) Backfill tenant_id from the user's profile (only where missing and the
--    profile has a tenant).
UPDATE public.user_roles ur
SET tenant_id = p.tenant_id
FROM public.profiles p
WHERE p.user_id = ur.user_id
  AND ur.tenant_id IS NULL
  AND p.tenant_id IS NOT NULL;

-- 2) Extend the keep-in-sync trigger fn (20260723230000) to also derive
--    tenant_id from the profile when not provided.
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

  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id
    FROM public.profiles WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$fn$;

-- Retarget the trigger to also fire on plain inserts/updates regardless of
-- which columns changed (tenant derivation must not depend on role_id changing).
DROP TRIGGER IF EXISTS trg_sync_user_roles_staff_designation ON public.user_roles;
CREATE TRIGGER trg_sync_user_roles_staff_designation
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.sync_user_roles_staff_designation();
