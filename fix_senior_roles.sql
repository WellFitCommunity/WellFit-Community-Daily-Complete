-- Fix existing senior users who have incorrect role_code
-- Run this after the migration to correct any existing data

BEGIN;

-- Update any profiles where role is 'senior' but role_code is not 4
UPDATE public.profiles
SET role_code = 4
WHERE role = 'senior'
AND (role_code IS NULL OR role_code != 4);

-- Update any profiles where role_code is 1 (incorrect) to 4 (senior)
-- Only if they don't have admin/super_admin roles
UPDATE public.profiles
SET
  role_code = 4,
  role = 'senior'
WHERE role_code = 1
AND user_id NOT IN (
  SELECT DISTINCT user_id
  FROM public.user_roles
  WHERE role IN ('admin', 'super_admin')
);

-- Verify the changes
SELECT
  role,
  role_code,
  COUNT(*) as count
FROM public.profiles
GROUP BY role, role_code
ORDER BY role, role_code;

COMMIT;