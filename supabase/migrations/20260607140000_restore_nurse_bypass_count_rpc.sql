-- Restore get_nurse_bypass_count_last_7_days (DB-reference drift triage — rpc:: Batch 12, #18)
-- Tracker: docs/trackers/db-reference-drift-triage-tracker.md (#18)
--
-- The original (20251018120000_handoff_emergency_bypass) counted from shift_handoff_overrides,
-- but that table was later repurposed for clinical-note overrides. The emergency-bypass feature
-- was rebuilt in 20260527025534_handoff_emergency_bypasses_rebuild.sql against a DEDICATED
-- handoff_emergency_bypasses table — but that rebuild re-created only log_handoff_override (which
-- computes a weekly count internally for its own notification logic), NOT the standalone
-- get_nurse_bypass_count_last_7_days RPC the UI calls (shiftHandoffService.getNurseBypassCount).
-- So this RPC has been missing since the Dec-2025 drop. Authored fresh against the rebuilt table.
--
-- handoff_emergency_bypasses verified live (nurse_id uuid, created_at timestamptz, tenant_id uuid).
-- SECURITY INVOKER: the table has per-nurse RLS (nurse_id = auth.uid() OR tenant admin/super_admin),
-- and the caller passes its own user.id — so RLS scopes the count to the caller's own bypasses
-- (a nurse cannot snoop another nurse's count). This matches the rebuild's deliberate RLS design;
-- the dropped original was SECURITY DEFINER (would count any nurse's bypasses for any caller).

CREATE OR REPLACE FUNCTION public.get_nurse_bypass_count_last_7_days(p_nurse_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM public.handoff_emergency_bypasses
  WHERE nurse_id = p_nurse_id
    AND created_at >= now() - INTERVAL '7 days';

  RETURN COALESCE(v_count, 0);
END;
$$;
COMMENT ON FUNCTION public.get_nurse_bypass_count_last_7_days(uuid) IS
  'Count of a nurse''s emergency handoff bypasses in the last 7 days, from handoff_emergency_bypasses. '
  'SECURITY INVOKER: RLS scopes to the caller''s own rows (or tenant admin/super_admin).';

GRANT EXECUTE ON FUNCTION public.get_nurse_bypass_count_last_7_days(uuid) TO authenticated;
