-- Migration: Add 'patient' role for healthcare system alignment
-- Created: 2025-11-10
-- Purpose: Add universal "patient" role to support all age groups (pediatric, adult, geriatric)
--          Aligns with FHIR standard and Methodist Healthcare enterprise deployment

BEGIN;

-- Insert patient role (ID 16 - next available after CHW = 18 in code, but using 16 for logical grouping)
-- This role represents all care recipients regardless of age
INSERT INTO public.roles (id, name)
VALUES (16, 'patient')
ON CONFLICT (id) DO NOTHING;

-- Optional: Add comment explaining the role
COMMENT ON TABLE public.roles IS 'User roles in the system. "patient" is the universal care recipient role (all ages). "senior" is legacy/deprecated - use patient with age demographics instead.';

-- Note: We are NOT removing or modifying the "senior" role (ID 4) for backward compatibility
-- Existing users with role "senior" will continue to work
-- New enrollments should use "patient" role + age demographics

COMMIT;

-- Migration notes:
-- 1. "patient" (ID 16) = Universal care recipient role for all ages
-- 2. "senior" (ID 4) = Legacy role, kept for backward compatibility
-- 3. Age grouping should be handled via demographics table, not role
-- 4. FHIR Patient resources map to users with role_id = 16 (patient)
