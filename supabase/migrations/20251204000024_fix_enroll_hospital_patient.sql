-- ============================================================================
-- Fix enroll_hospital_patient to include role_id
-- ============================================================================

-- First, check what role_id we need for patient
DO $$
DECLARE
  patient_role_id INTEGER;
BEGIN
  SELECT id INTO patient_role_id FROM public.roles WHERE name = 'patient' LIMIT 1;
  RAISE NOTICE 'Patient role_id: %', patient_role_id;
END $$;

-- Recreate the function with role_id
CREATE OR REPLACE FUNCTION enroll_hospital_patient(
  p_first_name TEXT,
  p_last_name TEXT,
  p_dob DATE,
  p_gender TEXT DEFAULT NULL,
  p_room_number TEXT DEFAULT NULL,
  p_mrn TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_emergency_contact_name TEXT DEFAULT NULL,
  p_caregiver_phone TEXT DEFAULT NULL,
  p_enrollment_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_patient_id UUID;
  v_admin_id UUID;
  v_role_id INTEGER;
BEGIN
  -- Get current admin user
  v_admin_id := auth.uid();

  -- Get patient role_id by name
  SELECT id INTO v_role_id FROM public.roles WHERE name = 'patient' LIMIT 1;

  -- If still no role found, use 1 as default
  IF v_role_id IS NULL THEN
    v_role_id := 1;
  END IF;

  -- Create hospital patient (no auth.users record)
  INSERT INTO profiles (
    user_id,
    first_name,
    last_name,
    dob,
    gender,
    room_number,
    mrn,
    phone,
    email,
    emergency_contact_name,
    caregiver_phone,
    role,
    role_code,
    role_id,
    enrollment_type,
    enrolled_by,
    enrollment_notes,
    enrollment_date
  ) VALUES (
    gen_random_uuid(),
    p_first_name,
    p_last_name,
    p_dob,
    p_gender,
    p_room_number,
    p_mrn,
    p_phone,
    p_email,
    p_emergency_contact_name,
    p_caregiver_phone,
    'patient',
    1,
    v_role_id,
    'hospital',
    v_admin_id,
    p_enrollment_notes,
    NOW()
  )
  RETURNING user_id INTO v_patient_id;

  RETURN v_patient_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION enroll_hospital_patient TO authenticated;
GRANT EXECUTE ON FUNCTION enroll_hospital_patient TO service_role;

-- Test the full flow now
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT * FROM bulk_enroll_hospital_patients('[{"first_name": "Methodist", "last_name": "Test", "dob": "1955-03-20", "gender": "Female", "room_number": "METH-01", "mrn": "MRN-METH-001", "enrollment_notes": "Methodist deployment test"}]'::TEXT)
  LOOP
    RAISE NOTICE 'Result: patient_id=%, name=%, room=%, status=%', r.patient_id, r.patient_name, r.room_number, r.status;
  END LOOP;
END $$;
