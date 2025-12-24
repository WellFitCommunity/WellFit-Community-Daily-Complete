-- Migration: Fix tenant_module_config RLS policies
-- Date: 2024-12-24
-- Issue: RLS policies relied on get_current_tenant_id() which reads from a session variable
--        that was never set, causing all queries to return 0 rows.
-- Fix: Changed policies to look up tenant_id directly from the user's profile instead.

-- Drop the problematic policies
DROP POLICY IF EXISTS tenant_module_config_user_read ON tenant_module_config;
DROP POLICY IF EXISTS tenant_module_config_admin_read ON tenant_module_config;
DROP POLICY IF EXISTS tenant_module_config_admin_write ON tenant_module_config;

-- Create new user_read policy that looks up tenant_id from user's profile
-- This allows any authenticated user to read their tenant's module config
CREATE POLICY tenant_module_config_user_read ON tenant_module_config
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT p.tenant_id FROM profiles p
      WHERE p.user_id = auth.uid()
    )
  );

-- Create new admin_read policy for admins
-- Admins can read their tenant's module configuration
CREATE POLICY tenant_module_config_admin_read ON tenant_module_config
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.tenant_id = tenant_module_config.tenant_id
        AND p.role IN ('admin', 'system_admin')
    )
  );

-- Create new admin_write policy for admins
-- Admins can update their tenant's module configuration (except super_admins who use their own policy)
CREATE POLICY tenant_module_config_admin_write ON tenant_module_config
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.tenant_id = tenant_module_config.tenant_id
        AND p.role IN ('admin', 'system_admin')
    )
    -- Super admins cannot update via this policy (they use superadmin_write)
    AND NOT EXISTS (
      SELECT 1 FROM super_admin_users
      WHERE super_admin_users.user_id = auth.uid()
    )
  );

-- Note: superadmin policies remain unchanged as they work correctly
