-- Enable RLS for community_moments table
ALTER TABLE public.community_moments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can SELECT their own moments
CREATE POLICY "Allow users to select their own moments"
ON public.community_moments
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can INSERT their own moments
CREATE POLICY "Allow users to insert their own moments"
ON public.community_moments
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can UPDATE their own moments
CREATE POLICY "Allow users to update their own moments"
ON public.community_moments
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can DELETE their own moments
CREATE POLICY "Allow users to delete their own moments"
ON public.community_moments
FOR DELETE
USING (auth.uid() = user_id);

-- Policy: Allow all authenticated users to SELECT moments that are gallery highlights
CREATE POLICY "Allow authenticated users to select gallery highlights"
ON public.community_moments
FOR SELECT
TO authenticated
USING (is_gallery_highlight = TRUE);

-- Grant usage on the table to authenticated role (if not already granted)
-- This is often necessary for RLS policies to apply correctly.
-- Check existing grants before applying.
-- Example: GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_moments TO authenticated;
-- For this setup, we assume authenticated users already have basic permissions,
-- and RLS further restricts them. If they don't, the policies won't grant anything.
-- The default Supabase setup usually grants broad permissions to 'authenticated' role.

COMMENT ON POLICY "Allow users to select their own moments" ON public.community_moments IS 'Users can view the community moments they created.';
COMMENT ON POLICY "Allow users to insert their own moments" ON public.community_moments IS 'Users can create new community moments for themselves.';
COMMENT ON POLICY "Allow users to update their own moments" ON public.community_moments IS 'Users can update the community moments they created.';
COMMENT ON POLICY "Allow users to delete their own moments" ON public.community_moments IS 'Users can delete the community moments they created.';
COMMENT ON POLICY "Allow authenticated users to select gallery highlights" ON public.community_moments IS 'Any authenticated user can view moments marked as gallery highlights.';
