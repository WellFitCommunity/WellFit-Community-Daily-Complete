-- ============================================================================
-- Fix bulk_enroll_hospital_patients function
-- ============================================================================
-- Issue: FOR loop with jsonb_array_elements returns a record, not JSONB directly
-- Fix: Use jsonb_array_elements(patients) AS elem(patient) to properly bind
-- ============================================================================

CREATE OR REPLACE FUNCTION bulk_enroll_hospital_patients(
  patients JSONB
) RETURNS TABLE(
  patient_id UUID,
  patient_name TEXT,
  room_number TEXT,
  status TEXT
) AS $$
DECLARE
  patient_record JSONB;
  v_patient_id UUID;
BEGIN
  -- Iterate through patients array - properly extract JSONB elements
  FOR patient_record IN SELECT value FROM jsonb_array_elements(patients)
  LOOP
    BEGIN
      -- Enroll each patient
      v_patient_id := enroll_hospital_patient(
        p_first_name := patient_record->>'first_name',
        p_last_name := patient_record->>'last_name',
        p_dob := (patient_record->>'dob')::DATE,
        p_gender := patient_record->>'gender',
        p_room_number := patient_record->>'room_number',
        p_mrn := patient_record->>'mrn',
        p_phone := patient_record->>'phone',
        p_email := patient_record->>'email',
        p_emergency_contact_name := patient_record->>'emergency_contact_name',
        p_caregiver_phone := patient_record->>'caregiver_phone',
        p_enrollment_notes := patient_record->>'enrollment_notes'
      );

      RETURN QUERY SELECT
        v_patient_id,
        (patient_record->>'first_name' || ' ' || patient_record->>'last_name')::TEXT,
        (patient_record->>'room_number')::TEXT,
        'success'::TEXT;
    EXCEPTION WHEN OTHERS THEN
      RETURN QUERY SELECT
        NULL::UUID,
        (patient_record->>'first_name' || ' ' || patient_record->>'last_name')::TEXT,
        (patient_record->>'room_number')::TEXT,
        ('error: ' || SQLERRM)::TEXT;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure grants are in place
GRANT EXECUTE ON FUNCTION bulk_enroll_hospital_patients TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_enroll_hospital_patients TO service_role;
