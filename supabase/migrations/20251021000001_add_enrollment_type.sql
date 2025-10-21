-- ============================================================================
-- Add Enrollment Type to Differentiate Hospital vs App Patients
-- ============================================================================
-- Purpose: Allow dual enrollment flows:
--   1. HOSPITAL - Backend testing (no login, staff-managed)
--   2. APP - Frontend testing (self-enrollment, user login)
-- ============================================================================

-- Add enrollment_type column to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS enrollment_type TEXT DEFAULT 'app'
  CHECK (enrollment_type IN ('hospital', 'app'));

-- Add enrollment metadata
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS enrollment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS enrolled_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS enrollment_notes TEXT,
ADD COLUMN IF NOT EXISTS mrn TEXT; -- Medical Record Number for hospital patients

-- Add index for filtering by enrollment type
CREATE INDEX IF NOT EXISTS idx_profiles_enrollment_type ON profiles(enrollment_type);

-- Comment for documentation
COMMENT ON COLUMN profiles.enrollment_type IS 'Enrollment source: hospital (staff-created, no login) or app (self-enrollment, has auth.users record)';
COMMENT ON COLUMN profiles.enrolled_by IS 'Admin/staff user who created hospital enrollment (NULL for app enrollments)';
COMMENT ON COLUMN profiles.enrollment_notes IS 'Notes about enrollment (e.g., "ICU admission", "Post-surgery monitoring")';

-- ============================================================================
-- Update existing records to app enrollment (they have auth.users)
-- ============================================================================
UPDATE profiles
SET enrollment_type = 'app'
WHERE enrollment_type IS NULL;

-- ============================================================================
-- Create helper function to enroll hospital patient
-- ============================================================================
CREATE OR REPLACE FUNCTION enroll_hospital_patient(
  p_first_name TEXT,
  p_last_name TEXT,
  p_dob DATE,
  p_gender TEXT DEFAULT NULL,
  p_room_number TEXT DEFAULT NULL,
  p_mrn TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_emergency_contact_name TEXT DEFAULT NULL,
  p_caregiver_phone TEXT DEFAULT NULL,
  p_enrollment_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_patient_id UUID;
  v_admin_id UUID;
BEGIN
  -- Get current admin user
  v_admin_id := auth.uid();

  -- Create hospital patient (no auth.users record)
  INSERT INTO profiles (
    user_id,
    first_name,
    last_name,
    dob,
    gender,
    room_number,
    mrn,
    phone,
    email,
    emergency_contact_name,
    caregiver_phone,
    role,
    role_code,
    enrollment_type,
    enrolled_by,
    enrollment_notes,
    enrollment_date
  ) VALUES (
    gen_random_uuid(),
    p_first_name,
    p_last_name,
    p_dob,
    p_gender,
    p_room_number,
    p_mrn,
    p_phone,
    p_email,
    p_emergency_contact_name,
    p_caregiver_phone,
    'patient', -- default role
    1,         -- patient role code
    'hospital',
    v_admin_id,
    p_enrollment_notes,
    NOW()
  )
  RETURNING user_id INTO v_patient_id;

  RETURN v_patient_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users (will be restricted by RLS)
GRANT EXECUTE ON FUNCTION enroll_hospital_patient TO authenticated;

-- ============================================================================
-- Create helper function to bulk enroll hospital patients
-- ============================================================================
CREATE OR REPLACE FUNCTION bulk_enroll_hospital_patients(
  patients JSONB
) RETURNS TABLE(
  patient_id UUID,
  patient_name TEXT,
  room_number TEXT,
  status TEXT
) AS $$
DECLARE
  patient JSONB;
  v_patient_id UUID;
BEGIN
  -- Iterate through patients array
  FOR patient IN SELECT * FROM jsonb_array_elements(patients)
  LOOP
    BEGIN
      -- Enroll each patient
      v_patient_id := enroll_hospital_patient(
        p_first_name := patient->>'first_name',
        p_last_name := patient->>'last_name',
        p_dob := (patient->>'dob')::DATE,
        p_gender := patient->>'gender',
        p_room_number := patient->>'room_number',
        p_mrn := patient->>'mrn',
        p_phone := patient->>'phone',
        p_email := patient->>'email',
        p_emergency_contact_name := patient->>'emergency_contact_name',
        p_caregiver_phone := patient->>'caregiver_phone',
        p_enrollment_notes := patient->>'enrollment_notes'
      );

      RETURN QUERY SELECT
        v_patient_id,
        (patient->>'first_name' || ' ' || patient->>'last_name')::TEXT,
        (patient->>'room_number')::TEXT,
        'success'::TEXT;
    EXCEPTION WHEN OTHERS THEN
      RETURN QUERY SELECT
        NULL::UUID,
        (patient->>'first_name' || ' ' || patient->>'last_name')::TEXT,
        (patient->>'room_number')::TEXT,
        ('error: ' || SQLERRM)::TEXT;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION bulk_enroll_hospital_patients TO authenticated;

-- ============================================================================
-- Create view for hospital patients only
-- ============================================================================
CREATE OR REPLACE VIEW hospital_patients AS
SELECT
  user_id,
  first_name,
  last_name,
  dob,
  EXTRACT(YEAR FROM AGE(dob))::INTEGER as age,
  gender,
  room_number,
  mrn,
  phone,
  email,
  emergency_contact_name,
  caregiver_phone,
  role,
  enrollment_date,
  enrolled_by,
  enrollment_notes,
  created_at,
  updated_at
FROM profiles
WHERE enrollment_type = 'hospital'
  AND disabled_at IS NULL
ORDER BY room_number NULLS LAST, last_name, first_name;

-- Grant select to authenticated users
GRANT SELECT ON hospital_patients TO authenticated;

-- ============================================================================
-- Create view for app patients only
-- ============================================================================
CREATE OR REPLACE VIEW app_patients AS
SELECT
  user_id,
  first_name,
  last_name,
  dob,
  EXTRACT(YEAR FROM AGE(dob))::INTEGER as age,
  gender,
  email,
  phone,
  role,
  onboarded,
  phone_verified,
  email_verified,
  enrollment_date,
  created_at
FROM profiles
WHERE enrollment_type = 'app'
  AND role IN ('patient', 'senior')
  AND disabled_at IS NULL
ORDER BY last_name, first_name;

-- Grant select to authenticated users
GRANT SELECT ON app_patients TO authenticated;

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Verify enrollment types
-- SELECT enrollment_type, COUNT(*) as count
-- FROM profiles
-- GROUP BY enrollment_type;

-- List hospital patients
-- SELECT * FROM hospital_patients LIMIT 10;

-- List app patients
-- SELECT * FROM app_patients LIMIT 10;
