-- ============================================================================
-- Fix sync_user_roles_from_profiles to skip hospital patients
-- ============================================================================

-- Show current function
DO $$
DECLARE
  func_src TEXT;
BEGIN
  SELECT prosrc INTO func_src FROM pg_proc WHERE proname = 'sync_user_roles_from_profiles';
  RAISE NOTICE 'Current function: %', LEFT(func_src, 500);
END $$;

-- Drop the user_roles FK constraint
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;

-- Update the trigger function to skip hospital patients
CREATE OR REPLACE FUNCTION sync_user_roles_from_profiles()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip for hospital patients (they don't have auth.users records)
  IF NEW.enrollment_type = 'hospital' THEN
    RETURN NEW;
  END IF;

  -- Only sync if role_id is set
  IF NEW.role_id IS NOT NULL THEN
    -- Insert or update user_roles (no is_primary column in current schema)
    INSERT INTO user_roles (user_id, role_id)
    VALUES (NEW.user_id, NEW.role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Test again
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT * FROM bulk_enroll_hospital_patients('[{"first_name": "Methodist", "last_name": "Patient", "dob": "1955-03-20", "gender": "Female", "room_number": "METH-01", "mrn": "MRN-METH-003", "enrollment_notes": "Methodist hospital deployment test"}]'::TEXT)
  LOOP
    RAISE NOTICE 'Result: patient_id=%, name=%, room=%, status=%', r.patient_id, r.patient_name, r.room_number, r.status;
  END LOOP;
END $$;
