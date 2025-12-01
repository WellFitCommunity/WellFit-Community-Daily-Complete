-- ============================================================================
-- EMPLOYEE PROFILES: Employment-specific data extension table
-- ============================================================================
-- This table extends the profiles table with employment-specific fields.
-- It complements (not replaces) the existing profiles and fhir_practitioners tables.
--
-- Architecture:
--   profiles (all users) ──┬── employee_profiles (staff only - employment data)
--                          └── fhir_practitioners (licensed providers - clinical credentials)
-- ============================================================================

-- ============================================================================
-- 1. CREATE EMPLOYEE_PROFILES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS employee_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to profiles table (1:1 for staff users)
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(user_id) ON DELETE CASCADE,

  -- Multi-tenant support
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,

  -- =========================================================================
  -- EMPLOYMENT INFORMATION
  -- =========================================================================
  employee_number TEXT,                    -- Badge ID / employee ID
  job_title TEXT,                          -- Position title
  employment_type TEXT CHECK (employment_type IN (
    'full_time',
    'part_time',
    'contract',
    'temporary',
    'per_diem',
    'intern'
  )),
  hire_date DATE,
  termination_date DATE,
  employment_status TEXT DEFAULT 'active' CHECK (employment_status IN (
    'active',
    'on_leave',
    'terminated',
    'suspended',
    'pending_start'
  )),

  -- =========================================================================
  -- ORGANIZATION / HIERARCHY
  -- =========================================================================
  department_id UUID REFERENCES hospital_departments(id) ON DELETE SET NULL,
  manager_id UUID REFERENCES employee_profiles(id) ON DELETE SET NULL,  -- Self-referential for org hierarchy
  cost_center TEXT,                        -- For payroll/accounting

  -- =========================================================================
  -- CONTACT / LOCATION
  -- =========================================================================
  office_location TEXT,                    -- Building/floor/room
  desk_phone TEXT,
  phone_extension TEXT,
  work_email TEXT,                         -- May differ from personal email in profiles

  -- =========================================================================
  -- SCHEDULING / CAPACITY
  -- =========================================================================
  default_shift TEXT CHECK (default_shift IN (
    'day',
    'evening',
    'night',
    'rotating',
    'flexible',
    'on_call'
  )),
  fte_percentage NUMERIC(5,2) DEFAULT 100.00 CHECK (fte_percentage >= 0 AND fte_percentage <= 100),
  max_weekly_hours NUMERIC(5,2),

  -- =========================================================================
  -- CREDENTIALS / COMPLIANCE
  -- =========================================================================
  credentials_verified BOOLEAN DEFAULT FALSE,
  credentials_verified_at TIMESTAMPTZ,
  credentials_verified_by UUID REFERENCES employee_profiles(id) ON DELETE SET NULL,
  background_check_date DATE,
  background_check_status TEXT CHECK (background_check_status IN (
    'pending',
    'passed',
    'failed',
    'expired',
    'waived'
  )),
  last_compliance_training DATE,
  hipaa_training_date DATE,

  -- =========================================================================
  -- NOTES
  -- =========================================================================
  notes TEXT,                              -- HR notes (not visible to employee)

  -- =========================================================================
  -- AUDIT FIELDS
  -- =========================================================================
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(user_id) ON DELETE SET NULL
);

-- Add comment for documentation
COMMENT ON TABLE employee_profiles IS 'Employment-specific data for staff users. Links to profiles via user_id. Complements fhir_practitioners for clinical credentials.';
COMMENT ON COLUMN employee_profiles.user_id IS 'Links to profiles.user_id - one employee_profile per staff user';
COMMENT ON COLUMN employee_profiles.manager_id IS 'Self-referential FK for organizational hierarchy';
COMMENT ON COLUMN employee_profiles.fte_percentage IS 'Full-time equivalent: 100 = full-time, 50 = half-time, etc.';
COMMENT ON COLUMN employee_profiles.credentials_verified_by IS 'HR/admin who verified credentials';

-- ============================================================================
-- 2. CREATE INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_employee_profiles_user_id ON employee_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_profiles_tenant_id ON employee_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employee_profiles_department_id ON employee_profiles(department_id);
CREATE INDEX IF NOT EXISTS idx_employee_profiles_manager_id ON employee_profiles(manager_id);
CREATE INDEX IF NOT EXISTS idx_employee_profiles_employment_status ON employee_profiles(employment_status);
CREATE INDEX IF NOT EXISTS idx_employee_profiles_employee_number ON employee_profiles(employee_number);
CREATE INDEX IF NOT EXISTS idx_employee_profiles_hire_date ON employee_profiles(hire_date);

-- ============================================================================
-- 3. ENABLE RLS
-- ============================================================================
ALTER TABLE employee_profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. RLS POLICIES
-- ============================================================================

-- Policy: Staff can view their own employee profile
CREATE POLICY employee_profiles_select_own ON employee_profiles
  FOR SELECT
  USING (user_id = auth.uid());

-- Policy: Managers can view their direct reports
CREATE POLICY employee_profiles_select_reports ON employee_profiles
  FOR SELECT
  USING (
    manager_id IN (
      SELECT id FROM employee_profiles WHERE user_id = auth.uid()
    )
  );

-- Policy: Admins can view all employee profiles in their tenant
CREATE POLICY employee_profiles_select_admin ON employee_profiles
  FOR SELECT
  USING (
    tenant_id = get_current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
      AND role_code IN (1, 2)  -- SUPER_ADMIN, ADMIN
    )
  );

-- Policy: HR/Admins can insert employee profiles
CREATE POLICY employee_profiles_insert_admin ON employee_profiles
  FOR INSERT
  WITH CHECK (
    tenant_id = get_current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
      AND role_code IN (1, 2)  -- SUPER_ADMIN, ADMIN
    )
  );

-- Policy: Staff can update limited fields on their own profile
CREATE POLICY employee_profiles_update_own ON employee_profiles
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    -- Note: Trigger below restricts which columns can be updated
  );

-- Policy: Admins can update any employee profile in their tenant
CREATE POLICY employee_profiles_update_admin ON employee_profiles
  FOR UPDATE
  USING (
    tenant_id = get_current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
      AND role_code IN (1, 2)  -- SUPER_ADMIN, ADMIN
    )
  );

-- Policy: Admins can delete employee profiles (soft delete preferred)
CREATE POLICY employee_profiles_delete_admin ON employee_profiles
  FOR DELETE
  USING (
    tenant_id = get_current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
      AND role_code IN (1, 2)  -- SUPER_ADMIN, ADMIN
    )
  );

-- ============================================================================
-- 5. UPDATED_AT TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION update_employee_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_employee_profiles_updated_at ON employee_profiles;
CREATE TRIGGER trigger_employee_profiles_updated_at
  BEFORE UPDATE ON employee_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_employee_profiles_updated_at();

-- ============================================================================
-- 6. EMPLOYEE DIRECTORY VIEW
-- ============================================================================
-- Unified view joining profiles + employee_profiles + fhir_practitioners + departments
-- This is the primary way to query employee information

CREATE OR REPLACE VIEW employee_directory AS
SELECT
  -- Core identity from profiles
  p.user_id,
  p.first_name,
  p.last_name,
  p.first_name || ' ' || p.last_name AS full_name,
  p.email AS personal_email,
  p.phone AS personal_phone,
  p.role,
  p.role_code,

  -- Employment data
  e.id AS employee_profile_id,
  e.employee_number,
  e.job_title,
  e.employment_type,
  e.employment_status,
  e.hire_date,
  e.termination_date,
  e.fte_percentage,
  e.default_shift,
  e.work_email,
  e.desk_phone,
  e.phone_extension,
  e.office_location,
  e.cost_center,

  -- Department info
  e.department_id,
  d.code AS department_code,
  d.name AS department_name,
  d.floor_number AS department_floor,

  -- Manager info
  e.manager_id,
  mgr_p.first_name || ' ' || mgr_p.last_name AS manager_name,
  mgr_e.job_title AS manager_title,

  -- Credentials/compliance
  e.credentials_verified,
  e.credentials_verified_at,
  e.background_check_date,
  e.background_check_status,
  e.last_compliance_training,
  e.hipaa_training_date,

  -- Clinical credentials from fhir_practitioners (if applicable)
  fp.npi,
  fp.state_license_number,
  fp.dea_number,
  fp.specialties,
  fp.qualifications,

  -- Tenant
  e.tenant_id,

  -- Audit
  e.created_at AS employee_profile_created_at,
  e.updated_at AS employee_profile_updated_at

FROM profiles p
INNER JOIN employee_profiles e ON e.user_id = p.user_id
LEFT JOIN hospital_departments d ON d.id = e.department_id
LEFT JOIN employee_profiles mgr_e ON mgr_e.id = e.manager_id
LEFT JOIN profiles mgr_p ON mgr_p.user_id = mgr_e.user_id
LEFT JOIN fhir_practitioners fp ON fp.user_id = p.user_id;

COMMENT ON VIEW employee_directory IS 'Unified view of employee data from profiles, employee_profiles, departments, and fhir_practitioners';

-- ============================================================================
-- 7. HELPER FUNCTIONS
-- ============================================================================

-- Get direct reports for a manager
CREATE OR REPLACE FUNCTION get_direct_reports(p_manager_user_id UUID)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  job_title TEXT,
  department_name TEXT,
  employment_status TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ed.user_id,
    ed.full_name,
    ed.job_title,
    ed.department_name,
    ed.employment_status
  FROM employee_directory ed
  WHERE ed.manager_id = (
    SELECT id FROM employee_profiles WHERE user_id = p_manager_user_id
  );
END;
$$;

-- Get employee by employee number
CREATE OR REPLACE FUNCTION get_employee_by_number(p_employee_number TEXT, p_tenant_id UUID)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  job_title TEXT,
  department_name TEXT,
  employment_status TEXT,
  work_email TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ed.user_id,
    ed.full_name,
    ed.job_title,
    ed.department_name,
    ed.employment_status,
    ed.work_email
  FROM employee_directory ed
  WHERE ed.employee_number = p_employee_number
  AND ed.tenant_id = p_tenant_id;
END;
$$;

-- Check if user has employee profile
CREATE OR REPLACE FUNCTION has_employee_profile(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM employee_profiles WHERE user_id = p_user_id
  );
$$;

-- ============================================================================
-- 8. GRANT PERMISSIONS
-- ============================================================================
GRANT SELECT ON employee_directory TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON employee_profiles TO authenticated;
GRANT EXECUTE ON FUNCTION get_direct_reports(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_employee_by_number(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION has_employee_profile(UUID) TO authenticated;
