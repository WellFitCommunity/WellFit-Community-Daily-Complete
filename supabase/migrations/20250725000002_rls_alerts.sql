-- Enable RLS for alerts table
-- This table's user_id column is a foreign key to auth.users(id).
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can SELECT their own alerts
CREATE POLICY "Allow users to select their own alerts"
ON public.alerts
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Allow users to INSERT alerts for themselves (e.g. if self-triggered)
-- This might be too open depending on how alerts are created.
-- Typically, alerts are created by the system or specific functions.
-- If alerts are only created via security definer functions or service_role,
-- then INSERT/UPDATE/DELETE policies for users might not be needed.
-- For now, let's assume users might need to insert if it's a self-reporting panic button.
CREATE POLICY "Allow users to insert their own alerts"
ON public.alerts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Note: UPDATE and DELETE policies for users on alerts are generally not recommended
-- unless a specific use case requires users to modify or retract their own alerts.
-- System-generated alerts should usually be immutable from the user's perspective.

-- Placeholder for Admin Access (more robust solution needed with roles system)
-- This is a simplified version. A better approach would involve checking a 'roles' table
-- or a custom claim in the JWT.
-- For now, we'll rely on admins using a service role key for full access if needed,
-- or this policy can be adapted once the roles system is solidified.
/*
CREATE POLICY "Allow admins to select all alerts"
ON public.alerts
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin')
  )
);
*/
-- Since the roles table and its exact structure/population are not yet confirmed in migrations,
-- this admin policy is commented out. Admins would typically use service_role for backend views.

COMMENT ON POLICY "Allow users to select their own alerts" ON public.alerts IS 'Users can view alerts related to their account.';
COMMENT ON POLICY "Allow users to insert their own alerts" ON public.alerts IS 'Users can create alerts for themselves (e.g., panic button). Review if this is desired.';
