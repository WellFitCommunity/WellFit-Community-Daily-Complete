-- Debug step by step
DO $$
DECLARE
  test_input TEXT := '[{"first_name": "Test", "last_name": "Direct", "dob": "1955-03-20", "room_number": "T1", "mrn": "M1"}]';
  patients_jsonb JSONB;
  arr_len INTEGER;
  p JSONB;
  i INTEGER;
BEGIN
  RAISE NOTICE 'Step 1: Input = %', test_input;

  -- Step 2: Cast to JSONB
  patients_jsonb := test_input::JSONB;
  RAISE NOTICE 'Step 2: Casted to JSONB, type = %', pg_typeof(patients_jsonb);

  -- Step 3: Get length
  arr_len := jsonb_array_length(patients_jsonb);
  RAISE NOTICE 'Step 3: Array length = %', arr_len;

  -- Step 4: Access element by index
  p := patients_jsonb->0;
  RAISE NOTICE 'Step 4: First element = %, type = %', p, pg_typeof(p);

  -- Step 5: Extract field
  RAISE NOTICE 'Step 5: first_name = %', p->>'first_name';

  RAISE NOTICE 'All steps passed!';

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error at some step: % - %', SQLSTATE, SQLERRM;
END $$;

-- Also let's see what enroll_hospital_patient signature looks like
DO $$
DECLARE
  func_args TEXT;
BEGIN
  SELECT pg_get_function_arguments(oid) INTO func_args
  FROM pg_proc
  WHERE proname = 'enroll_hospital_patient';

  RAISE NOTICE 'enroll_hospital_patient args: %', func_args;
END $$;
