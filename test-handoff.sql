-- ============================================================================
-- Nurse Shift Handoff - Quick Test Script
-- ============================================================================
-- Purpose: Verify handoff system is working end-to-end
-- Run this in your Supabase SQL editor or via psql
-- ============================================================================

-- STEP 1: Check if handoff functions exist
-- ============================================================================
\echo '=== STEP 1: Checking if handoff functions exist ==='
SELECT
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%handoff%'
ORDER BY routine_name;

-- STEP 2: Check if handoff tables exist
-- ============================================================================
\echo ''
\echo '=== STEP 2: Checking if handoff tables exist ==='
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE '%handoff%'
ORDER BY table_name;

-- STEP 3: Check current patient count
-- ============================================================================
\echo ''
\echo '=== STEP 3: Current patient count ==='
SELECT
  COUNT(*) as total_patients,
  COUNT(*) FILTER (WHERE room_number IS NOT NULL) as patients_with_rooms
FROM profiles
WHERE role IN ('patient', 'senior');

-- STEP 4: Check existing risk scores
-- ============================================================================
\echo ''
\echo '=== STEP 4: Existing shift handoff risk scores ==='
SELECT
  COUNT(*) as total_scores,
  COUNT(*) FILTER (WHERE nurse_reviewed_at IS NOT NULL) as nurse_reviewed,
  COUNT(*) FILTER (WHERE nurse_risk_level IS NOT NULL) as nurse_adjusted
FROM shift_handoff_risk_scores;

-- STEP 5: Get current shift handoff (should work even with no data)
-- ============================================================================
\echo ''
\echo '=== STEP 5: Testing get_current_shift_handoff function ==='
SELECT
  patient_name,
  room_number,
  final_risk_level,
  nurse_reviewed,
  handoff_priority
FROM get_current_shift_handoff('night')
ORDER BY handoff_priority
LIMIT 5;

-- ============================================================================
-- OPTIONAL: Create test data if none exists
-- ============================================================================
\echo ''
\echo '=== OPTIONAL: Would you like to create test data? ==='
\echo 'If YES, uncomment and run the section below:'
\echo ''

/*
-- Create 5 test patients with room numbers
DO $$
DECLARE
  test_patient_1 uuid;
  test_patient_2 uuid;
  test_patient_3 uuid;
  test_patient_4 uuid;
  test_patient_5 uuid;
BEGIN
  -- Insert test patients
  INSERT INTO profiles (user_id, first_name, last_name, dob, role, room_number)
  VALUES
    (gen_random_uuid(), 'Alice', 'Anderson', '1950-01-15', 'patient', '101'),
    (gen_random_uuid(), 'Bob', 'Brown', '1945-03-22', 'patient', '102'),
    (gen_random_uuid(), 'Carol', 'Chen', '1960-07-10', 'senior', '103'),
    (gen_random_uuid(), 'David', 'Davis', '1955-11-05', 'patient', '104'),
    (gen_random_uuid(), 'Emma', 'Evans', '1948-09-18', 'senior', '105')
  RETURNING user_id INTO test_patient_1, test_patient_2, test_patient_3, test_patient_4, test_patient_5;

  RAISE NOTICE 'Created 5 test patients';

  -- Generate risk scores for each patient
  PERFORM calculate_shift_handoff_risk(user_id, 'night')
  FROM profiles
  WHERE role IN ('patient', 'senior')
    AND user_id IN (test_patient_1, test_patient_2, test_patient_3, test_patient_4, test_patient_5);

  RAISE NOTICE 'Generated risk scores for test patients';

  -- Add some clinical events to make it realistic
  INSERT INTO shift_handoff_events (patient_id, event_type, event_description, risk_impact)
  SELECT
    user_id,
    'vital_sign_change',
    'Blood pressure elevated: 160/95',
    'increase'
  FROM profiles
  WHERE role IN ('patient', 'senior')
  LIMIT 2;

  RAISE NOTICE 'Added sample clinical events';
END $$;

-- Verify test data was created
SELECT
  patient_name,
  room_number,
  final_risk_level,
  auto_risk_level,
  nurse_reviewed,
  handoff_priority,
  array_length(risk_factors, 1) as num_risk_factors
FROM get_current_shift_handoff('night')
ORDER BY handoff_priority;

\echo 'Test data created successfully!'
*/

-- ============================================================================
-- SUCCESS CRITERIA
-- ============================================================================
\echo ''
\echo '=== SUCCESS CRITERIA ==='
\echo 'For handoff system to be working:'
\echo '1. ✓ Functions exist (get_current_shift_handoff, nurse_review_handoff_risk, calculate_shift_handoff_risk)'
\echo '2. ✓ Tables exist (8 handoff tables)'
\echo '3. ✓ get_current_shift_handoff returns data (even if empty)'
\echo '4. ✓ Can create test patients and generate risk scores'
\echo ''
\echo 'Next steps:'
\echo '- If no patients: Uncomment and run the OPTIONAL section above'
\echo '- Visit /nurse in your app to see the handoff dashboard'
\echo '- Test confirming and adjusting risk scores'
\echo ''
