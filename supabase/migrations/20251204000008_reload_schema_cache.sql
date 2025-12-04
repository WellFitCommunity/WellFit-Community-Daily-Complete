-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

-- Verify function is correct
DO $$
DECLARE
  func_text TEXT;
BEGIN
  SELECT prosrc INTO func_text
  FROM pg_proc
  WHERE proname = 'bulk_enroll_hospital_patients';

  IF func_text LIKE '%patient_elem%' THEN
    RAISE NOTICE 'Function is using patient_elem (correct version)';
  ELSE
    RAISE NOTICE 'Function may be using old version: %', LEFT(func_text, 200);
  END IF;
END $$;
