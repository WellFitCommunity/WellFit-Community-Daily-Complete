-- Recreate function with debug statements
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
BEGIN
  RAISE NOTICE 'DEBUG: Starting function with input type %', pg_typeof(patients);

  -- Cast TEXT input to JSONB
  patients_jsonb := patients::JSONB;
  RAISE NOTICE 'DEBUG: Cast to JSONB successful, type = %', pg_typeof(patients_jsonb);

  -- Get array length
  arr_len := jsonb_array_length(patients_jsonb);
  RAISE NOTICE 'DEBUG: Array length = %', arr_len;

  FOR i IN 0..(arr_len - 1)
  LOOP
    RAISE NOTICE 'DEBUG: Processing index %', i;

    p := patients_jsonb->i;
    RAISE NOTICE 'DEBUG: Got element, type = %', pg_typeof(p);
    RAISE NOTICE 'DEBUG: Element = %', p;

    RAISE NOTICE 'DEBUG: Extracting first_name...';
    RAISE NOTICE 'DEBUG: first_name = %', p->>'first_name';

    BEGIN
      RAISE NOTICE 'DEBUG: About to call enroll_hospital_patient';

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

      RAISE NOTICE 'DEBUG: enroll_hospital_patient returned %', v_patient_id;

      RETURN QUERY SELECT
        v_patient_id,
        (p->>'first_name' || ' ' || p->>'last_name')::TEXT,
        (p->>'room_number')::TEXT,
        'success'::TEXT;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'DEBUG: Error in enroll_hospital_patient: % - %', SQLSTATE, SQLERRM;
      RETURN QUERY SELECT
        NULL::UUID,
        (p->>'first_name' || ' ' || p->>'last_name')::TEXT,
        (p->>'room_number')::TEXT,
        ('error: ' || SQLERRM)::TEXT;
    END;
  END LOOP;

  RAISE NOTICE 'DEBUG: Function completed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION bulk_enroll_hospital_patients(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_enroll_hospital_patients(TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
