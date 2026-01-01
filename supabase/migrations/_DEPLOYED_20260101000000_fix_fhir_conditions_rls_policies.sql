-- Migration: Fix fhir_conditions RLS policies for clinical staff access
-- Date: 2026-01-01
-- Issue: 403 Forbidden when clinical staff access fhir_conditions
-- Root cause: Policy only allows patient + admin, missing clinical staff roles
-- Solution: Add staff SELECT policy using user_roles table (consistent with other FHIR tables)

-- ============================================================================
-- DROP EXISTING RESTRICTIVE POLICIES
-- ============================================================================

-- Drop the overly restrictive select policy
DROP POLICY IF EXISTS "fhir_conditions_select_own" ON fhir_conditions;

-- Drop existing insert/update policies that also have the same issue
DROP POLICY IF EXISTS "fhir_conditions_insert_admin" ON fhir_conditions;
DROP POLICY IF EXISTS "fhir_conditions_insert_own" ON fhir_conditions;
DROP POLICY IF EXISTS "fhir_conditions_update_admin" ON fhir_conditions;
DROP POLICY IF EXISTS "fhir_conditions_update_own" ON fhir_conditions;

-- ============================================================================
-- CREATE NEW POLICIES (following fhir_care_plans / fhir_immunizations pattern)
-- ============================================================================

-- Policy: Patients can SELECT their own conditions
CREATE POLICY "fhir_conditions_patient_select"
  ON fhir_conditions
  FOR SELECT
  TO authenticated
  USING (patient_id = auth.uid());

-- Policy: Clinical staff can SELECT all conditions
-- Roles: admin, super_admin, doctor, nurse, nurse_practitioner, physician_assistant,
--        care_manager, case_manager, social_worker, clinical_supervisor
CREATE POLICY "fhir_conditions_staff_select"
  ON fhir_conditions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = ANY (ARRAY[
          'admin',
          'super_admin',
          'doctor',
          'physician',
          'nurse',
          'nurse_practitioner',
          'physician_assistant',
          'case_manager',
          'social_worker',
          'clinical_supervisor',
          'community_health_worker',
          'chw'
        ])
    )
  );

-- Policy: Patients can INSERT their own conditions
CREATE POLICY "fhir_conditions_patient_insert"
  ON fhir_conditions
  FOR INSERT
  TO authenticated
  WITH CHECK (patient_id = auth.uid());

-- Policy: Clinical staff can INSERT conditions for any patient
CREATE POLICY "fhir_conditions_staff_insert"
  ON fhir_conditions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = ANY (ARRAY[
          'admin',
          'super_admin',
          'doctor',
          'physician',
          'nurse',
          'nurse_practitioner',
          'physician_assistant',
          'case_manager',
          'clinical_supervisor'
        ])
    )
  );

-- Policy: Patients can UPDATE their own conditions
CREATE POLICY "fhir_conditions_patient_update"
  ON fhir_conditions
  FOR UPDATE
  TO authenticated
  USING (patient_id = auth.uid())
  WITH CHECK (patient_id = auth.uid());

-- Policy: Clinical staff can UPDATE any conditions
CREATE POLICY "fhir_conditions_staff_update"
  ON fhir_conditions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = ANY (ARRAY[
          'admin',
          'super_admin',
          'doctor',
          'physician',
          'nurse',
          'nurse_practitioner',
          'physician_assistant',
          'case_manager',
          'clinical_supervisor'
        ])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = ANY (ARRAY[
          'admin',
          'super_admin',
          'doctor',
          'physician',
          'nurse',
          'nurse_practitioner',
          'physician_assistant',
          'case_manager',
          'clinical_supervisor'
        ])
    )
  );

-- Policy: Only admins can DELETE conditions (soft delete preferred)
CREATE POLICY "fhir_conditions_admin_delete"
  ON fhir_conditions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = ANY (ARRAY['admin', 'super_admin'])
    )
  );

-- ============================================================================
-- VERIFY RLS IS ENABLED
-- ============================================================================
ALTER TABLE fhir_conditions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ALSO FIX fhir_diagnostic_reports (same issue)
-- ============================================================================

-- Drop the overly restrictive policy
DROP POLICY IF EXISTS "fhir_diagnostic_reports_select_own" ON fhir_diagnostic_reports;

-- Policy: Patients can SELECT their own diagnostic reports
CREATE POLICY "fhir_diagnostic_reports_patient_select"
  ON fhir_diagnostic_reports
  FOR SELECT
  TO authenticated
  USING (patient_id = auth.uid());

-- Policy: Clinical staff can SELECT all diagnostic reports
CREATE POLICY "fhir_diagnostic_reports_staff_select"
  ON fhir_diagnostic_reports
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = ANY (ARRAY[
          'admin',
          'super_admin',
          'doctor',
          'physician',
          'nurse',
          'nurse_practitioner',
          'physician_assistant',
          'case_manager',
          'social_worker',
          'clinical_supervisor',
          'community_health_worker',
          'chw'
        ])
    )
  );

-- ============================================================================
-- GRANT USAGE (idempotent)
-- ============================================================================
GRANT SELECT, INSERT, UPDATE ON fhir_conditions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON fhir_diagnostic_reports TO authenticated;
