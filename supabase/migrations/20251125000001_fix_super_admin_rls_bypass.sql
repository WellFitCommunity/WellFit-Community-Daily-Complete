-- ============================================================================
-- Fix Super Admin RLS Bypass for Cross-Tenant Access
-- ============================================================================
-- Purpose: Allow super_admin (Envision employees) to access ALL tenant data
--          while tenant admins remain restricted to their own tenant.
--
-- Problem: Current RLS policies use is_tenant_admin() which only checks within
--          the user's tenant. Super admins need cross-tenant access.
--
-- Solution: Modify helper functions to include super_admin bypass check.
-- ============================================================================

begin;

-- ============================================================================
-- PART 1: Create/Update Helper Functions with Super Admin Bypass
-- ============================================================================

/**
 * Enhanced is_tenant_admin - now includes super_admin bypass
 * Returns true if:
 *   1. User is a super_admin (cross-tenant access), OR
 *   2. User is an admin/it_admin within their own tenant
 */
CREATE OR REPLACE FUNCTION is_tenant_admin() RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  -- Super admins have cross-tenant admin access
  IF EXISTS (
    SELECT 1 FROM super_admin_users
    WHERE user_id = auth.uid()
    AND is_active = true
  ) THEN
    RETURN true;
  END IF;

  -- Check if user is admin within their tenant
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
    AND tenant_id = get_current_tenant_id()
    AND (is_admin = TRUE OR role IN ('admin', 'it_admin'))
  );
END;
$$;

COMMENT ON FUNCTION is_tenant_admin IS 'Returns true if current user is super_admin OR admin in their tenant. Super admins have cross-tenant access.';

/**
 * Enhanced tenant check - allows super_admin to bypass tenant restriction
 */
CREATE OR REPLACE FUNCTION can_access_tenant(check_tenant_id UUID) RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  -- Super admins can access ANY tenant
  IF EXISTS (
    SELECT 1 FROM super_admin_users
    WHERE user_id = auth.uid()
    AND is_active = true
  ) THEN
    RETURN true;
  END IF;

  -- Regular users can only access their own tenant
  RETURN check_tenant_id = get_current_tenant_id();
END;
$$;

COMMENT ON FUNCTION can_access_tenant(UUID) IS 'Returns true if user can access the specified tenant. Super admins can access all tenants.';

/**
 * Enhanced get_current_tenant_id - returns NULL for super_admins (allows cross-tenant)
 * OR the tenant_id for the current super_admin's active context
 */
CREATE OR REPLACE FUNCTION get_accessible_tenant_ids() RETURNS UUID[]
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  result UUID[];
BEGIN
  -- Super admins can access all tenants
  IF EXISTS (
    SELECT 1 FROM super_admin_users
    WHERE user_id = auth.uid()
    AND is_active = true
  ) THEN
    SELECT ARRAY_AGG(id) INTO result FROM tenants;
    RETURN result;
  END IF;

  -- Regular users can only access their own tenant
  RETURN ARRAY[get_current_tenant_id()];
END;
$$;

COMMENT ON FUNCTION get_accessible_tenant_ids IS 'Returns array of tenant IDs the current user can access. Super admins get all tenants.';

-- ============================================================================
-- PART 2: Add is_admin_v2() helper that includes super_admin bypass
-- ============================================================================
-- NOTE: Not modifying existing is_admin() due to many policy dependencies.
-- Creating new is_admin_v2() for new policies that need super_admin bypass.

CREATE OR REPLACE FUNCTION public.is_admin_v2(check_user_id UUID DEFAULT auth.uid()) RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  -- Check super_admin_users table first (cross-tenant)
  IF EXISTS (
    SELECT 1 FROM super_admin_users
    WHERE user_id = check_user_id
    AND is_active = true
  ) THEN
    RETURN true;
  END IF;

  -- Check profiles table for tenant-level admin
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = check_user_id
    AND (is_admin = TRUE OR role IN ('admin', 'super_admin', 'it_admin'))
  );
END;
$$;

COMMENT ON FUNCTION public.is_admin_v2(UUID) IS 'Returns true if user is any type of admin (super_admin, admin, or it_admin). V2 with super_admin bypass.';

-- ============================================================================
-- PART 3: Create Super Admin Specific RLS Helper
-- ============================================================================

/**
 * Check if current user is specifically a platform super_admin
 * This is for platform-level operations ONLY
 */
CREATE OR REPLACE FUNCTION is_platform_super_admin() RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM super_admin_users
    WHERE user_id = auth.uid()
    AND is_active = true
    AND role = 'super_admin'
  );
END;
$$;

COMMENT ON FUNCTION is_platform_super_admin IS 'Returns true ONLY for Envision platform super_admin users (not tenant admins)';

/**
 * Check if current user is a tenant IT admin
 */
CREATE OR REPLACE FUNCTION is_tenant_it_admin() RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
    AND tenant_id = get_current_tenant_id()
    AND role = 'it_admin'
  );
END;
$$;

COMMENT ON FUNCTION is_tenant_it_admin IS 'Returns true if user is IT admin within their tenant';

-- ============================================================================
-- PART 4: Update Key RLS Policies to Include Super Admin Bypass
-- ============================================================================

-- Drop and recreate profiles policies
-- Note: profiles contain user account info (emails, roles), NOT clinical PHI
-- Super admin CAN see profiles for user management across tenants
DROP POLICY IF EXISTS "profiles_tenant_select" ON profiles;
CREATE POLICY "profiles_tenant_select" ON profiles FOR SELECT
  USING (
    -- Super admin can see profiles for user management (no PHI in profiles)
    is_platform_super_admin()
    OR
    -- Users can see profiles in their tenant
    (tenant_id = get_current_tenant_id() AND (user_id = auth.uid() OR is_tenant_admin()))
  );

DROP POLICY IF EXISTS "profiles_tenant_update" ON profiles;
CREATE POLICY "profiles_tenant_update" ON profiles FOR UPDATE
  USING (
    -- Super admin can update profiles for user management
    is_platform_super_admin()
    OR
    (tenant_id = get_current_tenant_id() AND (user_id = auth.uid() OR is_tenant_admin()))
  )
  WITH CHECK (
    is_platform_super_admin()
    OR
    (tenant_id = get_current_tenant_id() AND (user_id = auth.uid() OR is_tenant_admin()))
  );

-- ============================================================================
-- IMPORTANT: Super admins should NOT access patient PHI data (HIPAA compliance)
-- ============================================================================
-- Patient data stays within tenant boundaries.
-- Super admins can:
--   - Manage tenant accounts (suspend, enable, configure)
--   - View system metrics (aggregated, no PHI)
--   - View audit logs (security events, no clinical details)
--   - Manage feature flags
-- Super admins CANNOT:
--   - Access patient records directly
--   - View PHI (Protected Health Information)
--   - Access clinical data
-- ============================================================================

-- Patients table - NO super_admin access (HIPAA)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'patients' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "patients_tenant_select" ON patients;
    CREATE POLICY "patients_tenant_select" ON patients FOR SELECT
      USING (
        -- NO super_admin bypass for patient PHI
        tenant_id = get_current_tenant_id() AND is_tenant_admin()
      );

    DROP POLICY IF EXISTS "patients_tenant_update" ON patients;
    CREATE POLICY "patients_tenant_update" ON patients FOR UPDATE
      USING (
        -- NO super_admin bypass for patient PHI
        tenant_id = get_current_tenant_id() AND is_tenant_admin()
      );
  END IF;
END $$;

-- Update audit_logs RLS
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "audit_logs_tenant_select" ON audit_logs;
    DROP POLICY IF EXISTS "it_admin_view_tenant_audit_logs" ON audit_logs;

    CREATE POLICY "audit_logs_tenant_select" ON audit_logs FOR SELECT
      USING (
        -- Super admin can see all audit logs
        is_platform_super_admin()
        OR
        -- IT admin and admin can see their tenant's audit logs
        (tenant_id = get_current_tenant_id() AND (is_tenant_admin() OR is_tenant_it_admin()))
      );
  END IF;
END $$;

-- ============================================================================
-- PART 5: Grant Permissions on Functions
-- ============================================================================

GRANT EXECUTE ON FUNCTION is_tenant_admin TO authenticated;
GRANT EXECUTE ON FUNCTION can_access_tenant(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_accessible_tenant_ids TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_v2(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_platform_super_admin TO authenticated;
GRANT EXECUTE ON FUNCTION is_tenant_it_admin TO authenticated;

-- ============================================================================
-- PART 6: Document the Role Hierarchy
-- ============================================================================

COMMENT ON TABLE super_admin_users IS
'Platform-level administrators (Envision VirtualEdge Group employees).

ROLE HIERARCHY & ACCESS:
  1. super_admin (Platform/Envision):
     - CAN: Manage tenants, view system metrics, toggle features, view security logs
     - CANNOT: Access patient PHI, clinical data, or medical records (HIPAA compliance)

  2. it_admin (Tenant IT):
     - CAN: Manage users in their org, view tenant audit logs, manage API keys
     - CANNOT: Access other tenants or platform settings

  3. admin (Tenant Business):
     - CAN: Manage business ops, view tenant reports, manage staff
     - CANNOT: Access other tenants

  4. Clinical roles (nurse, physician, etc):
     - CAN: Access patient data per HIPAA minimum necessary rules
     - CANNOT: Access platform or other tenant data

HIPAA COMPLIANCE:
- Patient PHI is TENANT-SCOPED ONLY
- Super admins DO NOT have access to patient records
- All PHI access requires proper clinical role within the tenant

TABLES:
- super_admin_users = Platform staff (NO PHI access)
- profiles.role = "admin" = Tenant admin (tenant-scoped)
- profiles.role = "it_admin" = Tenant IT (technical ops only)';

commit;
