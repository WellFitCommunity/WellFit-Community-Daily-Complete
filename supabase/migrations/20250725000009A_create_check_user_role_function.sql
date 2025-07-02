-- Helper function to check if the current user has specified roles.
-- This function depends on 'roles' and 'user_roles' tables existing.
CREATE OR REPLACE FUNCTION public.check_user_has_role(role_names TEXT[])
RETURNS BOOLEAN AS $$
DECLARE
  has_role BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.name = ANY(role_names)
  ) INTO has_role;
  RETURN has_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Revoke execute on function from public if necessary and grant to authenticated users or specific roles.
-- Granting to 'authenticated' allows any logged-in user to call it,
-- which is fine as it only reveals their own roles.
REVOKE EXECUTE ON FUNCTION public.check_user_has_role(TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_user_has_role(TEXT[]) TO authenticated;

COMMENT ON FUNCTION public.check_user_has_role(TEXT[]) IS 'Checks if the currently authenticated user possesses any of the specified roles. Returns true if user has at least one of the roles, false otherwise.';
