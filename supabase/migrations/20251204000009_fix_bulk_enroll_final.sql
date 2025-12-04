-- ============================================================================
-- Fix bulk_enroll_hospital_patients function - FINAL FIX
-- ============================================================================
-- The issue: FOR var IN SELECT jsonb_array_elements(x) assigns a RECORD not JSONB
-- Solution: Extract with proper casting using (val).value syntax
-- ============================================================================

DROP FUNCTION IF EXISTS bulk_enroll_hospital_patients(JSONB);

CREATE OR REPLACE FUNCTION bulk_enroll_hospital_patients(
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
  -- Iterate through patients array - extract JSONB element properly
  FOR rec IN SELECT * FROM jsonb_array_elements(patients) AS elem(val)
  LOOP
    p := rec.val;  -- Now p is properly JSONB

    BEGIN
      -- Enroll each patient
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

-- Ensure grants
GRANT EXECUTE ON FUNCTION bulk_enroll_hospital_patients(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_enroll_hospital_patients(JSONB) TO service_role;

-- Force PostgREST to reload
NOTIFY pgrst, 'reload schema';

-- Quick verification
DO $$
BEGIN
  RAISE NOTICE 'bulk_enroll_hospital_patients FINAL version deployed';
END $$;
