-- ============================================================================
-- BACKFILL: Create employee_profiles for existing staff users
-- ============================================================================
-- This migration populates employee_profiles for all existing staff users
-- who have profiles but don't yet have an employee_profile record.
-- ============================================================================

-- Staff role codes (from roles.ts):
-- 1  = SUPER_ADMIN
-- 2  = ADMIN
-- 3  = NURSE
-- 5  = PHYSICIAN
-- 7  = STAFF
-- 8  = NURSE_PRACTITIONER
-- 9  = PHYSICIAN_ASSISTANT
-- 10 = CLINICAL_SUPERVISOR
-- 11 = DEPARTMENT_HEAD
-- 12 = PHYSICAL_THERAPIST
-- 14 = CASE_MANAGER
-- 15 = SOCIAL_WORKER
-- 17 = COMMUNITY_HEALTH_WORKER
-- 18 = CHW
-- 19 = IT_ADMIN

-- ============================================================================
-- Backfill employee_profiles for existing staff
-- ============================================================================
INSERT INTO employee_profiles (
  user_id,
  tenant_id,
  employment_status,
  fte_percentage,
  created_at
)
SELECT
  p.user_id,
  p.tenant_id,
  'active',            -- Default to active
  100.00,              -- Default to full-time
  NOW()
FROM profiles p
WHERE
  p.role_code IN (1, 2, 3, 5, 7, 8, 9, 10, 11, 12, 14, 15, 17, 18, 19)
  AND p.user_id IS NOT NULL
  AND p.tenant_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM employee_profiles ep WHERE ep.user_id = p.user_id
  )
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- Map job titles based on role_code (best-effort default)
-- ============================================================================
UPDATE employee_profiles ep
SET job_title = CASE p.role_code
  WHEN 1 THEN 'Platform Administrator'
  WHEN 2 THEN 'Administrator'
  WHEN 3 THEN 'Registered Nurse'
  WHEN 5 THEN 'Physician'
  WHEN 7 THEN 'Staff Member'
  WHEN 8 THEN 'Nurse Practitioner'
  WHEN 9 THEN 'Physician Assistant'
  WHEN 10 THEN 'Clinical Supervisor'
  WHEN 11 THEN 'Department Head'
  WHEN 12 THEN 'Physical Therapist'
  WHEN 14 THEN 'Case Manager'
  WHEN 15 THEN 'Social Worker'
  WHEN 17 THEN 'Community Health Worker'
  WHEN 18 THEN 'Community Health Worker'
  WHEN 19 THEN 'IT Administrator'
  ELSE NULL
END
FROM profiles p
WHERE ep.user_id = p.user_id
AND ep.job_title IS NULL;

-- ============================================================================
-- Set hire_date to profile created_at if available
-- ============================================================================
UPDATE employee_profiles ep
SET hire_date = p.created_at::DATE
FROM profiles p
WHERE ep.user_id = p.user_id
AND ep.hire_date IS NULL
AND p.created_at IS NOT NULL;

-- ============================================================================
-- Link practitioners to their employee profiles
-- For licensed providers, copy relevant employment data
-- ============================================================================
-- Note: fhir_practitioners contains clinical credentials (NPI, licenses)
-- employee_profiles contains employment data (job title, department, manager)
-- Both tables link to the same user_id

-- If a practitioner has availability_hours, try to infer default_shift
UPDATE employee_profiles ep
SET default_shift = 'day'  -- Default assumption for practitioners with availability
FROM fhir_practitioners fp
WHERE ep.user_id = fp.user_id
AND ep.default_shift IS NULL
AND fp.availability_hours IS NOT NULL;

-- ============================================================================
-- Log the backfill
-- ============================================================================
DO $$
DECLARE
  backfilled_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO backfilled_count
  FROM employee_profiles
  WHERE created_at >= NOW() - INTERVAL '1 minute';

  RAISE NOTICE 'Backfilled % employee profiles', backfilled_count;
END $$;
