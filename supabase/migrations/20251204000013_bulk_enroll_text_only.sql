-- ============================================================================
-- Replace bulk_enroll_hospital_patients with TEXT-only version
-- ============================================================================
-- PostgREST can't resolve between TEXT and JSONB overloads.
-- Keep only the TEXT version that casts internally.
-- ============================================================================

-- Drop both versions
DROP FUNCTION IF EXISTS bulk_enroll_hospital_patients(JSONB);
DROP FUNCTION IF EXISTS bulk_enroll_hospital_patients(TEXT);

-- Create single TEXT version with internal JSONB cast
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
  -- Cast TEXT input to JSONB
  patients_jsonb := patients::JSONB;

  -- Get array length
  arr_len := jsonb_array_length(patients_jsonb);

  FOR i IN 0..(arr_len - 1)
  LOOP
    p := patients_jsonb->i;

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
GRANT EXECUTE ON FUNCTION bulk_enroll_hospital_patients(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_enroll_hospital_patients(TEXT) TO service_role;

-- Reload schema
NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
  RAISE NOTICE 'bulk_enroll_hospital_patients TEXT-only version deployed';
END $$;
