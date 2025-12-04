-- Verify hospital enrollment system is installed (no data changes)
DO $$
DECLARE
  has_enrollment_type BOOLEAN;
  has_hospital_columns INTEGER;
  has_enroll_function BOOLEAN;
  has_bulk_function BOOLEAN;
  has_view BOOLEAN;
BEGIN
  -- Check enrollment_type column
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'enrollment_type'
  ) INTO has_enrollment_type;

  -- Check hospital columns
  SELECT COUNT(*) INTO has_hospital_columns
  FROM information_schema.columns
  WHERE table_name = 'profiles' AND column_name IN (
    'mrn', 'admission_date', 'acuity_level', 'code_status',
    'hospital_unit', 'bed_number', 'attending_physician_id'
  );

  -- Check functions
  SELECT EXISTS (
    SELECT 1 FROM information_schema.routines WHERE routine_name = 'enroll_hospital_patient'
  ) INTO has_enroll_function;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.routines WHERE routine_name = 'bulk_enroll_hospital_patients'
  ) INTO has_bulk_function;

  -- Check view
  SELECT EXISTS (
    SELECT 1 FROM information_schema.views WHERE table_name = 'hospital_patients'
  ) INTO has_view;

  -- Report
  RAISE NOTICE '=== Hospital Enrollment System Check ===';
  RAISE NOTICE 'enrollment_type column: %', CASE WHEN has_enrollment_type THEN 'OK ✓' ELSE 'MISSING ✗' END;
  RAISE NOTICE 'hospital-specific columns: % found', has_hospital_columns;
  RAISE NOTICE 'enroll_hospital_patient function: %', CASE WHEN has_enroll_function THEN 'OK ✓' ELSE 'MISSING ✗' END;
  RAISE NOTICE 'bulk_enroll_hospital_patients function: %', CASE WHEN has_bulk_function THEN 'OK ✓' ELSE 'MISSING ✗' END;
  RAISE NOTICE 'hospital_patients view: %', CASE WHEN has_view THEN 'OK ✓' ELSE 'MISSING ✗' END;
END $$;
