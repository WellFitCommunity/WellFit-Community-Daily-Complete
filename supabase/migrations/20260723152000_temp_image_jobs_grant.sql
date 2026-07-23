-- temp_image_jobs: missing GRANT to authenticated (supabase.md §2a — RLS ≠ GRANT).
--
-- Live-verified 2026-07-23: has_table_privilege('authenticated','public.temp_image_jobs','INSERT')
-- returned false — the creating migration (20251209200000_web_vital_capture_system.sql)
-- enabled RLS + policies but granted nothing, so every client call 403'd
-- ("permission denied for table temp_image_jobs") before the RLS policy was even evaluated.
-- Sibling check per §2a: vital_capture_sources (same migration) already has its
-- SELECT grant — temp_image_jobs was the only gap.
--
-- Verbs scoped to actual callers: VitalCapture.tsx needs INSERT + SELECT;
-- process-vital-image (user client) needs SELECT + UPDATE. DELETE stays
-- service-role-only (cleanup-temp-images edge function).

GRANT SELECT, INSERT, UPDATE ON public.temp_image_jobs TO authenticated;
