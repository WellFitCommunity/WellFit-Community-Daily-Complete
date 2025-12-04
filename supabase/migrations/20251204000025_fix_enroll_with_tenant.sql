-- ============================================================================
-- Fix enroll_hospital_patient to include tenant_id
-- ============================================================================

-- Drop old versions first
DROP FUNCTION IF EXISTS enroll_hospital_patient(TEXT, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS enroll_hospital_patient(TEXT, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID);

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

  -- Get patient role_id by name
  SELECT id INTO v_role_id FROM public.roles WHERE name = 'patient' LIMIT 1;
  IF v_role_id IS NULL THEN
    v_role_id := 1;
  END IF;

  -- Determine tenant_id
  IF p_tenant_id IS NOT NULL THEN
    v_tenant_id := p_tenant_id;
  ELSIF v_admin_id IS NOT NULL THEN
    -- Get tenant_id from the enrolling admin's profile
    SELECT tenant_id INTO v_tenant_id FROM profiles WHERE user_id = v_admin_id;
  END IF;

  -- If still no tenant_id, use default WellFit tenant
  IF v_tenant_id IS NULL THEN
    SELECT id INTO v_tenant_id FROM tenants WHERE tenant_code = 'WF-0001' LIMIT 1;
  END IF;

  -- If STILL no tenant_id, get any tenant
  IF v_tenant_id IS NULL THEN
    SELECT id INTO v_tenant_id FROM tenants LIMIT 1;
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
    tenant_id,
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
    v_tenant_id,
    'hospital',
    v_admin_id,
    p_enrollment_notes,
    NOW()
  )
  RETURNING user_id INTO v_patient_id;

  RETURN v_patient_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users (use full signature)
GRANT EXECUTE ON FUNCTION enroll_hospital_patient(TEXT, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION enroll_hospital_patient(TEXT, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO service_role;

-- Test the full flow now
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT * FROM bulk_enroll_hospital_patients('[{"first_name": "Methodist", "last_name": "Patient", "dob": "1955-03-20", "gender": "Female", "room_number": "METH-01", "mrn": "MRN-METH-001", "enrollment_notes": "Methodist hospital deployment test"}]'::TEXT)
  LOOP
    RAISE NOTICE 'Result: patient_id=%, name=%, room=%, status=%', r.patient_id, r.patient_name, r.room_number, r.status;
  END LOOP;
END $$;
