-- Run the debug function
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT * FROM bulk_enroll_hospital_patients('[{"first_name": "Debug", "last_name": "Test", "dob": "1955-03-20", "room_number": "D-01", "mrn": "D-001"}]'::TEXT)
  LOOP
    RAISE NOTICE 'Result: %', r;
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'OUTER Error: % - %', SQLSTATE, SQLERRM;
END $$;
