-- Restore counter RPCs (DB-reference drift triage — rpc:: Batch 10)
-- Tracker: docs/trackers/db-reference-drift-triage-tracker.md (#8, #29, #32)
--
-- Three counter RPCs were referenced by production code but absent from the live DB.
-- Live verification (CLAUDE.md #18) corrected the tracker's guessed backing tables:
--   #32 increment_template_usage  -> questionnaire_templates (id bigint, usage_count int)
--        NOT documentation_templates (name-collision trap; that table has no counter column)
--   #29 increment (generic dynamic table/row/col) -> replaced by a dedicated, injection-safe
--        increment_resource_view_count on resilience_resources.view_count (the only caller)
--   #8  decrement ({x:1} embedded inside .update() — non-functional) -> replaced by a dedicated
--        decrement_beta_participants on beta_programs.current_participants
--
-- All three targets enforce admin/tenant UPDATE RLS, but the real callers are frequently
-- NON-admin paths (a clinician using a template, a member viewing a resource). A SECURITY
-- INVOKER counter would silently no-op for them (which is why the old manual fallbacks also
-- failed). Each function is therefore SECURITY DEFINER but tightly scoped: a single ±1 on one
-- counter column of one row identified by primary key. No PHI, no other columns, no dynamic SQL.

-- #32 — questionnaire template usage counter
CREATE OR REPLACE FUNCTION public.increment_template_usage(template_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.questionnaire_templates
  SET usage_count = COALESCE(usage_count, 0) + 1
  WHERE id = template_id;
END;
$$;
COMMENT ON FUNCTION public.increment_template_usage(bigint) IS
  'Atomically +1 questionnaire_templates.usage_count. SECURITY DEFINER: usage is tracked for any '
  'authenticated user of a template, who may not hold UPDATE RLS on the row. Scoped to one column.';

-- #29 — resilience resource view counter (replaces the generic dynamic rpc(increment))
CREATE OR REPLACE FUNCTION public.increment_resource_view_count(p_resource_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.resilience_resources
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = p_resource_id;
END;
$$;
COMMENT ON FUNCTION public.increment_resource_view_count(uuid) IS
  'Atomically +1 resilience_resources.view_count. SECURITY DEFINER: a view is recorded for any '
  'member, who does not hold the admin-only UPDATE RLS on the row. Scoped to one column.';

-- #8 — beta program participant counter (replaces the non-functional rpc(decrement,{x:1}))
CREATE OR REPLACE FUNCTION public.decrement_beta_participants(p_program_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.beta_programs
  SET current_participants = GREATEST(0, COALESCE(current_participants, 0) - 1)
  WHERE id = p_program_id;
END;
$$;
COMMENT ON FUNCTION public.decrement_beta_participants(uuid) IS
  'Atomically -1 beta_programs.current_participants (floored at 0) when a participant is removed. '
  'SECURITY DEFINER, scoped to one column. GREATEST(0,...) prevents underflow.';

GRANT EXECUTE ON FUNCTION public.increment_template_usage(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_resource_view_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_beta_participants(uuid) TO authenticated;
