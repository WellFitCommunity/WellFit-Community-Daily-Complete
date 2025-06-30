-- Enable Row Level Security for the profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Allow users to view their own profile
-- Assumes that profiles.id is the same as auth.uid()
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

-- Policy: Allow users to update their own profile
-- Assumes that profiles.id is the same as auth.uid()
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Policy: Allow users to delete their own profile (Optional, add if needed)
-- CREATE POLICY "Users can delete their own profile"
-- ON public.profiles FOR DELETE
-- USING (auth.uid() = id);

-- Note: The 'register' Supabase function uses the service_role key,
-- which bypasses RLS by default, so it will still be able to insert new profiles.
-- If for some reason it didn't, you might need:
-- CREATE POLICY "Allow service role to insert profiles"
-- ON public.profiles FOR INSERT
-- WITH CHECK (auth.role() = 'service_role');

-- Allow anonymous users to call RPC functions if needed for login/register,
-- but the tables themselves should be protected.
-- This is generally handled by function security definer or explicit grants on functions.

-- Ensure existing data conforms or this might lock out users if their profiles.id doesn't match an auth.uid()
-- This is a critical consideration for existing applications.
-- For a new setup, this implies the registration/login flow must ensure profiles.id becomes auth.uid().
-- One way is to set profiles.id = new_user.id from auth.users upon user creation.
-- The current register function uses gen_random_uuid() for profiles.id.
-- This means the login function *must* create an auth.users record with this UUID,
-- or the RLS policies above will not work as intended.

COMMENT ON POLICY "Users can view their own profile" ON public.profiles IS 'Ensures users can only read their own profile data.';
COMMENT ON POLICY "Users can update their own profile" ON public.profiles IS 'Ensures users can only update their own profile data.';
