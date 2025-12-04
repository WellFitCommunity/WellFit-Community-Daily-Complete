-- Check ALL versions of bulk_enroll_hospital_patients in ANY schema
DO $$
DECLARE
  func RECORD;
BEGIN
  FOR func IN
    SELECT n.nspname as schema, p.proname, pg_get_function_arguments(p.oid) as args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname LIKE '%bulk_enroll%'
  LOOP
    RAISE NOTICE 'Found: %.% (%)', func.schema, func.proname, func.args;
  END LOOP;
END $$;

-- Also check if there's a trigger or something shadowing our function
DO $$
BEGIN
  RAISE NOTICE 'search_path = %', current_setting('search_path');
END $$;
