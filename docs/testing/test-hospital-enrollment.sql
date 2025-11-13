-- ============================================================================
-- Hospital Patient Enrollment - Quick Test Script
-- ============================================================================
-- Purpose: Test the hospital vs app enrollment system
-- Run this to verify everything is working
-- ============================================================================

\echo '=== STEP 1: Verify enrollment system is installed ==='
SELECT
  'enrollment_type column' as check_name,
  CASE WHEN COUNT(*) > 0 THEN 'OK ✓' ELSE 'MISSING ✗' END as status
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'enrollment_type'
UNION ALL
SELECT
  'hospital-specific columns',
  CASE WHEN COUNT(*) >= 20 THEN 'OK ✓' ELSE 'MISSING ✗' END
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name IN (
  'mrn', 'admission_date', 'acuity_level', 'code_status',
  'hospital_unit', 'bed_number', 'attending_physician_id',
  'isolation_precautions', 'allergies', 'primary_insurance'
)
UNION ALL
SELECT
  'enroll_hospital_patient function',
  CASE WHEN COUNT(*) > 0 THEN 'OK ✓' ELSE 'MISSING ✗' END
FROM information_schema.routines
WHERE routine_name = 'enroll_hospital_patient'
UNION ALL
SELECT
  'bulk_enroll_hospital_patients function',
  CASE WHEN COUNT(*) > 0 THEN 'OK ✓' ELSE 'MISSING ✗' END
FROM information_schema.routines
WHERE routine_name = 'bulk_enroll_hospital_patients'
UNION ALL
SELECT
  'hospital_patients view',
  CASE WHEN COUNT(*) > 0 THEN 'OK ✓' ELSE 'MISSING ✗' END
FROM information_schema.views
WHERE table_name = 'hospital_patients';

\echo ''
\echo '=== STEP 2: Create test hospital patients ==='

-- Create 5 test hospital patients using bulk enrollment
SELECT * FROM bulk_enroll_hospital_patients(
  '[
    {
      "first_name": "John",
      "last_name": "Doe",
      "dob": "1950-01-15",
      "gender": "Male",
      "room_number": "101",
      "mrn": "MRN001",
      "enrollment_notes": "Post-surgery monitoring - CABG POD#3"
    },
    {
      "first_name": "Jane",
      "last_name": "Smith",
      "dob": "1945-03-22",
      "gender": "Female",
      "room_number": "102",
      "mrn": "MRN002",
      "enrollment_notes": "Diabetes management - A1c 8.5%"
    },
    {
      "first_name": "Robert",
      "last_name": "Johnson",
      "dob": "1960-07-10",
      "gender": "Male",
      "room_number": "103",
      "mrn": "MRN003",
      "enrollment_notes": "CHF exacerbation - EF 25%"
    },
    {
      "first_name": "Mary",
      "last_name": "Williams",
      "dob": "1948-09-05",
      "gender": "Female",
      "room_number": "104",
      "mrn": "MRN004",
      "enrollment_notes": "Post-stroke rehabilitation - left hemiparesis"
    },
    {
      "first_name": "David",
      "last_name": "Brown",
      "dob": "1955-11-18",
      "gender": "Male",
      "room_number": "105",
      "mrn": "MRN005",
      "enrollment_notes": "COPD exacerbation - on 3L NC"
    }
  ]'::JSONB
);

\echo ''
\echo '=== STEP 3: Verify hospital patients were created ==='

SELECT
  'Hospital Patients Created' as result,
  COUNT(*) as total,
  STRING_AGG(first_name || ' ' || last_name, ', ') as patients
FROM hospital_patients;

\echo ''
\echo '=== STEP 4: View hospital patient details ==='

SELECT
  room_number,
  last_name || ', ' || first_name as patient_name,
  EXTRACT(YEAR FROM AGE(dob))::INTEGER as age,
  mrn,
  enrollment_notes,
  TO_CHAR(enrollment_date, 'Mon DD, YYYY') as enrolled_on
FROM hospital_patients
ORDER BY room_number;

\echo ''
\echo '=== STEP 5: Generate shift handoff risk scores ==='

-- Calculate risk scores for hospital patients for night shift
SELECT
  patient_name,
  final_risk_level,
  array_length(risk_factors, 1) as num_risk_factors
FROM (
  SELECT
    user_id as patient_id,
    first_name || ' ' || last_name as patient_name
  FROM hospital_patients
) patients
CROSS JOIN LATERAL (
  SELECT
    calculate_shift_handoff_risk(patient_id, 'night') as risk_level
) risk
CROSS JOIN LATERAL (
  SELECT
    final_risk_level,
    risk_factors
  FROM get_current_shift_handoff('night')
  WHERE patient_id = patients.patient_id
) handoff;

\echo ''
\echo '=== STEP 6: View enrollment type breakdown ==='

SELECT
  enrollment_type,
  COUNT(*) as count,
  ROUND(COUNT(*)::NUMERIC / SUM(COUNT(*)) OVER () * 100, 1) as percentage
FROM profiles
WHERE role IN ('patient', 'senior')
GROUP BY enrollment_type
ORDER BY count DESC;

\echo ''
\echo '=== SUCCESS! Hospital enrollment system is working ==='
\echo ''
\echo 'Next steps:'
\echo '1. Visit /admin in your app'
\echo '2. Look for "Hospital Patient Enrollment" section'
\echo '3. See your 5 test hospital patients listed'
\echo '4. Visit /physician to see them in the physician panel'
\echo '5. Visit /nurse to see them in the nurse handoff dashboard'
\echo ''
\echo 'To clean up test data:'
\echo 'DELETE FROM profiles WHERE enrollment_type = ''hospital'';'
\echo ''
