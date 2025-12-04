-- Fix the exception handler and also add role_id to enroll_hospital_patient
-- First, check if role_id needs to be added to enroll_hospital_patient

-- Fix bulk_enroll with safe exception handling
DROP FUNCTION IF EXISTS bulk_enroll_hospital_patients(TEXT);

CREATE FUNCTION bulk_enroll_hospital_patients(
  patients TEXT
) RETURNS TABLE(
  patient_id UUID,
  patient_name TEXT,
  room_number TEXT,
  status TEXT
) AS $$
DECLARE
  i INTEGER;
  p JSONB;
  v_patient_id UUID;
  arr_len INTEGER;
  patients_jsonb JSONB;
  v_first_name TEXT;
  v_last_name TEXT;
  v_room_number TEXT;
BEGIN
  -- Cast TEXT input to JSONB
  patients_jsonb := patients::JSONB;

  -- Get array length
  arr_len := jsonb_array_length(patients_jsonb);

  FOR i IN 0..(arr_len - 1)
  LOOP
    p := patients_jsonb->i;

    -- Extract values BEFORE the try block so they're available in exception handler
    v_first_name := p->>'first_name';
    v_last_name := p->>'last_name';
    v_room_number := p->>'room_number';

    BEGIN
      v_patient_id := enroll_hospital_patient(
        p_first_name := v_first_name,
        p_last_name := v_last_name,
        p_dob := (p->>'dob')::DATE,
        p_gender := p->>'gender',
        p_room_number := v_room_number,
        p_mrn := p->>'mrn',
        p_phone := p->>'phone',
        p_email := p->>'email',
        p_emergency_contact_name := p->>'emergency_contact_name',
        p_caregiver_phone := p->>'caregiver_phone',
        p_enrollment_notes := p->>'enrollment_notes'
      );

      RETURN QUERY SELECT
        v_patient_id,
        (v_first_name || ' ' || v_last_name)::TEXT,
        v_room_number,
        'success'::TEXT;
    EXCEPTION WHEN OTHERS THEN
      -- Use the pre-extracted values, not p->> which might fail
      RETURN QUERY SELECT
        NULL::UUID,
        (COALESCE(v_first_name, '?') || ' ' || COALESCE(v_last_name, '?'))::TEXT,
        COALESCE(v_room_number, '?')::TEXT,
        ('error: ' || SQLERRM)::TEXT;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION bulk_enroll_hospital_patients(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_enroll_hospital_patients(TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';

-- Test immediately
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT * FROM bulk_enroll_hospital_patients('[{"first_name": "Fixed", "last_name": "Test", "dob": "1955-03-20", "room_number": "F-01", "mrn": "F-001"}]'::TEXT)
  LOOP
    RAISE NOTICE 'Result: patient_id=%, name=%, room=%, status=%', r.patient_id, r.patient_name, r.room_number, r.status;
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'OUTER Error: % - %', SQLSTATE, SQLERRM;
END $$;
