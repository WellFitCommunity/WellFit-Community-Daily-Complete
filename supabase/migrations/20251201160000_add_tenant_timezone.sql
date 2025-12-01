-- ============================================================================
-- TENANT TIMEZONE SUPPORT
-- ============================================================================
-- Adds timezone configuration to tenants table so each organization can
-- display times in their local timezone.
--
-- Examples:
--   - 'America/Chicago' (Central)
--   - 'America/New_York' (Eastern)
--   - 'America/Denver' (Mountain)
--   - 'America/Los_Angeles' (Pacific)
--
-- Database still stores all timestamps in UTC (best practice).
-- Application layer converts for display using tenant's timezone.
-- ============================================================================

-- ============================================================================
-- 1. ADD TIMEZONE COLUMN
-- ============================================================================
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Chicago';

-- ============================================================================
-- 2. VALIDATE TIMEZONE FORMAT
-- ============================================================================
-- Common US timezones for healthcare organizations
-- Using IANA timezone database names (what PostgreSQL uses)

COMMENT ON COLUMN tenants.timezone IS
'IANA timezone identifier for the organization (e.g., America/Chicago, America/New_York). Used for displaying times in local timezone. Default: America/Chicago (Central).';

-- ============================================================================
-- 3. HELPER FUNCTION: GET TENANT TIMEZONE
-- ============================================================================
CREATE OR REPLACE FUNCTION get_tenant_timezone(p_tenant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_timezone TEXT;
BEGIN
  SELECT COALESCE(timezone, 'America/Chicago')
  INTO v_timezone
  FROM tenants
  WHERE id = p_tenant_id;

  RETURN COALESCE(v_timezone, 'America/Chicago');
END;
$$;

COMMENT ON FUNCTION get_tenant_timezone IS
'Returns the timezone for a tenant. Defaults to America/Chicago if not set.';

GRANT EXECUTE ON FUNCTION get_tenant_timezone(UUID) TO authenticated;

-- ============================================================================
-- 4. HELPER FUNCTION: CONVERT UTC TO TENANT LOCAL TIME
-- ============================================================================
CREATE OR REPLACE FUNCTION to_tenant_local(
  p_timestamp TIMESTAMPTZ,
  p_tenant_id UUID
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_timezone TEXT;
BEGIN
  v_timezone := get_tenant_timezone(p_tenant_id);
  RETURN p_timestamp AT TIME ZONE v_timezone;
END;
$$;

COMMENT ON FUNCTION to_tenant_local IS
'Converts a UTC timestamp to the tenant''s local timezone.';

GRANT EXECUTE ON FUNCTION to_tenant_local(TIMESTAMPTZ, UUID) TO authenticated;

-- ============================================================================
-- 5. HELPER FUNCTION: GET CURRENT TIME IN TENANT TIMEZONE
-- ============================================================================
CREATE OR REPLACE FUNCTION tenant_local_now(p_tenant_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN NOW() AT TIME ZONE get_tenant_timezone(p_tenant_id);
END;
$$;

COMMENT ON FUNCTION tenant_local_now IS
'Returns the current time in the tenant''s local timezone.';

GRANT EXECUTE ON FUNCTION tenant_local_now(UUID) TO authenticated;

-- ============================================================================
-- 6. HELPER FUNCTION: GET TENANT LOCAL DATE
-- ============================================================================
CREATE OR REPLACE FUNCTION tenant_local_date(p_tenant_id UUID)
RETURNS DATE
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN (NOW() AT TIME ZONE get_tenant_timezone(p_tenant_id))::DATE;
END;
$$;

COMMENT ON FUNCTION tenant_local_date IS
'Returns the current date in the tenant''s local timezone. Useful for "today" queries.';

GRANT EXECUTE ON FUNCTION tenant_local_date(UUID) TO authenticated;

-- ============================================================================
-- 7. VIEW: COMMON US TIMEZONES (for dropdown in UI)
-- ============================================================================
CREATE OR REPLACE VIEW us_timezones AS
SELECT * FROM (VALUES
  ('America/New_York', 'Eastern Time (ET)', 'UTC-5/UTC-4'),
  ('America/Chicago', 'Central Time (CT)', 'UTC-6/UTC-5'),
  ('America/Denver', 'Mountain Time (MT)', 'UTC-7/UTC-6'),
  ('America/Phoenix', 'Arizona Time (no DST)', 'UTC-7'),
  ('America/Los_Angeles', 'Pacific Time (PT)', 'UTC-8/UTC-7'),
  ('America/Anchorage', 'Alaska Time (AKT)', 'UTC-9/UTC-8'),
  ('Pacific/Honolulu', 'Hawaii Time (no DST)', 'UTC-10')
) AS t(timezone_id, display_name, utc_offset);

COMMENT ON VIEW us_timezones IS
'Common US timezones for use in tenant settings dropdown.';

GRANT SELECT ON us_timezones TO authenticated;
