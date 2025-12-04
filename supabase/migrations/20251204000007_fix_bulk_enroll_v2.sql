-- ============================================================================
-- Fix bulk_enroll_hospital_patients function v2
-- ============================================================================
-- The issue is that FOR ... IN SELECT * FROM jsonb_array_elements() returns
-- a record type, not JSONB. We need to use proper syntax.
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
  patient_elem JSONB;
  v_patient_id UUID;
BEGIN
  -- Use jsonb_array_elements properly
  FOR patient_elem IN SELECT jsonb_array_elements(patients)
  LOOP
    BEGIN
      -- Enroll each patient
      v_patient_id := enroll_hospital_patient(
        p_first_name := patient_elem->>'first_name',
        p_last_name := patient_elem->>'last_name',
        p_dob := (patient_elem->>'dob')::DATE,
        p_gender := patient_elem->>'gender',
        p_room_number := patient_elem->>'room_number',
        p_mrn := patient_elem->>'mrn',
        p_phone := patient_elem->>'phone',
        p_email := patient_elem->>'email',
        p_emergency_contact_name := patient_elem->>'emergency_contact_name',
        p_caregiver_phone := patient_elem->>'caregiver_phone',
        p_enrollment_notes := patient_elem->>'enrollment_notes'
      );

      RETURN QUERY SELECT
        v_patient_id,
        (patient_elem->>'first_name' || ' ' || patient_elem->>'last_name')::TEXT,
        (patient_elem->>'room_number')::TEXT,
        'success'::TEXT;
    EXCEPTION WHEN OTHERS THEN
      RETURN QUERY SELECT
        NULL::UUID,
        (patient_elem->>'first_name' || ' ' || patient_elem->>'last_name')::TEXT,
        (patient_elem->>'room_number')::TEXT,
        ('error: ' || SQLERRM)::TEXT;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure grants
GRANT EXECUTE ON FUNCTION bulk_enroll_hospital_patients(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_enroll_hospital_patients(JSONB) TO service_role;

-- Verify the function works with a quick test
DO $$
BEGIN
  RAISE NOTICE 'bulk_enroll_hospital_patients function recreated successfully';
END $$;
