-- 20250528035000_remove_public_rls_policies_profiles.sql
-- Purpose: Remove unsafe or unnecessary RLS policies tied to the "public" role on the "profiles" table

-- +migrate:up
DROP POLICY IF EXISTS "Allow insert on profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow update on profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow select on profile" ON public.profiles;

-- +migrate:down
-- Restore public-level policies if absolutely needed (NOT RECOMMENDED in production)
CREATE POLICY "Allow insert on profile"
  ON public.profiles
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow update on profile"
  ON public.profiles
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow select on profile"
  ON public.profiles
  FOR SELECT
  TO public
  USING (true);
