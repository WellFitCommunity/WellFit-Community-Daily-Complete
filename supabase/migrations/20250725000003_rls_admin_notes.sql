-- Enable RLS for admin_notes table
-- Assuming admin_notes table exists. If not, it should be created first.
-- CREATE TABLE IF NOT EXISTS public.admin_notes (
--   id BIGSERIAL PRIMARY KEY,
--   senior_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
--   created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT, -- or auth.users(id)
--   note TEXT NOT NULL,
--   created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
--   updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
-- );

ALTER TABLE public.admin_notes ENABLE ROW LEVEL SECURITY;

-- Policy: Allow admins and super_admins to perform all actions on admin_notes
-- This policy depends on the public.check_user_has_role(TEXT[]) function being defined
-- in a separate, earlier migration, AFTER roles and user_roles tables are created.


-- Helper function to check if the current user has specified roles.
-- This function should be created once and reused.
-- Ensure it's created in a separate, earlier migration if it doesn't exist.
CREATE OR REPLACE FUNCTION public.check_user_has_role(role_names TEXT[])
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.name = ANY(role_names)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Revoke execute on function from public if necessary and grant to authenticated
REVOKE EXECUTE ON FUNCTION public.check_user_has_role(TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_user_has_role(TEXT[]) TO authenticated;


-- Policy: Allow admins and super_admins to perform all actions on admin_notes

CREATE POLICY "Allow admins full access to admin_notes"
ON public.admin_notes
FOR ALL -- Covers SELECT, INSERT, UPDATE, DELETE
USING (public.check_user_has_role(ARRAY['admin', 'super_admin']))
WITH CHECK (public.check_user_has_role(ARRAY['admin', 'super_admin']));

COMMENT ON TABLE public.admin_notes IS 'Stores notes written by admins about senior users.';
COMMENT ON POLICY "Allow admins full access to admin_notes" ON public.admin_notes IS 'Only users with admin or super_admin roles can manage admin notes.';
