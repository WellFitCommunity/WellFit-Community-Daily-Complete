-- ============================================================================
-- TIME CLOCK SETTINGS RLS FIX: Add tenant scoping to admin policies
-- ============================================================================
-- CRITICAL: The original policies allowed admins to modify settings for ANY
-- tenant, not just their own. This fix adds proper tenant_id validation.
-- ============================================================================

-- Drop the vulnerable policies
DROP POLICY IF EXISTS time_clock_settings_insert_admin ON time_clock_settings;
DROP POLICY IF EXISTS time_clock_settings_update_admin ON time_clock_settings;

-- ============================================================================
-- FIXED: Insert policy with tenant scoping
-- ============================================================================
-- Admins can only insert settings for their OWN tenant
CREATE POLICY time_clock_settings_insert_admin ON time_clock_settings
  FOR INSERT
  WITH CHECK (
    -- The tenant_id being inserted must match the admin's tenant
    tenant_id = (
      SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
      AND role_code IN (1, 2)  -- SUPER_ADMIN, ADMIN
    )
  );

-- ============================================================================
-- FIXED: Update policy with tenant scoping and WITH CHECK
-- ============================================================================
-- Admins can only update settings for their OWN tenant
CREATE POLICY time_clock_settings_update_admin ON time_clock_settings
  FOR UPDATE
  USING (
    -- Can only see/select rows from their own tenant
    tenant_id = (
      SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
      AND role_code IN (1, 2)  -- SUPER_ADMIN, ADMIN
    )
  )
  WITH CHECK (
    -- Cannot change the tenant_id to a different tenant
    tenant_id = (
      SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- ALSO FIX: time_clock_entries policies need tenant validation in admin update
-- ============================================================================
-- The admin update policy should ensure they can only update entries in their tenant

DROP POLICY IF EXISTS time_clock_entries_update_admin ON time_clock_entries;

CREATE POLICY time_clock_entries_update_admin ON time_clock_entries
  FOR UPDATE
  USING (
    -- Must be in admin's tenant
    tenant_id = (
      SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
      AND role_code IN (1, 2)  -- SUPER_ADMIN, ADMIN
    )
  )
  WITH CHECK (
    -- Cannot move entry to a different tenant
    tenant_id = (
      SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
    )
  );
