-- ============================================================================
-- Diagnose and final fix for bulk_enroll_hospital_patients
-- ============================================================================

-- First, show what we have
DO $$
DECLARE
  func_src TEXT;
  func_args TEXT;
  func_cnt INTEGER;
BEGIN
  SELECT COUNT(*) INTO func_cnt FROM pg_proc WHERE proname = 'bulk_enroll_hospital_patients';
  RAISE NOTICE 'Number of bulk_enroll_hospital_patients functions: %', func_cnt;

  FOR func_args, func_src IN
    SELECT pg_get_function_arguments(oid), prosrc
    FROM pg_proc
    WHERE proname = 'bulk_enroll_hospital_patients'
  LOOP
    RAISE NOTICE 'Args: %', func_args;
    RAISE NOTICE 'Contains patients_jsonb cast: %', func_src LIKE '%patients_jsonb%';
    RAISE NOTICE 'First 300 chars: %', LEFT(func_src, 300);
  END LOOP;
END $$;

-- Let's verify: The issue is that even though we defined it with TEXT,
-- PostgREST might be passing JSON as a parsed object, not string.
-- Let me create a test function that accepts VARIADIC to see what's happening
CREATE OR REPLACE FUNCTION test_bulk_enroll_input(patients TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN 'Input type: ' || pg_typeof(patients)::TEXT || ', value preview: ' || LEFT(patients, 100);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION test_bulk_enroll_input(TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
