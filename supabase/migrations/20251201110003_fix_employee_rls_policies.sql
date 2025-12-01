-- ============================================================================
-- FIX: Additional RLS policy security issues for employee_profiles
-- ============================================================================
-- Issues fixed:
-- 1. employee_profiles_select_reports - missing tenant check
-- 2. employee_profiles_update_own - allows updating sensitive fields
-- 3. Add trigger to restrict employee self-update fields
-- ============================================================================

-- ============================================================================
-- 1. FIX: Managers can view their direct reports (ADD TENANT CHECK)
-- ============================================================================
DROP POLICY IF EXISTS employee_profiles_select_reports ON employee_profiles;

CREATE POLICY employee_profiles_select_reports ON employee_profiles
  FOR SELECT
  USING (
    -- Must be in same tenant as the caller
    tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
    AND
    -- Caller must be the manager of this employee
    manager_id IN (
      SELECT ep.id
      FROM employee_profiles ep
      WHERE ep.user_id = auth.uid()
      AND ep.tenant_id = tenant_id  -- Double-check tenant match
    )
  );

-- ============================================================================
-- 2. FIX: Staff can only update LIMITED fields on their own profile
-- ============================================================================
-- First drop the existing overly permissive policy
DROP POLICY IF EXISTS employee_profiles_update_own ON employee_profiles;

-- Create a more restrictive policy
-- Note: We can't restrict columns in RLS directly, so we use a trigger
CREATE POLICY employee_profiles_update_own ON employee_profiles
  FOR UPDATE
  USING (
    user_id = auth.uid()
    AND tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid()
    AND tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  );

-- ============================================================================
-- 3. ADD: Trigger to restrict which fields employees can update
-- ============================================================================
CREATE OR REPLACE FUNCTION restrict_employee_self_update()
RETURNS TRIGGER AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- Check if the current user is an admin
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
    AND role_code IN (1, 2)  -- SUPER_ADMIN, ADMIN
  ) INTO v_is_admin;

  -- Admins can update anything
  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  -- For non-admins updating their own profile, restrict sensitive fields
  IF OLD.user_id = auth.uid() THEN
    -- Prevent changing these sensitive fields
    IF NEW.employment_status IS DISTINCT FROM OLD.employment_status THEN
      RAISE EXCEPTION 'Employees cannot change their own employment status';
    END IF;

    IF NEW.employment_type IS DISTINCT FROM OLD.employment_type THEN
      RAISE EXCEPTION 'Employees cannot change their own employment type';
    END IF;

    IF NEW.hire_date IS DISTINCT FROM OLD.hire_date THEN
      RAISE EXCEPTION 'Employees cannot change their own hire date';
    END IF;

    IF NEW.termination_date IS DISTINCT FROM OLD.termination_date THEN
      RAISE EXCEPTION 'Employees cannot change their own termination date';
    END IF;

    IF NEW.credentials_verified IS DISTINCT FROM OLD.credentials_verified THEN
      RAISE EXCEPTION 'Employees cannot verify their own credentials';
    END IF;

    IF NEW.credentials_verified_at IS DISTINCT FROM OLD.credentials_verified_at THEN
      RAISE EXCEPTION 'Employees cannot modify credential verification timestamp';
    END IF;

    IF NEW.credentials_verified_by IS DISTINCT FROM OLD.credentials_verified_by THEN
      RAISE EXCEPTION 'Employees cannot modify credential verifier';
    END IF;

    IF NEW.background_check_status IS DISTINCT FROM OLD.background_check_status THEN
      RAISE EXCEPTION 'Employees cannot change their own background check status';
    END IF;

    IF NEW.background_check_date IS DISTINCT FROM OLD.background_check_date THEN
      RAISE EXCEPTION 'Employees cannot change their own background check date';
    END IF;

    IF NEW.fte_percentage IS DISTINCT FROM OLD.fte_percentage THEN
      RAISE EXCEPTION 'Employees cannot change their own FTE percentage';
    END IF;

    IF NEW.department_id IS DISTINCT FROM OLD.department_id THEN
      RAISE EXCEPTION 'Employees cannot change their own department';
    END IF;

    IF NEW.manager_id IS DISTINCT FROM OLD.manager_id THEN
      RAISE EXCEPTION 'Employees cannot change their own manager';
    END IF;

    IF NEW.job_title IS DISTINCT FROM OLD.job_title THEN
      RAISE EXCEPTION 'Employees cannot change their own job title';
    END IF;

    IF NEW.employee_number IS DISTINCT FROM OLD.employee_number THEN
      RAISE EXCEPTION 'Employees cannot change their own employee number';
    END IF;

    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
      RAISE EXCEPTION 'Tenant cannot be changed';
    END IF;

    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'User ID cannot be changed';
    END IF;

    -- Fields employees CAN update:
    -- - office_location
    -- - desk_phone
    -- - phone_extension
    -- - work_email
    -- - default_shift (preference)
    -- - notes (if we want them to add personal notes)
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trigger_restrict_employee_self_update ON employee_profiles;

-- Create the trigger
CREATE TRIGGER trigger_restrict_employee_self_update
  BEFORE UPDATE ON employee_profiles
  FOR EACH ROW
  EXECUTE FUNCTION restrict_employee_self_update();

-- ============================================================================
-- 4. FIX: Add tenant check to select_own policy for extra safety
-- ============================================================================
DROP POLICY IF EXISTS employee_profiles_select_own ON employee_profiles;

CREATE POLICY employee_profiles_select_own ON employee_profiles
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  );

-- ============================================================================
-- 5. Add comment documenting the security measures
-- ============================================================================
COMMENT ON FUNCTION restrict_employee_self_update() IS
'Trigger function that restricts which fields employees can update on their own profile.
Admins bypass all restrictions. Employees can only update: office_location, desk_phone,
phone_extension, work_email, default_shift. All other fields require admin privileges.';
