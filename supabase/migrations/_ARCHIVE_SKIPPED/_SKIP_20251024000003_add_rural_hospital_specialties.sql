-- Add Rural Hospital Specialties
-- For rural hospital pitches - common specialties needed
--
-- RURAL HOSPITAL NEEDS:
-- 1. Orthopedics - broken bones, joint issues (very common in rural areas)
-- 2. ENT (Ear, Nose, Throat) - infections, hearing issues (common in older adults)
-- 3. General Surgery - emergency procedures
-- 4. Emergency Medicine - ER coverage
--
-- This migration adds specialty seed data for common rural hospital needs

BEGIN;

-- Seed common rural hospital specialties into the system
-- These can be assigned to practitioners in the fhir_practitioners table

-- Note: Practitioners store specialties as TEXT[] in the specialties column
-- Example: UPDATE fhir_practitioners SET specialties = ARRAY['Orthopedics', 'Sports Medicine']

COMMENT ON COLUMN public.fhir_practitioners.specialties IS
  'Array of medical specialties. Common values for rural hospitals:
  - Orthopedics (Orthopedic Surgery)
  - ENT (Otolaryngology/Ear, Nose, Throat)
  - General Surgery
  - Emergency Medicine
  - Family Medicine
  - Internal Medicine
  - Geriatrics
  - Cardiology
  - Physical Therapy';

-- Add helpful specialty constants for reference
DO $$
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'RURAL HOSPITAL SPECIALTY CODES AVAILABLE:';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Primary Care:';
  RAISE NOTICE '  - Family Medicine';
  RAISE NOTICE '  - Internal Medicine';
  RAISE NOTICE '  - Geriatrics';
  RAISE NOTICE '';
  RAISE NOTICE 'Surgical Specialties (RURAL CRITICAL):';
  RAISE NOTICE '  - Orthopedics (Orthopedic Surgery) - BONES, JOINTS, FRACTURES';
  RAISE NOTICE '  - General Surgery';
  RAISE NOTICE '  - ENT (Otolaryngology) - EAR, NOSE, THROAT';
  RAISE NOTICE '';
  RAISE NOTICE 'Emergency & Acute Care:';
  RAISE NOTICE '  - Emergency Medicine';
  RAISE NOTICE '  - Urgent Care';
  RAISE NOTICE '';
  RAISE NOTICE 'Chronic Disease Management:';
  RAISE NOTICE '  - Cardiology';
  RAISE NOTICE '  - Endocrinology (Diabetes)';
  RAISE NOTICE '  - Pulmonology';
  RAISE NOTICE '';
  RAISE NOTICE 'Rehabilitation:';
  RAISE NOTICE '  - Physical Therapy';
  RAISE NOTICE '  - Occupational Therapy';
  RAISE NOTICE '  - Sports Medicine';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'USAGE: Set practitioner specialties using:';
  RAISE NOTICE 'UPDATE fhir_practitioners SET specialties = ARRAY[''Orthopedics'', ''Sports Medicine'']';
  RAISE NOTICE '=================================================================';
END $$;

COMMIT;

-- Example: How to add a practitioner with rural specialties
--
-- INSERT INTO fhir_practitioners (
--   user_id,
--   prefix,
--   given_names,
--   family_name,
--   suffix,
--   specialties,
--   npi,
--   email,
--   phone,
--   active
-- ) VALUES (
--   'user-uuid-here',
--   'Dr.',
--   ARRAY['John', 'Q'],
--   'Smith',
--   'MD',
--   ARRAY['Orthopedics', 'Sports Medicine'],  -- RURAL SPECIALTY
--   '1234567890',
--   'dr.smith@ruralhospital.com',
--   '+15555551234',
--   true
-- );
