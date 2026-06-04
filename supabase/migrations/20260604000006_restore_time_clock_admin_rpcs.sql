-- ============================================================================
-- Restore time-clock admin RPCs dropped by 20251209110000_drop_broken_functions.sql
-- ============================================================================
-- DB-reference drift triage (rpc:: backlog), batch 8.
--   get_tenant_time_entries  — caller: src/services/timeClockService.ts:326 (getAllTenantEntries)
--   get_team_time_entries    — caller: src/services/timeClockService.ts:360 (getTeamEntries)
--
-- Canonical source: 20251201130000_time_clock_security_fix.sql (verbatim bodies).
-- Forward-only: NO `-- migrate:down` block (systemic root cause #1 — db push runs
-- the whole file and a down-section would self-destruct what the up-section creates).
--
-- ⚠️ The triage tracker's disposition guessed these needed NEW tables
-- (clinician_time_tracking / time_entries). VERIFIED WRONG against the live DB:
-- the functions query the EXISTING `time_clock_entries` table (a name-collision
-- trap like patient_consents). All deps confirmed live before authoring:
--   • time_clock_entries — all 12 referenced columns present, types match the
--     RETURNS TABLE declarations exactly (no casts needed)
--   • profiles.role_code present; employee_profiles has id/user_id/tenant_id/manager_id
-- So this is a verbatim function restore, NOT a schema rebuild.
--
-- Hardening vs the 20251201130000 originals: added `SET search_path = public`
-- (required for SECURITY DEFINER) + explicit GRANT EXECUTE TO authenticated.
-- Server-side authorization is preserved verbatim (auth.uid() identity + tenant
-- match + role_code gating for tenant view; manager-identity + direct-reports
-- scoping for team view).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- get_tenant_time_entries — admin view of all entries in a tenant
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_tenant_time_entries(
  p_tenant_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  first_name TEXT,
  last_name TEXT,
  clock_in_time TIMESTAMPTZ,
  clock_out_time TIMESTAMPTZ,
  status TEXT,
  was_on_time BOOLEAN,
  minutes_early INTEGER,
  total_minutes INTEGER,
  total_hours NUMERIC,
  location TEXT,
  notes TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_tenant_id UUID;
  v_caller_role_code INTEGER;
BEGIN
  -- SECURITY: caller must be an admin within the tenant
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT tenant_id, role_code INTO v_caller_tenant_id, v_caller_role_code
  FROM profiles
  WHERE user_id = auth.uid();

  IF v_caller_tenant_id IS NULL OR v_caller_tenant_id != p_tenant_id THEN
    RAISE EXCEPTION 'Invalid tenant for current user';
  END IF;

  -- Only admins (role_code 1, 2) or department heads (role_code 7) may view all entries
  IF v_caller_role_code NOT IN (1, 2, 7) THEN
    RAISE EXCEPTION 'Insufficient permissions to view tenant time entries';
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.user_id,
    p.first_name,
    p.last_name,
    e.clock_in_time,
    e.clock_out_time,
    e.status,
    e.was_on_time,
    e.minutes_early,
    e.total_minutes,
    e.total_hours,
    e.location,
    e.notes
  FROM time_clock_entries e
  JOIN profiles p ON p.user_id = e.user_id
  WHERE e.tenant_id = p_tenant_id
    AND (p_start_date IS NULL OR e.clock_in_time::date >= p_start_date)
    AND (p_end_date IS NULL OR e.clock_in_time::date <= p_end_date)
  ORDER BY e.clock_in_time DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_tenant_time_entries(UUID, DATE, DATE, INTEGER) TO authenticated;

COMMENT ON FUNCTION public.get_tenant_time_entries(UUID, DATE, DATE, INTEGER) IS
'Admin view of all time-clock entries in a tenant (role_code 1/2/7 gated). Restored 2026-06-04 against existing time_clock_entries.';

-- ----------------------------------------------------------------------------
-- get_team_time_entries — manager view of direct-report entries only
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_team_time_entries(
  p_manager_user_id UUID,
  p_tenant_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  first_name TEXT,
  last_name TEXT,
  clock_in_time TIMESTAMPTZ,
  clock_out_time TIMESTAMPTZ,
  status TEXT,
  was_on_time BOOLEAN,
  minutes_early INTEGER,
  total_minutes INTEGER,
  total_hours NUMERIC,
  location TEXT,
  notes TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_tenant_id UUID;
  v_manager_employee_id UUID;
BEGIN
  -- SECURITY: caller must be the manager whose team is requested
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF auth.uid() != p_manager_user_id THEN
    RAISE EXCEPTION 'Cannot view another manager''s team entries';
  END IF;

  SELECT tenant_id INTO v_caller_tenant_id
  FROM profiles
  WHERE user_id = auth.uid();

  IF v_caller_tenant_id IS NULL OR v_caller_tenant_id != p_tenant_id THEN
    RAISE EXCEPTION 'Invalid tenant for current user';
  END IF;

  -- Resolve the manager's employee profile id
  SELECT id INTO v_manager_employee_id
  FROM employee_profiles
  WHERE user_id = p_manager_user_id AND tenant_id = p_tenant_id;

  IF v_manager_employee_id IS NULL THEN
    RAISE EXCEPTION 'Manager employee profile not found';
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.user_id,
    p.first_name,
    p.last_name,
    e.clock_in_time,
    e.clock_out_time,
    e.status,
    e.was_on_time,
    e.minutes_early,
    e.total_minutes,
    e.total_hours,
    e.location,
    e.notes
  FROM time_clock_entries e
  JOIN profiles p ON p.user_id = e.user_id
  WHERE e.user_id IN (
    SELECT ep.user_id
    FROM employee_profiles ep
    WHERE ep.manager_id = v_manager_employee_id
  )
  AND e.tenant_id = p_tenant_id
  AND (p_start_date IS NULL OR e.clock_in_time::date >= p_start_date)
  AND (p_end_date IS NULL OR e.clock_in_time::date <= p_end_date)
  ORDER BY e.clock_in_time DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_time_entries(UUID, UUID, DATE, DATE) TO authenticated;

COMMENT ON FUNCTION public.get_team_time_entries(UUID, UUID, DATE, DATE) IS
'Manager view of direct-report time-clock entries (self-identity + direct-reports scoped). Restored 2026-06-04 against existing time_clock_entries.';
