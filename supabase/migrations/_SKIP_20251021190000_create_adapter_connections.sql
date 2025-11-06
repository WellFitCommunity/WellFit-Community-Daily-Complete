-- Create adapter_connections table for hospital EHR/EMR integrations
-- Migration: 20251021190000_create_adapter_connections.sql

-- ============================================================================
-- ADAPTER CONNECTIONS TABLE
-- ============================================================================
-- Stores active EHR/EMR adapter configurations and connection status

CREATE TABLE IF NOT EXISTS adapter_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Adapter Identification
  adapter_id VARCHAR(255) NOT NULL,
  adapter_name VARCHAR(255) NOT NULL,
  vendor VARCHAR(255),
  version VARCHAR(50),

  -- Configuration (encrypted in production)
  config JSONB NOT NULL,
  -- Example structure:
  -- {
  --   "endpoint": "https://fhir.hospital.org/api/FHIR/R4",
  --   "authType": "oauth2",
  --   "clientId": "xxx",
  --   "clientSecret": "xxx" (encrypted),
  --   "syncSchedule": "0 */6 * * *",
  --   "dataMapping": {...}
  -- }

  -- Connection Status
  status VARCHAR(50) DEFAULT 'inactive',
  -- Values: 'active', 'inactive', 'error', 'testing'

  -- Sync Information
  last_sync TIMESTAMP WITH TIME ZONE,
  last_sync_status VARCHAR(50),
  last_sync_records INTEGER DEFAULT 0,
  last_error TEXT,

  -- Capabilities (what data types this adapter supports)
  capabilities JSONB,
  -- Example: {"patients": true, "encounters": true, "medications": true}

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  -- Constraints
  UNIQUE(adapter_id)
);

-- ============================================================================
-- ADAPTER SYNC LOGS TABLE
-- ============================================================================
-- Track all sync operations for auditing and troubleshooting

CREATE TABLE IF NOT EXISTS adapter_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Connection Reference
  connection_id UUID REFERENCES adapter_connections(id) ON DELETE CASCADE,
  adapter_id VARCHAR(255) NOT NULL,

  -- Sync Details
  sync_started TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sync_completed TIMESTAMP WITH TIME ZONE,
  sync_status VARCHAR(50) NOT NULL,
  -- Values: 'success', 'partial', 'failed', 'in_progress'

  -- Sync Statistics
  records_fetched INTEGER DEFAULT 0,
  records_inserted INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,

  -- Resource Types Synced
  resource_types TEXT[],
  -- Example: ['Patient', 'Encounter', 'Observation']

  -- Error Details
  error_message TEXT,
  error_details JSONB,

  -- Performance Metrics
  duration_ms INTEGER,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Adapter connections indexes
CREATE INDEX IF NOT EXISTS idx_adapter_connections_status
  ON adapter_connections(status);

CREATE INDEX IF NOT EXISTS idx_adapter_connections_adapter_id
  ON adapter_connections(adapter_id);

CREATE INDEX IF NOT EXISTS idx_adapter_connections_last_sync
  ON adapter_connections(last_sync DESC);

-- Sync logs indexes
CREATE INDEX IF NOT EXISTS idx_adapter_sync_logs_connection_id
  ON adapter_sync_logs(connection_id);

CREATE INDEX IF NOT EXISTS idx_adapter_sync_logs_sync_started
  ON adapter_sync_logs(sync_started DESC);

CREATE INDEX IF NOT EXISTS idx_adapter_sync_logs_sync_status
  ON adapter_sync_logs(sync_status);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_adapter_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_adapter_connections_updated_at
  BEFORE UPDATE ON adapter_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_adapter_connections_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE adapter_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE adapter_sync_logs ENABLE ROW LEVEL SECURITY;

-- Admin access to adapter connections
CREATE POLICY "Admins can view all adapter connections"
  ON adapter_connections
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_admin = true OR profiles.role_code IN (1, 2, 3, 4, 5))
    )
  );

CREATE POLICY "Admins can insert adapter connections"
  ON adapter_connections
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_admin = true OR profiles.role_code IN (1, 2))
    )
  );

CREATE POLICY "Admins can update adapter connections"
  ON adapter_connections
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_admin = true OR profiles.role_code IN (1, 2))
    )
  );

CREATE POLICY "Admins can delete adapter connections"
  ON adapter_connections
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_admin = true OR profiles.role_code IN (1, 2))
    )
  );

-- Admin access to sync logs
CREATE POLICY "Admins can view all sync logs"
  ON adapter_sync_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_admin = true OR profiles.role_code IN (1, 2, 3, 4, 5))
    )
  );

CREATE POLICY "System can insert sync logs"
  ON adapter_sync_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get active connections
CREATE OR REPLACE FUNCTION get_active_adapter_connections()
RETURNS TABLE (
  id UUID,
  adapter_id VARCHAR,
  adapter_name VARCHAR,
  vendor VARCHAR,
  status VARCHAR,
  last_sync TIMESTAMP WITH TIME ZONE,
  last_sync_status VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ac.id,
    ac.adapter_id,
    ac.adapter_name,
    ac.vendor,
    ac.status,
    ac.last_sync,
    ac.last_sync_status
  FROM adapter_connections ac
  WHERE ac.status = 'active'
  ORDER BY ac.last_sync DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get sync history for a connection
CREATE OR REPLACE FUNCTION get_adapter_sync_history(p_connection_id UUID, p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  id UUID,
  sync_started TIMESTAMP WITH TIME ZONE,
  sync_completed TIMESTAMP WITH TIME ZONE,
  sync_status VARCHAR,
  records_fetched INTEGER,
  records_inserted INTEGER,
  records_updated INTEGER,
  duration_ms INTEGER,
  error_message TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    asl.id,
    asl.sync_started,
    asl.sync_completed,
    asl.sync_status,
    asl.records_fetched,
    asl.records_inserted,
    asl.records_updated,
    asl.duration_ms,
    asl.error_message
  FROM adapter_sync_logs asl
  WHERE asl.connection_id = p_connection_id
  ORDER BY asl.sync_started DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update connection status after sync
CREATE OR REPLACE FUNCTION update_connection_sync_status(
  p_connection_id UUID,
  p_status VARCHAR,
  p_records INTEGER DEFAULT 0,
  p_error TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE adapter_connections
  SET
    last_sync = NOW(),
    last_sync_status = p_status,
    last_sync_records = p_records,
    last_error = p_error,
    status = CASE
      WHEN p_status = 'success' THEN 'active'
      WHEN p_status = 'failed' THEN 'error'
      ELSE status
    END
  WHERE id = p_connection_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE adapter_connections IS 'Stores EHR/EMR adapter configurations and connection status for hospital integrations';
COMMENT ON TABLE adapter_sync_logs IS 'Audit log of all adapter synchronization operations';

COMMENT ON COLUMN adapter_connections.config IS 'Encrypted JSONB configuration containing endpoint, authentication, and sync settings';
COMMENT ON COLUMN adapter_connections.capabilities IS 'JSONB map of supported FHIR resource types (patients, encounters, etc.)';
COMMENT ON COLUMN adapter_sync_logs.resource_types IS 'Array of FHIR resource types synced in this operation';
COMMENT ON COLUMN adapter_sync_logs.duration_ms IS 'Total sync duration in milliseconds for performance monitoring';

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_active_adapter_connections() TO authenticated;
GRANT EXECUTE ON FUNCTION get_adapter_sync_history(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION update_connection_sync_status(UUID, VARCHAR, INTEGER, TEXT) TO authenticated;

-- ============================================================================
-- SAMPLE DATA (for testing only - remove in production)
-- ============================================================================

-- Uncomment to insert sample adapter connection for testing
/*
INSERT INTO adapter_connections (
  adapter_id,
  adapter_name,
  vendor,
  version,
  config,
  status,
  capabilities
) VALUES (
  'generic-fhir-r4',
  'Generic FHIR R4 Adapter',
  'Generic',
  '1.0.0',
  '{
    "endpoint": "https://fhir.example.com/R4",
    "authType": "api-key",
    "syncSchedule": "0 */6 * * *"
  }'::jsonb,
  'inactive',
  '{
    "patients": true,
    "encounters": true,
    "observations": true,
    "medications": true,
    "conditions": true
  }'::jsonb
);
*/
