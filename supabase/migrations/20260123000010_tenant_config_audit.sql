-- Tenant Configuration Audit
-- Purpose: Track all changes to tenant configuration for SOC2 CC6.1 compliance
-- Features: Change history, diff tracking, who/what/when

-- ============================================================================
-- 1. TENANT CONFIG AUDIT TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_config_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),

  -- What changed
  config_table TEXT NOT NULL,         -- Table name (e.g., 'tenants', 'tenant_module_config')
  config_key TEXT,                    -- Specific config key if applicable
  field_name TEXT NOT NULL,           -- Column/field that changed

  -- Change details
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_value JSONB,                    -- Previous value (null for INSERT)
  new_value JSONB,                    -- New value (null for DELETE)

  -- Who made the change
  changed_by_user_id UUID REFERENCES auth.users(id),
  changed_by_name TEXT,               -- Denormalized for reporting
  changed_by_role TEXT,               -- Role at time of change

  -- When and how
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  change_source TEXT DEFAULT 'application',  -- 'application', 'migration', 'manual', 'api'

  -- Context
  ip_address INET,
  user_agent TEXT,
  request_id TEXT,
  session_id TEXT,

  -- Additional metadata
  reason TEXT,                        -- Optional reason for change
  approval_ticket TEXT,               -- Change request/ticket number
  metadata JSONB DEFAULT '{}'
);

-- ============================================================================
-- 2. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_tenant_config_audit_tenant ON tenant_config_audit(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_config_audit_changed_at ON tenant_config_audit(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_config_audit_table ON tenant_config_audit(config_table);
CREATE INDEX IF NOT EXISTS idx_tenant_config_audit_user ON tenant_config_audit(changed_by_user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_config_audit_field ON tenant_config_audit(field_name);

-- ============================================================================
-- 3. AUDIT TRIGGER FUNCTION
-- ============================================================================

-- Generic function to capture tenant config changes
CREATE OR REPLACE FUNCTION fn_audit_tenant_config()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id UUID;
  v_user_id UUID;
  v_user_name TEXT;
  v_user_role TEXT;
  v_old_value JSONB;
  v_new_value JSONB;
  v_field TEXT;
BEGIN
  -- Get current user info
  v_user_id := auth.uid();

  -- Get user details if available
  IF v_user_id IS NOT NULL THEN
    SELECT
      COALESCE(p.full_name, p.display_name, u.email),
      p.role
    INTO v_user_name, v_user_role
    FROM auth.users u
    LEFT JOIN profiles p ON p.user_id = u.id
    WHERE u.id = v_user_id;
  END IF;

  -- Determine tenant_id based on table
  IF TG_TABLE_NAME = 'tenants' THEN
    IF TG_OP = 'DELETE' THEN
      v_tenant_id := OLD.id;
    ELSE
      v_tenant_id := NEW.id;
    END IF;
  ELSIF TG_TABLE_NAME = 'tenant_module_config' THEN
    IF TG_OP = 'DELETE' THEN
      v_tenant_id := OLD.tenant_id;
    ELSE
      v_tenant_id := NEW.tenant_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'tenant_branding' THEN
    IF TG_OP = 'DELETE' THEN
      v_tenant_id := OLD.tenant_id;
    ELSE
      v_tenant_id := NEW.tenant_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'tenant_settings' THEN
    IF TG_OP = 'DELETE' THEN
      v_tenant_id := OLD.tenant_id;
    ELSE
      v_tenant_id := NEW.tenant_id;
    END IF;
  ELSE
    -- Try to find tenant_id column
    IF TG_OP = 'DELETE' AND OLD ? 'tenant_id' THEN
      v_tenant_id := (OLD->>'tenant_id')::UUID;
    ELSIF TG_OP != 'DELETE' AND NEW ? 'tenant_id' THEN
      v_tenant_id := (NEW->>'tenant_id')::UUID;
    END IF;
  END IF;

  -- For UPDATE, record each changed field
  IF TG_OP = 'UPDATE' THEN
    -- Compare each field and log changes
    FOR v_field, v_old_value, v_new_value IN
      SELECT
        COALESCE(o.key, n.key) as field,
        o.value as old_val,
        n.value as new_val
      FROM jsonb_each(to_jsonb(OLD)) o
      FULL OUTER JOIN jsonb_each(to_jsonb(NEW)) n ON o.key = n.key
      WHERE o.value IS DISTINCT FROM n.value
        AND COALESCE(o.key, n.key) NOT IN ('updated_at', 'created_at', 'id')
    LOOP
      INSERT INTO tenant_config_audit (
        tenant_id,
        config_table,
        field_name,
        action,
        old_value,
        new_value,
        changed_by_user_id,
        changed_by_name,
        changed_by_role,
        change_source
      ) VALUES (
        v_tenant_id,
        TG_TABLE_NAME,
        v_field,
        TG_OP,
        v_old_value,
        v_new_value,
        v_user_id,
        v_user_name,
        v_user_role,
        'application'
      );
    END LOOP;
  ELSIF TG_OP = 'INSERT' THEN
    -- Log the entire new record
    INSERT INTO tenant_config_audit (
      tenant_id,
      config_table,
      field_name,
      action,
      old_value,
      new_value,
      changed_by_user_id,
      changed_by_name,
      changed_by_role,
      change_source
    ) VALUES (
      v_tenant_id,
      TG_TABLE_NAME,
      '*',
      TG_OP,
      NULL,
      to_jsonb(NEW),
      v_user_id,
      v_user_name,
      v_user_role,
      'application'
    );
  ELSIF TG_OP = 'DELETE' THEN
    -- Log the entire deleted record
    INSERT INTO tenant_config_audit (
      tenant_id,
      config_table,
      field_name,
      action,
      old_value,
      new_value,
      changed_by_user_id,
      changed_by_name,
      changed_by_role,
      change_source
    ) VALUES (
      v_tenant_id,
      TG_TABLE_NAME,
      '*',
      TG_OP,
      to_jsonb(OLD),
      NULL,
      v_user_id,
      v_user_name,
      v_user_role,
      'application'
    );
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. TRIGGERS ON TENANT TABLES
-- ============================================================================

-- Tenants table
DROP TRIGGER IF EXISTS tr_audit_tenants ON tenants;
CREATE TRIGGER tr_audit_tenants
  AFTER INSERT OR UPDATE OR DELETE ON tenants
  FOR EACH ROW EXECUTE FUNCTION fn_audit_tenant_config();

-- Tenant module config (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenant_module_config') THEN
    DROP TRIGGER IF EXISTS tr_audit_tenant_module_config ON tenant_module_config;
    CREATE TRIGGER tr_audit_tenant_module_config
      AFTER INSERT OR UPDATE OR DELETE ON tenant_module_config
      FOR EACH ROW EXECUTE FUNCTION fn_audit_tenant_config();
  END IF;
END $$;

-- ============================================================================
-- 5. VIEWS
-- ============================================================================

-- Recent config changes view
CREATE OR REPLACE VIEW v_tenant_config_changes AS
SELECT
  tca.id,
  tca.tenant_id,
  t.name AS tenant_name,
  tca.config_table,
  tca.field_name,
  tca.action,
  tca.old_value,
  tca.new_value,
  tca.changed_by_user_id,
  tca.changed_by_name,
  tca.changed_by_role,
  tca.changed_at,
  tca.change_source,
  tca.reason,
  tca.approval_ticket
FROM tenant_config_audit tca
LEFT JOIN tenants t ON t.id = tca.tenant_id
ORDER BY tca.changed_at DESC;

-- Config change summary by tenant
CREATE OR REPLACE VIEW v_tenant_config_change_summary AS
SELECT
  tca.tenant_id,
  t.name AS tenant_name,
  COUNT(*) AS total_changes,
  COUNT(CASE WHEN tca.action = 'INSERT' THEN 1 END) AS inserts,
  COUNT(CASE WHEN tca.action = 'UPDATE' THEN 1 END) AS updates,
  COUNT(CASE WHEN tca.action = 'DELETE' THEN 1 END) AS deletes,
  COUNT(DISTINCT tca.changed_by_user_id) AS unique_changers,
  MAX(tca.changed_at) AS last_change_at
FROM tenant_config_audit tca
LEFT JOIN tenants t ON t.id = tca.tenant_id
GROUP BY tca.tenant_id, t.name;

-- ============================================================================
-- 6. FUNCTIONS
-- ============================================================================

-- Get config change history for a tenant
CREATE OR REPLACE FUNCTION get_tenant_config_history(
  p_tenant_id UUID,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0,
  p_config_table TEXT DEFAULT NULL,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  config_table TEXT,
  field_name TEXT,
  action TEXT,
  old_value JSONB,
  new_value JSONB,
  changed_by_name TEXT,
  changed_by_role TEXT,
  changed_at TIMESTAMPTZ,
  reason TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    tca.id,
    tca.config_table,
    tca.field_name,
    tca.action,
    tca.old_value,
    tca.new_value,
    tca.changed_by_name,
    tca.changed_by_role,
    tca.changed_at,
    tca.reason
  FROM tenant_config_audit tca
  WHERE tca.tenant_id = p_tenant_id
    AND (p_config_table IS NULL OR tca.config_table = p_config_table)
    AND (p_date_from IS NULL OR tca.changed_at >= p_date_from)
    AND (p_date_to IS NULL OR tca.changed_at <= p_date_to)
  ORDER BY tca.changed_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get config change statistics
CREATE OR REPLACE FUNCTION get_tenant_config_stats(
  p_tenant_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  total_changes BIGINT,
  changes_by_table JSONB,
  changes_by_user JSONB,
  changes_by_action JSONB,
  changes_by_day JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT *
    FROM tenant_config_audit
    WHERE tenant_id = p_tenant_id
      AND changed_at >= NOW() - (p_days || ' days')::INTERVAL
  ),
  by_table AS (
    SELECT jsonb_object_agg(config_table, cnt) AS data
    FROM (
      SELECT config_table, COUNT(*) AS cnt
      FROM base
      GROUP BY config_table
    ) t
  ),
  by_user AS (
    SELECT jsonb_agg(jsonb_build_object(
      'name', changed_by_name,
      'count', cnt
    ) ORDER BY cnt DESC) AS data
    FROM (
      SELECT COALESCE(changed_by_name, 'System') AS changed_by_name, COUNT(*) AS cnt
      FROM base
      GROUP BY changed_by_name
      LIMIT 10
    ) u
  ),
  by_action AS (
    SELECT jsonb_object_agg(action, cnt) AS data
    FROM (
      SELECT action, COUNT(*) AS cnt
      FROM base
      GROUP BY action
    ) a
  ),
  by_day AS (
    SELECT jsonb_agg(jsonb_build_object(
      'date', dt::TEXT,
      'count', cnt
    ) ORDER BY dt) AS data
    FROM (
      SELECT DATE(changed_at) AS dt, COUNT(*) AS cnt
      FROM base
      GROUP BY DATE(changed_at)
    ) d
  )
  SELECT
    (SELECT COUNT(*) FROM base)::BIGINT,
    COALESCE((SELECT data FROM by_table), '{}'::JSONB),
    COALESCE((SELECT data FROM by_user), '[]'::JSONB),
    COALESCE((SELECT data FROM by_action), '{}'::JSONB),
    COALESCE((SELECT data FROM by_day), '[]'::JSONB);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log manual config change with reason
CREATE OR REPLACE FUNCTION log_manual_config_change(
  p_tenant_id UUID,
  p_config_table TEXT,
  p_field_name TEXT,
  p_old_value JSONB,
  p_new_value JSONB,
  p_reason TEXT,
  p_approval_ticket TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_user_name TEXT;
  v_user_role TEXT;
  v_id UUID;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NOT NULL THEN
    SELECT
      COALESCE(p.full_name, p.display_name, u.email),
      p.role
    INTO v_user_name, v_user_role
    FROM auth.users u
    LEFT JOIN profiles p ON p.user_id = u.id
    WHERE u.id = v_user_id;
  END IF;

  INSERT INTO tenant_config_audit (
    tenant_id,
    config_table,
    field_name,
    action,
    old_value,
    new_value,
    changed_by_user_id,
    changed_by_name,
    changed_by_role,
    change_source,
    reason,
    approval_ticket
  ) VALUES (
    p_tenant_id,
    p_config_table,
    p_field_name,
    'UPDATE',
    p_old_value,
    p_new_value,
    v_user_id,
    v_user_name,
    v_user_role,
    'manual',
    p_reason,
    p_approval_ticket
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Compare two config snapshots
CREATE OR REPLACE FUNCTION compare_config_snapshots(
  p_tenant_id UUID,
  p_timestamp_1 TIMESTAMPTZ,
  p_timestamp_2 TIMESTAMPTZ
)
RETURNS TABLE (
  config_table TEXT,
  field_name TEXT,
  value_at_t1 JSONB,
  value_at_t2 JSONB,
  changed_between BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH t1_values AS (
    SELECT DISTINCT ON (config_table, field_name)
      config_table,
      field_name,
      CASE
        WHEN action = 'DELETE' THEN NULL
        ELSE new_value
      END AS value
    FROM tenant_config_audit
    WHERE tenant_id = p_tenant_id
      AND changed_at <= p_timestamp_1
    ORDER BY config_table, field_name, changed_at DESC
  ),
  t2_values AS (
    SELECT DISTINCT ON (config_table, field_name)
      config_table,
      field_name,
      CASE
        WHEN action = 'DELETE' THEN NULL
        ELSE new_value
      END AS value
    FROM tenant_config_audit
    WHERE tenant_id = p_tenant_id
      AND changed_at <= p_timestamp_2
    ORDER BY config_table, field_name, changed_at DESC
  )
  SELECT
    COALESCE(t1.config_table, t2.config_table),
    COALESCE(t1.field_name, t2.field_name),
    t1.value,
    t2.value,
    t1.value IS DISTINCT FROM t2.value
  FROM t1_values t1
  FULL OUTER JOIN t2_values t2
    ON t1.config_table = t2.config_table
    AND t1.field_name = t2.field_name
  WHERE t1.value IS DISTINCT FROM t2.value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE tenant_config_audit ENABLE ROW LEVEL SECURITY;

-- Admins can view their tenant's config audit
CREATE POLICY "Admins view tenant config audit"
  ON tenant_config_audit FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.role IN ('admin', 'super_admin')
        AND (
          p.role = 'super_admin'
          OR p.tenant_id = tenant_config_audit.tenant_id
        )
    )
  );

-- System can insert audit records
CREATE POLICY "System insert config audit"
  ON tenant_config_audit FOR INSERT TO authenticated
  WITH CHECK (TRUE);

-- No updates or deletes allowed (immutable audit log)
-- DELETE and UPDATE policies intentionally omitted

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT ON v_tenant_config_changes TO authenticated;
GRANT SELECT ON v_tenant_config_change_summary TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE tenant_config_audit IS 'Immutable audit log of all tenant configuration changes (SOC2 CC6.1)';
COMMENT ON VIEW v_tenant_config_changes IS 'Recent tenant configuration changes with details';
COMMENT ON VIEW v_tenant_config_change_summary IS 'Summary of config changes by tenant';
COMMENT ON FUNCTION get_tenant_config_history IS 'Get paginated config change history for a tenant';
COMMENT ON FUNCTION get_tenant_config_stats IS 'Get config change statistics for a tenant';
COMMENT ON FUNCTION log_manual_config_change IS 'Log a manual config change with reason';
COMMENT ON FUNCTION compare_config_snapshots IS 'Compare config state at two points in time';
