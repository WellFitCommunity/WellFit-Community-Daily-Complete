-- Test calling the function
DO $$
DECLARE
  r RECORD;
  test_input TEXT := '[{"first_name": "SQL", "last_name": "Test", "dob": "1955-03-20", "room_number": "SQL-01", "mrn": "SQL-MRN-001"}]';
BEGIN
  RAISE NOTICE 'Calling bulk_enroll_hospital_patients...';

  FOR r IN SELECT * FROM public.bulk_enroll_hospital_patients(test_input)
  LOOP
    RAISE NOTICE 'Row: id=%, name=%, room=%, status=%', r.patient_id, r.patient_name, r.room_number, r.status;
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error calling function: % - %', SQLSTATE, SQLERRM;
END $$;
