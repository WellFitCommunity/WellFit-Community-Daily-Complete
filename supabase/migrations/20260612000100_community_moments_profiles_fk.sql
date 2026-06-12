-- Add FK: community_moments.user_id -> profiles(user_id) for PostgREST embedding.
--
-- Why: the gallery query embeds `profile:profiles(first_name,last_name)`. PostgREST can
-- only embed a table it has a foreign-key relationship to. community_moments.user_id
-- already has FKs to auth.users(id), but NONE to profiles -> the embed fails with HTTP 400
-- ("could not find a relationship ... in the schema cache").
--
-- Root cause of the long-standing drift (corrected diagnosis):
-- migrations 20251222000002 and 20260130000001, AND the earlier 20260612000000 in this
-- same fix, all tried to ADD a constraint literally named `community_moments_user_id_fkey`
-- pointing at profiles. But that exact name was ALREADY taken by a pre-existing FK to
-- auth.users(id). Each attempt's `IF NOT EXISTS (... constraint_name = 'community_moments_user_id_fkey')`
-- guard matched the auth.users constraint and silently skipped -- a NAME COLLISION, not the
-- "orphaned records" the old comments guessed. This migration uses a distinct constraint
-- name and guards on the *relationship to profiles*, not on a constraint name, so it cannot
-- be defeated by a name clash again.
--
-- Safe to add: verified 2026-06-12 there are 0 community_moments rows whose user_id has no
-- matching profiles.user_id, and profiles.user_id is unique.

DO $$
BEGIN
  -- Guard on whether ANY FK already links community_moments.user_id -> public.profiles,
  -- regardless of its name. Only add if none exists.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class rel       ON rel.oid = con.conrelid
    JOIN pg_namespace nsp   ON nsp.oid = rel.relnamespace
    JOIN pg_class frel      ON frel.oid = con.confrelid
    JOIN pg_namespace fnsp  ON fnsp.oid = frel.relnamespace
    WHERE con.contype = 'f'
      AND nsp.nspname = 'public' AND rel.relname  = 'community_moments'
      AND fnsp.nspname = 'public' AND frel.relname = 'profiles'
      AND con.conkey = ARRAY[
            (SELECT attnum FROM pg_attribute
             WHERE attrelid = rel.oid AND attname = 'user_id')
          ]::smallint[]
  ) THEN
    ALTER TABLE public.community_moments
      ADD CONSTRAINT community_moments_user_id_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;
  END IF;
END $$;

-- Reload PostgREST's schema cache so the embed resolves immediately.
NOTIFY pgrst, 'reload schema';
