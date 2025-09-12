-- Correct the RLS policy for selecting admin_profile_view_logs

-- Drop the potentially incorrect policy if it exists with the old signature assumption
-- The previous migration might have created it with a different call.
-- It's safer to drop and recreate.
DROP POLICY IF EXISTS "Allow admins to read admin view logs" ON public.admin_profile_view_logs;

-- Recreate the policy with the correct function call signature for check_user_has_role
CREATE POLICY "Allow admins to read admin view logs"
ON public.admin_profile_view_logs
FOR SELECT
USING (public.check_user_has_role(ARRAY['admin', 'super_admin']));

COMMENT ON POLICY "Allow admins to read admin view logs" ON public.admin_profile_view_logs IS 'Admins and super_admins can read admin profile view logs. Corrected function call.';
