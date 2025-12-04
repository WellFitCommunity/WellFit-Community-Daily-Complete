-- Show full function source
DO $$
DECLARE
  func_src TEXT;
BEGIN
  SELECT prosrc INTO func_src
  FROM pg_proc
  WHERE proname = 'bulk_enroll_hospital_patients';

  RAISE NOTICE '%', func_src;
END $$;
