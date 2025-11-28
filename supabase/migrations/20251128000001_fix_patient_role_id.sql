-- ============================================================================
-- Add patient role (ID 19)
--
-- Current roles in database:
--   1 = admin
--   2 = super_admin
--   3 = staff
--   4 = senior (default for self-registration)
--   5 = volunteer
--   6 = caregiver
--   7 = physician
--   8 = nurse
--   9 = nurse_practitioner
--   10 = physician_assistant
--   11 = contractor
--   12 = contractor_nurse
--   13 = user
--   14 = moderator
--   15 = social_worker
--   16 = case_manager
--   17 = community_health_worker
--   18 = chw
--   19 = patient (NEW - universal care recipient role)
-- ============================================================================

-- Add patient role (id=19) for UI dropdown selection
-- Uses same tenant_id as other roles
INSERT INTO public.roles (id, name, tenant_id)
SELECT 19, 'patient', '2b902657-6a20-4435-a78a-576f397517ca'
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE id = 19);

-- Update roles table comment with role mapping
COMMENT ON TABLE public.roles IS 'User roles: 1=admin, 2=super_admin, 3=staff, 4=senior, 5=volunteer, 6=caregiver, 7=physician, 8=nurse, 9=nurse_practitioner, 10=physician_assistant, 11=contractor, 12=contractor_nurse, 13=user, 14=moderator, 15=social_worker, 16=case_manager, 17=community_health_worker, 18=chw, 19=patient';
