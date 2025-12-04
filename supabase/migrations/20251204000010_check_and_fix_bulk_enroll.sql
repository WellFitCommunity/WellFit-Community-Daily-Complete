-- ============================================================================
-- Check for and remove any duplicate bulk_enroll functions, then recreate
-- ============================================================================

-- First see all versions of the function
DO $$
DECLARE
  func RECORD;
BEGIN
  RAISE NOTICE 'Looking for bulk_enroll_hospital_patients variants...';
  FOR func IN
    SELECT proname, proargtypes, pronargs, prorettype
    FROM pg_proc
    WHERE proname = 'bulk_enroll_hospital_patients'
  LOOP
    RAISE NOTICE 'Found: proname=%, pronargs=%, proargtypes=%', func.proname, func.pronargs, func.proargtypes;
  END LOOP;
END $$;

-- Drop ALL versions
DROP FUNCTION IF EXISTS bulk_enroll_hospital_patients(JSONB);
DROP FUNCTION IF EXISTS bulk_enroll_hospital_patients(TEXT);
DROP FUNCTION IF EXISTS bulk_enroll_hospital_patients(JSON);

-- Create the ONLY version with explicit JSONB
CREATE FUNCTION bulk_enroll_hospital_patients(
  patients JSONB
) RETURNS TABLE(
  patient_id UUID,
  patient_name TEXT,
  room_number TEXT,
  status TEXT
) AS $$
DECLARE
  rec RECORD;
  v_patient_id UUID;
  p JSONB;
BEGIN
  -- Iterate through patients array with explicit typing
  FOR rec IN SELECT elem FROM jsonb_array_elements(patients) AS elem
  LOOP
    p := rec.elem;  -- rec.elem is JSONB

    BEGIN
      v_patient_id := enroll_hospital_patient(
        p_first_name := p->>'first_name',
        p_last_name := p->>'last_name',
        p_dob := (p->>'dob')::DATE,
        p_gender := p->>'gender',
        p_room_number := p->>'room_number',
        p_mrn := p->>'mrn',
        p_phone := p->>'phone',
        p_email := p->>'email',
        p_emergency_contact_name := p->>'emergency_contact_name',
        p_caregiver_phone := p->>'caregiver_phone',
        p_enrollment_notes := p->>'enrollment_notes'
      );

      RETURN QUERY SELECT
        v_patient_id,
        (p->>'first_name' || ' ' || p->>'last_name')::TEXT,
        (p->>'room_number')::TEXT,
        'success'::TEXT;
    EXCEPTION WHEN OTHERS THEN
      RETURN QUERY SELECT
        NULL::UUID,
        (p->>'first_name' || ' ' || p->>'last_name')::TEXT,
        (p->>'room_number')::TEXT,
        ('error: ' || SQLERRM)::TEXT;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grants
GRANT EXECUTE ON FUNCTION bulk_enroll_hospital_patients(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_enroll_hospital_patients(JSONB) TO service_role;

-- Reload PostgREST schema
NOTIFY pgrst, 'reload schema';

-- Check result
DO $$
DECLARE
  cnt INTEGER;
BEGIN
  SELECT COUNT(*) INTO cnt FROM pg_proc WHERE proname = 'bulk_enroll_hospital_patients';
  RAISE NOTICE 'Final count of bulk_enroll_hospital_patients functions: %', cnt;
END $$;
