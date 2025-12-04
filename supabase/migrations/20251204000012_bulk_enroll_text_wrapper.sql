-- ============================================================================
-- Add TEXT overload for bulk_enroll_hospital_patients
-- ============================================================================
-- PostgREST passes JSON body values as TEXT when calling functions.
-- This wrapper accepts TEXT and casts to JSONB.
-- ============================================================================

-- Create TEXT version that delegates to JSONB version
CREATE OR REPLACE FUNCTION bulk_enroll_hospital_patients(
  patients TEXT
) RETURNS TABLE(
  patient_id UUID,
  patient_name TEXT,
  room_number TEXT,
  status TEXT
) AS $$
BEGIN
  -- Cast TEXT to JSONB and call the main function
  RETURN QUERY SELECT * FROM bulk_enroll_hospital_patients(patients::JSONB);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant on TEXT version
GRANT EXECUTE ON FUNCTION bulk_enroll_hospital_patients(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_enroll_hospital_patients(TEXT) TO service_role;

-- Reload schema
NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
  RAISE NOTICE 'TEXT wrapper for bulk_enroll_hospital_patients created';
END $$;
