-- Test direct call to the function
DO $$
DECLARE
  test_input TEXT := '[{"first_name": "Test", "last_name": "Direct", "dob": "1955-03-20", "room_number": "T1", "mrn": "M1"}]';
  result RECORD;
BEGIN
  RAISE NOTICE 'Testing with input: %', test_input;
  RAISE NOTICE 'Input type: %', pg_typeof(test_input);

  BEGIN
    FOR result IN SELECT * FROM bulk_enroll_hospital_patients(test_input)
    LOOP
      RAISE NOTICE 'Result: id=%, name=%, room=%, status=%', result.patient_id, result.patient_name, result.room_number, result.status;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error: % - %', SQLSTATE, SQLERRM;
  END;
END $$;
