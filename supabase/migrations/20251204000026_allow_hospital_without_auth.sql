-- ============================================================================
-- Allow hospital patients without auth.users records
-- ============================================================================
-- Per CLAUDE.md: Hospital Registration creates profiles WITHOUT auth.users records
-- The FK constraint needs to be dropped or made optional for enrollment_type='hospital'
-- ============================================================================

-- First, check if the constraint exists
DO $$
DECLARE
  constraint_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_user_id_fkey'
    AND table_name = 'profiles'
  ) INTO constraint_exists;

  IF constraint_exists THEN
    RAISE NOTICE 'Found profiles_user_id_fkey constraint - will attempt to modify';
  ELSE
    RAISE NOTICE 'No profiles_user_id_fkey constraint found';
  END IF;
END $$;

-- Drop the foreign key constraint if it exists
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;

-- Add it back as optional (no action on delete for hospital patients)
-- Actually, we should NOT add it back for hospital patients
-- Instead, we'll add a check constraint that validates:
-- - If enrollment_type = 'app', user_id must exist in auth.users
-- - If enrollment_type = 'hospital', no auth.users check needed

-- For now, just leave it without the FK - the enrollment_type column handles the distinction

-- Update enroll_hospital_patient to not need auth.users FK
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
  p_enrollment_notes TEXT DEFAULT NULL,
  p_tenant_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_patient_id UUID;
  v_admin_id UUID;
  v_role_id INTEGER;
  v_tenant_id UUID;
BEGIN
  -- Get current admin user
  v_admin_id := auth.uid();

  -- Get patient role_id
  SELECT id INTO v_role_id FROM public.roles WHERE name = 'patient' LIMIT 1;
  IF v_role_id IS NULL THEN
    v_role_id := 1;
  END IF;

  -- Determine tenant_id
  IF p_tenant_id IS NOT NULL THEN
    v_tenant_id := p_tenant_id;
  ELSIF v_admin_id IS NOT NULL THEN
    SELECT tenant_id INTO v_tenant_id FROM profiles WHERE user_id = v_admin_id;
  END IF;

  IF v_tenant_id IS NULL THEN
    SELECT id INTO v_tenant_id FROM tenants WHERE tenant_code = 'WF-0001' LIMIT 1;
  END IF;

  IF v_tenant_id IS NULL THEN
    SELECT id INTO v_tenant_id FROM tenants LIMIT 1;
  END IF;

  -- Generate new UUID for hospital patient
  v_patient_id := gen_random_uuid();

  -- Create hospital patient (no auth.users record needed)
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
    tenant_id,
    enrollment_type,
    enrolled_by,
    enrollment_notes,
    enrollment_date
  ) VALUES (
    v_patient_id,
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
    v_tenant_id,
    'hospital',
    v_admin_id,
    p_enrollment_notes,
    NOW()
  );

  RETURN v_patient_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute
GRANT EXECUTE ON FUNCTION enroll_hospital_patient(TEXT, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION enroll_hospital_patient(TEXT, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO service_role;

-- Test
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT * FROM bulk_enroll_hospital_patients('[{"first_name": "Methodist", "last_name": "Patient", "dob": "1955-03-20", "gender": "Female", "room_number": "METH-01", "mrn": "MRN-METH-001", "enrollment_notes": "Methodist hospital deployment test"}]'::TEXT)
  LOOP
    RAISE NOTICE 'SUCCESS: patient_id=%, name=%, room=%, status=%', r.patient_id, r.patient_name, r.room_number, r.status;
  END LOOP;
END $$;
