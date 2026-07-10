-- Repoint encounters.patient_id's profiles FK from profiles(id) to profiles(user_id).
--
-- encounters.patient_id carries TWO FKs (flagged by the 2026-07-10 pg_constraint
-- sweep, docs/trackers/pg-constraint-collision-sweep-2026-07-10.md):
--   * encounters_patient_id_fkey          -> auth.users(id)  ON DELETE CASCADE  (canonical, §5 — KEPT)
--   * encounters_patient_id_profiles_fkey -> profiles(id)    ON DELETE RESTRICT (embed hint)
--
-- patient_id is semantically a USER id (= profiles.user_id = auth.users.id). The
-- embed FK targeting profiles(id) only works because profiles.id == profiles.user_id
-- for every row today (61/61); it would silently block encounter inserts for any
-- future patient whose profile had id <> user_id. Repointing the SAME-NAMED
-- constraint to profiles(user_id) (the real, PK/unique join key) removes that
-- dormant fragility with ZERO code change — every profiles!encounters_patient_id_profiles_fkey
-- embed keeps resolving by name. All 10 live encounters already match
-- profiles(user_id); the recreated FK validates cleanly. ON DELETE RESTRICT and the
-- auth.users FK are both preserved.
-- Forward-only; no `-- migrate:down` block (db push executes down blocks).

ALTER TABLE public.encounters
  DROP CONSTRAINT IF EXISTS encounters_patient_id_profiles_fkey;

ALTER TABLE public.encounters
  ADD CONSTRAINT encounters_patient_id_profiles_fkey
  FOREIGN KEY (patient_id) REFERENCES public.profiles(user_id) ON DELETE RESTRICT;
