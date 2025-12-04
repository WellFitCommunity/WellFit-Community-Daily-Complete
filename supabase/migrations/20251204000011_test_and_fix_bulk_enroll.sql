-- ============================================================================
-- Debug and fix bulk_enroll_hospital_patients
-- ============================================================================

-- First, test the jsonb_array_elements directly
DO $$
DECLARE
  test_json JSONB := '[{"name": "test"}]'::JSONB;
  rec RECORD;
BEGIN
  FOR rec IN SELECT jsonb_array_elements(test_json) AS elem
  LOOP
    RAISE NOTICE 'Type of rec: %', pg_typeof(rec);
    RAISE NOTICE 'Type of rec.elem: %', pg_typeof(rec.elem);
    RAISE NOTICE 'Value: %', rec.elem;
    RAISE NOTICE 'Extracted: %', rec.elem->>'name';
  END LOOP;
END $$;

-- Drop and recreate with explicit approach that works
DROP FUNCTION IF EXISTS bulk_enroll_hospital_patients(JSONB);

CREATE FUNCTION bulk_enroll_hospital_patients(
  patients JSONB
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
BEGIN
  -- Use array index approach which is unambiguous
  arr_len := jsonb_array_length(patients);

  FOR i IN 0..(arr_len - 1)
  LOOP
    p := patients->i;  -- Get element by index

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

-- Reload PostgREST
NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
  RAISE NOTICE 'bulk_enroll_hospital_patients using array index approach deployed';
END $$;
