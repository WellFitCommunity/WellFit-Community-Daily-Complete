-- Correct the profiles.id to reference auth.users.id and add role column

-- Step 1: Drop the existing default for 'id' if it exists
ALTER TABLE public.profiles ALTER COLUMN id DROP DEFAULT;

-- Step 2: Add a temporary column to store auth.users.id if you need to migrate existing data.
-- This step is highly dependent on whether there's live data and how it was populated.
-- For a clean setup or if data migration is handled separately, this might be skipped.
-- Example: ALTER TABLE public.profiles ADD COLUMN auth_user_id UUID;
-- Then you would need a script to populate auth_user_id based on some mapping (e.g., email/phone)
-- and then update profiles.id = profiles.auth_user_id. This is complex.

-- For this migration, we will assume we are correcting the structure going forward
-- and that data migration of existing 'id' values is out of scope for this automated script.
-- If there's existing data, direct application of FK constraint might fail.

-- Step 3: Remove old primary key constraint if it prevents altering the column type or adding FK
-- First, find the name of the primary key constraint if not 'profiles_pkey'
-- SELECT conname FROM pg_constraint WHERE conrelid = 'public.profiles'::regclass AND contype = 'p';
-- Then, ALTER TABLE public.profiles DROP CONSTRAINT <constraint_name>;
-- Assuming it's 'profiles_pkey' for now or that Supabase handles this gracefully when adding FK.

-- Step 4: Ensure 'id' column can be correctly linked.
-- If 'id' values are not already matching auth.users.id, adding the FK directly will fail on existing rows.
-- The following is the TARGET STRUCTURE. Data migration might be needed first.

-- Option A: If 'id' can be directly made a FK (e.g., new table or data already matches)
-- Add the foreign key constraint to auth.users.id
-- This makes profiles.id authoritative and linked to Supabase Auth.
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id)
REFERENCES auth.users(id) ON DELETE CASCADE;

-- Comment: If the above fails due to existing data in 'id' not matching 'auth.users.id',
-- a more involved migration is needed:
-- 1. Add a new column, say `user_id_fk UUID REFERENCES auth.users(id) ON DELETE CASCADE`.
-- 2. Populate `user_id_fk` for existing rows (manual/scripted process).
-- 3. Update RLS policies to use `user_id_fk = auth.uid()`.
-- 4. Eventually, make `user_id_fk` the new `id` or primary means of linking.
-- This migration script will proceed with the simpler correction, assuming it's applicable.

-- Step 5: Add the 'role' column
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'senior';

-- Optional: Add a CHECK constraint for allowed roles
ALTER TABLE public.profiles
ADD CONSTRAINT check_profile_role CHECK (role IN ('senior', 'admin', 'super_admin', 'caregiver', 'doctor')); -- Add more roles as needed

COMMENT ON COLUMN public.profiles.id IS 'References the id of the user in auth.users table.';
COMMENT ON COLUMN public.profiles.role IS 'The role of the user in the application (e.g., senior, admin).';

-- After this, ensure all RLS policies on 'profiles' use 'id = auth.uid()'.
-- The RLS migration `20250725000005_rls_profiles_enhancements.sql` already assumes this.
-- Also, any code that inserts into profiles must ensure 'id' is the auth.users.id.
-- Supabase client's `signUp` or linking profiles on user creation handles this if `profiles.id` is correctly set up as FK.
-- Custom registration functions must manually ensure `id` is set to the `auth.user.id`.
-- The `register` function mentioned in the audit needs to be checked/updated for this.
