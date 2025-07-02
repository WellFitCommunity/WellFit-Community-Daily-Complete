-- Create admin_profile_view_logs table
CREATE TABLE IF NOT EXISTS public.admin_profile_view_logs (
  id BIGSERIAL PRIMARY KEY,
  admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL, -- Admin who viewed the profile
  viewed_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, -- Profile that was viewed
  viewed_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  ip_address TEXT, -- Optional: IP address of the admin
  user_agent TEXT -- Optional: User agent of the admin
);

COMMENT ON TABLE public.admin_profile_view_logs IS 'Logs when an admin views a user profile for audit purposes.';
COMMENT ON COLUMN public.admin_profile_view_logs.admin_user_id IS 'ID of the admin user who performed the view action.';
COMMENT ON COLUMN public.admin_profile_view_logs.viewed_profile_id IS 'ID of the user profile that was viewed.';
COMMENT ON COLUMN public.admin_profile_view_logs.viewed_at IS 'Timestamp of when the profile was viewed.';
COMMENT ON COLUMN public.admin_profile_view_logs.ip_address IS 'IP address of the admin at the time of viewing.';
COMMENT ON COLUMN public.admin_profile_view_logs.user_agent IS 'User agent string of the admin''s browser/client.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_profile_view_logs_admin_id ON public.admin_profile_view_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_profile_view_logs_profile_id ON public.admin_profile_view_logs(viewed_profile_id);
CREATE INDEX IF NOT EXISTS idx_admin_profile_view_logs_viewed_at ON public.admin_profile_view_logs(viewed_at DESC);

-- RLS for admin_profile_view_logs
ALTER TABLE public.admin_profile_view_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role to insert logs (e.g., from a Supabase function)
CREATE POLICY "Allow service_role to insert admin view logs"
ON public.admin_profile_view_logs
FOR INSERT
TO service_role -- Or a specific role if you create one for logging
WITH CHECK (true);

-- Policy: Allow admins/super_admins to read logs (for audit review)
-- This uses the check_user_has_role function assumed to be present from previous migrations.
CREATE POLICY "Allow admins to read admin view logs"
ON public.admin_profile_view_logs
FOR SELECT
USING (public.check_user_has_role(auth.uid(), ARRAY['admin', 'super_admin']));

-- Note: Deletion or Update of these logs should be highly restricted,
-- typically only allowed for super_admins or database administrators directly for maintenance.
-- Example (very restrictive delete policy):
-- CREATE POLICY "Allow super_admins to delete old logs"
-- ON public.admin_profile_view_logs
-- FOR DELETE
-- USING (public.check_user_has_role(auth.uid(), ARRAY['super_admin']));

-- Ensure the check_user_has_role function is available.
-- If not, this is a dependency:
-- CREATE OR REPLACE FUNCTION public.check_user_has_role(user_id_to_check uuid, target_roles text[])
-- RETURNS boolean
-- LANGUAGE plpgsql
-- SECURITY DEFINER -- Important for accessing user_roles table
-- SET search_path = public
-- AS $$
-- BEGIN
--   IF auth.uid() IS NULL THEN -- Ensure function is called by an authenticated user or service_role
--     RETURN FALSE;
--   END IF;
--   RETURN EXISTS (
--     SELECT 1
--     FROM user_roles ur
--     JOIN roles r ON ur.role_id = r.id
--     WHERE ur.user_id = user_id_to_check
--       AND r.name = ANY(target_roles)
--   );
-- END;
-- $$;
-- GRANT EXECUTE ON FUNCTION public.check_user_has_role(uuid, text[]) TO authenticated;
