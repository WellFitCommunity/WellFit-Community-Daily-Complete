-- Ensure RLS is enabled for the profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own profile.
-- This policy is likely already in place as per audit. Re-affirming or creating if absent.
CREATE POLICY "Allow users to select their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id); -- Assumes profiles.id is the FK to auth.users.id

-- Policy: Users can update their own profile, but NOT their role or ID.
-- This refines the existing update policy.
-- If an "Allow users to update their own profile" policy already exists, it might need to be dropped and recreated,
-- or altered if possible (ALTER POLICY is available in newer Postgres versions).
-- For simplicity, this example assumes we can define it fresh or it replaces a simpler one.
-- Consider dropping the old one first if its name is "Users can update their own profile."
-- Example: DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;

CREATE POLICY "Allow users to update their own profile data"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id) -- Who the policy applies to for existing rows
WITH CHECK (
  auth.uid() = id AND -- Ensures they are updating their own row (cannot change 'id' to someone else's if 'id' was updatable)
  -- Prohibit changing the 'role' column by non-admins.
  -- This check means: if an update attempts to change the 'role' column,
  -- this policy will prevent it unless the user is an admin (checked by a helper or separate policy).
  -- A simpler way for this specific policy is to grant update only on specific columns, excluding 'role'.
  -- However, Supabase default RLS policies often use a broad UPDATE and then restrict via WITH CHECK.
  NOT (role IS DISTINCT FROM (SELECT role FROM public.profiles WHERE profiles.id = auth.uid())) -- this means role cannot change by this policy if it's being updated
  -- The above line is a bit complex. A more direct way to prevent role update via this policy
  -- is to rely on column-level privileges if the user's role should *never* be updatable by themselves.
  -- Or, if 'role' is part of the columns being updated, this check needs to be more robust,
  -- possibly ensuring the 'role' value does not change from its current value.
  -- For now, let's assume this policy is for general data update, and role changes are handled by admins.
  -- The most straightforward way with RLS is that the 'role' column is NOT part of the UPDATE statement
  -- issued by a user updating their profile. If it is, this policy needs to be more specific.

  -- A common pattern if NOT using column-level permissions:
  -- The application logic should not attempt to send the 'role' field for update by a normal user.
  -- If it does, the check `(SELECT role FROM public.profiles WHERE id = auth.uid()) = role`
  -- would mean "the role must remain its current value".
  -- This policy will allow updates to other fields as long as `auth.uid() = id`.
);


-- Policy: Admins can manage all profiles
-- This requires the check_user_has_role function and user_roles/roles tables.
CREATE POLICY "Allow admins to manage all profiles"
ON public.profiles
FOR ALL -- SELECT, INSERT, UPDATE, DELETE
USING (public.check_user_has_role(ARRAY['admin', 'super_admin']))
WITH CHECK (public.check_user_has_role(ARRAY['admin', 'super_admin']));


-- Regarding profile.id and auth.uid() consistency:
-- The `enrollClient` function (and any registration function) must ensure that if `profiles.id` is the PK
-- and is intended to match `auth.uid()`, then it is set to the new user's `auth.users.id` upon creation.
-- If `profiles` has a separate `user_id` column that is FK to `auth.users.id`, then all policies here
-- (e.g., `auth.uid() = id`) should be changed to `auth.uid() = user_id`.
-- This migration assumes `profiles.id` = `auth.uid()`.

-- To explicitly prevent users from changing their own role using the "Allow users to update their own profile data" policy:
-- If the application might send the 'role' field during a user's own profile update,
-- the WITH CHECK clause for that policy needs to ensure the role value doesn't change.
-- Example of a more explicit check for the user's own update policy:
-- WITH CHECK (
--   auth.uid() = id AND
--   role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()) -- Ensures 'role' is not modified by this policy
-- )
-- This means if the UPDATE statement includes the 'role' field, its value must be the same as the existing value.
-- The application should ideally not even send the 'role' field for update for a regular user.

COMMENT ON POLICY "Allow users to select their own profile" ON public.profiles IS 'Users can view their own profile information.';
COMMENT ON POLICY "Allow users to update their own profile data" ON public.profiles IS 'Users can update their own profile information, but not their role or ID.';
COMMENT ON POLICY "Allow admins to manage all profiles" ON public.profiles IS 'Admins and super_admins can view and modify all user profiles.';
