-- L-2 (intake-and-labs tracker): the result-escalation engine was browser-dead —
-- result_escalation_log and result_escalation_rules had RLS policies but NO table
-- GRANTs to authenticated (supabase.md §2a: RLS ≠ GRANT), so every read of the
-- rules and every escalation insert 403'd. Live-verified 2026-07-23:
-- has_table_privilege('authenticated', ..., 'SELECT') = false on both.
--
-- Verbs granted match what the existing policies gate:
--   result_escalation_log: INSERT (escalation_log_insert_system WITH CHECK true),
--     SELECT + UPDATE (clinical-role-gated policies)
--   result_escalation_rules: dashboard reads rules, creates rules, toggles is_active

GRANT SELECT, INSERT, UPDATE ON public.result_escalation_log TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.result_escalation_rules TO authenticated;
