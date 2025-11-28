-- ============================================================================
-- Ensure patient role exists at ID 19
-- Role IDs in this system:
--   1 = admin
--   2 = super_admin
--   4 = senior (default for self-registration)
--   16 = case_manager
--   19 = patient
-- ============================================================================

-- Ensure patient role exists (for UI dropdown selection)
INSERT INTO public.roles (id, name)
VALUES (19, 'patient')
ON CONFLICT (id) DO NOTHING;

-- Update roles table comment with correct role mapping
COMMENT ON TABLE public.roles IS 'User roles: 1=admin, 2=super_admin, 4=senior, 16=case_manager, 19=patient';
